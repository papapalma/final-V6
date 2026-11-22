import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiDownloadFile = vi.fn();
const mockApiClientGet = vi.fn();

vi.mock('../services/api', () => ({
  default: {
    get: (...args: any[]) => mockApiGet(...args),
    post: (...args: any[]) => mockApiPost(...args),
    downloadFile: (...args: any[]) => mockApiDownloadFile(...args),
  },
  apiClient: {
    get: (...args: any[]) => mockApiClientGet(...args),
  },
  API_BASE_URL: 'http://localhost:3003/api',
  getFileUrl: (path: string | null | undefined) => (path ? `http://localhost:3003${path}` : ''),
}));

vi.mock('../utils/encryption', () => ({
  getEncryptedToken: vi.fn().mockResolvedValue('mock-jwt-token'),
}));

const mockAuthState: { user: any } = {
  user: { id: 'admin-1', name: 'Local Admin', email: 'admin@bmdc.ph', role: 'local_admin' },
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockAuthState.user,
    isAuthenticated: true,
  }),
}));

const mockMessengerState: any = {
  conversations: [],
  totalUnreadCount: 0,
  activeConversationId: null,
  setActiveConversationId: vi.fn(),
  isLoading: false,
  isDrawerOpen: false,
  setIsDrawerOpen: vi.fn(),
  refreshConversations: vi.fn().mockResolvedValue(undefined),
  startDMWithUser: vi.fn(),
  markConversationReadLocally: vi.fn(),
  activeMessages: [],
  setActiveMessages: vi.fn(),
  syncNonce: 0,
};

vi.mock('../contexts/MessengerContext', () => ({
  useMessenger: () => mockMessengerState,
}));

import {
  messengerApi,
  resolveAttachmentApiPath,
  Message,
  UserSummary,
} from '../services/messengerService';
import { MessageBubble } from '../components/messenger/MessageBubble';
import { ConversationList } from '../components/messenger/ConversationList';
import { ChatThread } from '../components/messenger/ChatThread';
import { soundEffects } from '../utils/audioChime';

describe('messengerApi single-unwrap contract (ApiService regression)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('unwraps ApiResponse { success, data } once for contacts, conversations, DM creation, and messages', async () => {
    const sampleContacts: UserSummary[] = [
      { id: 't-1', name: 'Juan Dela Cruz', email: 'juan@trainee.ph', role: 'trainee' },
    ];
    mockApiGet.mockResolvedValueOnce({ success: true, data: sampleContacts });
    expect(await messengerApi.getContacts()).toEqual(sampleContacts);

    const sampleConversations = [
      {
        id: 'conv-1',
        type: 'direct',
        title: 'Juan Dela Cruz',
        lastMessageAt: '2026-11-22T10:00:00Z',
        unreadCount: 0,
        latestMessage: null,
        participants: sampleContacts,
      },
    ];
    mockApiGet.mockResolvedValueOnce({ success: true, data: sampleConversations });
    expect(await messengerApi.getConversations()).toEqual(sampleConversations);

    mockApiPost.mockResolvedValueOnce({
      success: true,
      data: { conversationId: 'conv-new-1' },
    });
    expect(await messengerApi.startDirectConversation('t-1')).toBe('conv-new-1');

    const savedMsg: Message = {
      id: 'msg-1',
      conversationId: 'conv-new-1',
      senderId: 'admin-1',
      senderName: 'Local Admin',
      senderRole: 'local_admin',
      content: 'Hello Juan!',
      isDeleted: false,
      createdAt: '2026-11-22T10:01:00Z',
    };
    mockApiGet.mockResolvedValueOnce({
      success: true,
      data: { conversation: sampleConversations[0], messages: [savedMsg] },
    });
    const thread = await messengerApi.getConversationMessages('conv-new-1');
    expect(thread.conversation?.id).toBe('conv-1');
    expect(thread.messages).toEqual([savedMsg]);

    mockApiPost.mockResolvedValueOnce({ success: true, data: savedMsg });
    expect(await messengerApi.sendMessage('conv-new-1', 'Hello Juan!')).toEqual(savedMsg);

    mockApiPost.mockResolvedValueOnce({ success: true, data: { success: true, messageId: 'msg-1' } });
    expect(await messengerApi.unsendMessage('conv-new-1', 'msg-1')).toBe(true);
  });

  it('maps tenant upload paths to /files/{tenantId}/... for authenticated attachment fetches', () => {
    const tid = '194876de-a68c-4d33-8f80-c0978e5d44b3';
    expect(resolveAttachmentApiPath(`/uploads/${tid}/messenger/photo.png`)).toBe(
      `/files/${tid}/messenger/photo.png`
    );
  });
});

describe('ConversationList admin/staff -> trainee contact flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.user = { id: 'admin-1', name: 'Local Admin', email: 'admin@bmdc.ph', role: 'local_admin' };
    mockMessengerState.conversations = [];
    mockMessengerState.isLoading = false;
  });

  it('loads trainees in New Chat modal, filters by name, and starts DM on click', async () => {
    mockApiGet.mockResolvedValueOnce({
      success: true,
      data: [
        { id: 'staff-1', name: 'Maria Coordinator', email: 'maria@bmdc.ph', role: 'staff_training_coordinator' },
        { id: 'trainee-1', name: 'Juan Dela Cruz', email: 'juan@trainee.ph', role: 'trainee' },
      ],
    });
    mockMessengerState.startDMWithUser.mockResolvedValueOnce('conv-dm-juan');
    const onSelectConversation = vi.fn();

    render(<ConversationList onSelectConversation={onSelectConversation} />);

    fireEvent.click(screen.getByRole('button', { name: /new chat/i }));

    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeDefined();
      expect(screen.getByText('Maria Coordinator')).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText(/search contacts/i), { target: { value: 'Juan' } });
    expect(screen.getByText('Juan Dela Cruz')).toBeDefined();
    expect(screen.queryByText('Maria Coordinator')).toBeNull();

    fireEvent.click(screen.getByText('Juan Dela Cruz'));

    await waitFor(() => {
      expect(mockMessengerState.startDMWithUser).toHaveBeenCalledWith('trainee-1');
      expect(onSelectConversation).toHaveBeenCalledWith('conv-dm-juan');
    });
  });
});

describe('ChatThread role-scoped Program GC members', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMessengerState.activeMessages = [];
    mockMessengerState.setActiveMessages = vi.fn();
    mockMessengerState.syncNonce = 0;
  });

  it('hides DM button for fellow trainees when current user is a trainee, but shows it for staff', async () => {
    mockAuthState.user = { id: 't-1', name: 'Juan', email: 'juan@trainee.ph', role: 'trainee' };
    mockApiGet.mockResolvedValueOnce({
      success: true,
      data: {
        conversation: {
          id: 'gc-1',
          type: 'program_group',
          title: 'Backhoe Loader NC II (Program GC)',
          lastMessageAt: '2026-11-22T10:00:00Z',
          unreadCount: 0,
          latestMessage: null,
          participants: [
            { id: 'admin-1', name: 'Local Admin', email: 'admin@bmdc.ph', role: 'local_admin' },
            { id: 't-1', name: 'Juan', email: 'juan@trainee.ph', role: 'trainee' },
            { id: 't-2', name: 'Ana Reyes', email: 'ana@trainee.ph', role: 'trainee' },
          ],
        },
        messages: [],
      },
    });

    render(<ChatThread conversationId="gc-1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /members/i })).toBeDefined();
    });
    fireEvent.click(screen.getByRole('button', { name: /members/i }));

    await waitFor(() => {
      expect(screen.getByText('Ana Reyes')).toBeDefined();
      expect(screen.getByRole('button', { name: /message staff/i })).toBeDefined();
      // Only 1 message button (for Local Admin), none for fellow trainee Ana Reyes
      expect(screen.getAllByRole('button', { name: /message/i })).toHaveLength(1);
    });
  });

  it('deduplicates optimistic send when SSE already delivered the saved message id', async () => {
    mockAuthState.user = { id: 'admin-1', name: 'Local Admin', email: 'admin@bmdc.ph', role: 'local_admin' };
    let currentMessages: Message[] = [];
    mockMessengerState.activeMessages = currentMessages;
    mockMessengerState.setActiveMessages = vi.fn((updater: any) => {
      currentMessages = typeof updater === 'function' ? updater(currentMessages) : updater;
      mockMessengerState.activeMessages = currentMessages;
    });

    mockApiGet.mockResolvedValueOnce({
      success: true,
      data: {
        conversation: {
          id: 'dm-1',
          type: 'direct',
          title: 'Juan Dela Cruz',
          lastMessageAt: '2026-11-22T10:00:00Z',
          unreadCount: 0,
          latestMessage: null,
          participants: [],
        },
        messages: [],
      },
    });

    const savedMsg: Message = {
      id: 'msg-real-1',
      conversationId: 'dm-1',
      senderId: 'admin-1',
      senderName: 'Local Admin',
      senderRole: 'local_admin',
      content: 'Hi Juan!',
      isDeleted: false,
      createdAt: '2026-11-22T10:05:00Z',
    };

    // Simulate SSE delivering `savedMsg` BEFORE POST resolves
    mockApiPost.mockImplementationOnce(async () => {
      mockMessengerState.setActiveMessages((prev: Message[]) => [...prev, savedMsg]);
      return { success: true, data: savedMsg };
    });

    render(<ChatThread conversationId="dm-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText(/message input/i)).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText(/message input/i), { target: { value: 'Hi Juan!' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/messages/dm-1', {
        content: 'Hi Juan!',
        attachment: undefined,
      });
    });

    // Exactly one bubble with real DB id — optimistic placeholder was removed, not duplicated
    expect(currentMessages).toHaveLength(1);
    expect(currentMessages[0].id).toBe('msg-real-1');
  });
});

describe('MessageBubble Component & Authenticated Attachments', () => {
  const mockMessage: Message = {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'user-2',
    senderName: 'Instructor Maria',
    senderRole: 'staff_training_coordinator',
    content: 'Welcome to the program cohort!',
    isDeleted: false,
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders incoming message content, sender name, and staff badge', () => {
    render(<MessageBubble message={mockMessage} isCurrentUser={false} showAvatar={true} />);
    expect(screen.getByText('Welcome to the program cohort!')).toBeDefined();
    expect(screen.getByText('Instructor Maria')).toBeDefined();
    expect(screen.getByText('Staff')).toBeDefined();
  });

  it('renders outgoing message without extra sender avatar or header', () => {
    render(
      <MessageBubble
        message={{ ...mockMessage, senderId: 'current-user', content: 'Thank you maam!' }}
        isCurrentUser={true}
        showAvatar={false}
      />
    );
    expect(screen.getByText('Thank you maam!')).toBeDefined();
    expect(screen.queryByText('Instructor Maria')).toBeNull();
  });

  it('renders unsent placeholder if message is marked deleted', () => {
    render(
      <MessageBubble
        message={{ ...mockMessage, isDeleted: true, content: 'This message was unsent' }}
        isCurrentUser={false}
        showAvatar={true}
      />
    );
    expect(screen.getByText('This message was unsent')).toBeDefined();
  });

  it('loads image attachments via authenticated blob fetch and downloads files via api.downloadFile', async () => {
    const tid = '194876de-a68c-4d33-8f80-c0978e5d44b3';
    const createObjectURL = vi.fn().mockReturnValue('blob:mock-image-url');
    const revokeObjectURL = vi.fn();
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;

    mockApiClientGet.mockResolvedValueOnce({ data: new Blob(['img'], { type: 'image/png' }) });

    const { unmount } = render(
      <MessageBubble
        message={{
          ...mockMessage,
          attachmentUrl: `/uploads/${tid}/messenger/pic.png`,
          attachmentType: 'image',
          attachmentName: 'pic.png',
        }}
        isCurrentUser={false}
        showAvatar={false}
      />
    );

    await waitFor(() => {
      const img = screen.getByAltText('pic.png') as HTMLImageElement;
      expect(img.src).toBe('blob:mock-image-url');
    });
    expect(mockApiClientGet).toHaveBeenCalledWith(`/files/${tid}/messenger/pic.png`, {
      responseType: 'blob',
    });

    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-image-url');

    mockApiDownloadFile.mockResolvedValueOnce(undefined);
    render(
      <MessageBubble
        message={{
          ...mockMessage,
          attachmentUrl: `/uploads/${tid}/messenger/guide.pdf`,
          attachmentType: 'file',
          attachmentName: 'guide.pdf',
        }}
        isCurrentUser={false}
        showAvatar={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /guide\.pdf/i }));
    await waitFor(() => {
      expect(mockApiDownloadFile).toHaveBeenCalledWith(`/files/${tid}/messenger/guide.pdf`, 'guide.pdf');
    });
  });
});

describe('SoundService Audio Chime', () => {
  it('does not throw when triggering synthesized chimes in test environment', () => {
    expect(() => {
      soundEffects.playMessageReceived();
      soundEffects.playMessageSent();
    }).not.toThrow();
  });
});
