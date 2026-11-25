import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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
  getCachedThread: vi.fn().mockReturnValue(undefined),
  setCachedThread: vi.fn((_id: string, _conv: any, msgs: any[]) => msgs),
  sendMessage: vi.fn().mockResolvedValue(undefined),
  retryMessage: vi.fn().mockResolvedValue(undefined),
};

let useRealMessengerContext = false;

vi.mock('../contexts/MessengerContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../contexts/MessengerContext')>();
  return {
    ...actual,
    useMessenger: () => (useRealMessengerContext ? actual.useMessenger() : mockMessengerState),
  };
});

import {
  messengerApi,
  resolveAttachmentApiPath,
  Message,
  UserSummary,
} from '../services/messengerService';
import { MessengerProvider, useMessenger } from '../contexts/MessengerContext';
import { MessageBubble } from '../components/messenger/MessageBubble';
import { MessageInput } from '../components/messenger/MessageInput';
import { ConversationList } from '../components/messenger/ConversationList';
import { ChatThread } from '../components/messenger/ChatThread';
import { soundEffects } from '../utils/audioChime';

describe('messengerApi single-unwrap contract (ApiService regression)', () => {
  beforeEach(() => {
    useRealMessengerContext = false;
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

describe('MessageInput 0ms non-blocking rapid-fire composer', () => {
  beforeEach(() => {
    useRealMessengerContext = false;
    vi.clearAllMocks();
  });

  it('clears textarea synchronously on Enter while network POST is still pending and allows rapid consecutive sends', () => {
    // Unresolved promise simulates slow network RTT
    const pendingSend = vi.fn(() => new Promise<void>(() => {}));

    render(<MessageInput conversationId="conv-1" onSendMessage={pendingSend} />);

    const input = screen.getByLabelText(/message input/i) as HTMLTextAreaElement;

    fireEvent.change(input, { target: { value: 'First message' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    // Cleared immediately in the same frame — never waits for network
    expect(input.value).toBe('');
    expect(input.disabled).toBe(false);
    expect(pendingSend).toHaveBeenNthCalledWith(1, 'First message', undefined);

    // Immediately fire a second message while first POST is still unresolved
    fireEvent.change(input, { target: { value: 'Second message' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    expect(input.value).toBe('');
    expect(pendingSend).toHaveBeenNthCalledWith(2, 'Second message', undefined);
  });
});

describe('MessengerProvider FIFO send queue & inline Retry', () => {
  beforeEach(() => {
    useRealMessengerContext = true;
    vi.clearAllMocks();
    mockAuthState.user = { id: 'admin-1', name: 'Local Admin', email: 'admin@bmdc.ph', role: 'local_admin' };
    // Mock EventSource cleanly in jsdom
    (globalThis as any).EventSource = class {
      addEventListener = vi.fn();
      close = vi.fn();
      onerror = null;
    };
  });

  it('dispatches rapid-fire sends strictly FIFO per conversation, preserves clientKey on reconcile, and supports Retry on failure', async () => {
    mockApiGet.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'dm-fifo',
          type: 'direct',
          title: 'Juan Dela Cruz',
          lastMessageAt: '2026-11-23T10:00:00Z',
          unreadCount: 0,
          latestMessage: null,
          participants: [],
        },
      ],
    });

    let resolveFirst!: (val: any) => void;
    let rejectSecond!: (err: any) => void;

    mockApiPost
      .mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolveFirst = res;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((_res, rej) => {
            rejectSecond = rej;
          })
      )
      .mockResolvedValueOnce({
        success: true,
        data: {
          id: 'db-msg-2',
          conversationId: 'dm-fifo',
          senderId: 'admin-1',
          senderName: 'Local Admin',
          senderRole: 'local_admin',
          content: 'Second',
          isDeleted: false,
          createdAt: '2026-11-23T10:02:00Z',
        },
      });

    let ctxRef!: ReturnType<typeof useMessenger>;
    function Harness() {
      const ctx = useMessenger();
      ctxRef = ctx;
      return (
        <div>
          {ctx.activeMessages.map((m) => (
            <div key={m.clientKey || m.id} data-testid={`msg-${m.content}`} data-key={m.clientKey} data-status={m.status} data-id={m.id}>
              {m.content}
            </div>
          ))}
        </div>
      );
    }

    render(
      <MessengerProvider>
        <Harness />
      </MessengerProvider>
    );

    await waitFor(() => expect(ctxRef).toBeDefined());

    act(() => {
      ctxRef.setActiveConversationId('dm-fifo');
    });

    // Wait one tick so activeConversationIdRef syncs
    await waitFor(() => expect(ctxRef.activeConversationId).toBe('dm-fifo'));

    // Fire 2 rapid messages back-to-back
    act(() => {
      void ctxRef.sendMessage('dm-fifo', 'First');
      void ctxRef.sendMessage('dm-fifo', 'Second');
    });

    // Both appear immediately at 0ms as 'sending', while ONLY First POST is in-flight (strict FIFO!)
    const firstEl = screen.getByTestId('msg-First');
    const secondEl = screen.getByTestId('msg-Second');
    const initialFirstKey = firstEl.getAttribute('data-key');
    const initialSecondKey = secondEl.getAttribute('data-key')!;

    expect(firstEl.getAttribute('data-status')).toBe('sending');
    expect(secondEl.getAttribute('data-status')).toBe('sending');

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledTimes(1);
      expect(mockApiPost).toHaveBeenCalledWith('/messages/dm-fifo', {
        content: 'First',
        attachment: undefined,
      });
    });

    // Resolve First -> Second POST now dispatches; First keeps exact same clientKey (no re-mount!)
    await act(async () => {
      resolveFirst({
        success: true,
        data: {
          id: 'db-msg-1',
          conversationId: 'dm-fifo',
          senderId: 'admin-1',
          senderName: 'Local Admin',
          senderRole: 'local_admin',
          content: 'First',
          isDeleted: false,
          createdAt: '2026-11-23T10:01:00Z',
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('msg-First').getAttribute('data-status')).toBe('sent');
      expect(screen.getByTestId('msg-First').getAttribute('data-id')).toBe('db-msg-1');
      expect(screen.getByTestId('msg-First').getAttribute('data-key')).toBe(initialFirstKey);
      expect(mockApiPost).toHaveBeenCalledTimes(2);
    });

    // Reject Second -> marks failed inline, then retryMessage succeeds
    await act(async () => {
      rejectSecond({ message: 'Network drop' });
    });

    await waitFor(() => {
      expect(screen.getByTestId('msg-Second').getAttribute('data-status')).toBe('failed');
    });

    await act(async () => {
      await ctxRef.retryMessage('dm-fifo', initialSecondKey);
    });

    await waitFor(() => {
      expect(screen.getByTestId('msg-Second').getAttribute('data-status')).toBe('sent');
      expect(screen.getByTestId('msg-Second').getAttribute('data-id')).toBe('db-msg-2');
      expect(screen.getByTestId('msg-Second').getAttribute('data-key')).toBe(initialSecondKey);
    });
  });
});

describe('ConversationList admin/staff -> trainee contact flow & filter tabs', () => {
  beforeEach(() => {
    useRealMessengerContext = false;
    vi.clearAllMocks();
    mockAuthState.user = { id: 'admin-1', name: 'Local Admin', email: 'admin@bmdc.ph', role: 'local_admin' };
    mockMessengerState.conversations = [];
    mockMessengerState.isLoading = false;
  });

  it('loads trainees in New Chat modal, filters by name, switches tabs smoothly, and starts DM on click', async () => {
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

    // Verify segmented filter tabs toggle aria-selected cleanly
    const directTab = screen.getByRole('tab', { name: /direct/i });
    fireEvent.click(directTab);
    expect(directTab.getAttribute('aria-selected')).toBe('true');

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

describe('ChatThread role-scoped Program GC members & smart sticky-bottom', () => {
  beforeEach(() => {
    useRealMessengerContext = false;
    vi.clearAllMocks();
    mockMessengerState.activeMessages = [];
    mockMessengerState.setActiveMessages = vi.fn();
    mockMessengerState.getCachedThread = vi.fn().mockReturnValue(undefined);
    mockMessengerState.setCachedThread = vi.fn((_id: string, _conv: any, msgs: any[]) => msgs);
    mockMessengerState.sendMessage = vi.fn().mockResolvedValue(undefined);
    mockMessengerState.retryMessage = vi.fn().mockResolvedValue(undefined);
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
      expect(screen.getAllByRole('button', { name: /message/i })).toHaveLength(1);
    });
  });

  it('shows Jump to latest pill when scrolled away from bottom and delegates sends to context queue', async () => {
    mockAuthState.user = { id: 'admin-1', name: 'Local Admin', email: 'admin@bmdc.ph', role: 'local_admin' };
    mockMessengerState.activeMessages = [
      {
        id: 'm-1',
        clientKey: 'm-1',
        conversationId: 'dm-1',
        senderId: 't-1',
        senderName: 'Juan',
        senderRole: 'trainee',
        content: 'Hello',
        isDeleted: false,
        createdAt: '2026-11-23T10:00:00Z',
      },
    ];
    mockApiGet.mockResolvedValueOnce({
      success: true,
      data: {
        conversation: {
          id: 'dm-1',
          type: 'direct',
          title: 'Juan Dela Cruz',
          lastMessageAt: '2026-11-23T10:00:00Z',
          unreadCount: 0,
          latestMessage: null,
          participants: [],
        },
        messages: mockMessengerState.activeMessages,
      },
    });

    const { container } = render(<ChatThread conversationId="dm-1" />);

    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeDefined();
    });

    // Simulate user scrolling up >120px away from bottom
    const scroller = container.querySelector('.overflow-y-auto') as HTMLDivElement;
    Object.defineProperty(scroller, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(scroller, 'clientHeight', { value: 300, configurable: true });
    Object.defineProperty(scroller, 'scrollTop', { value: 100, configurable: true });

    fireEvent.scroll(scroller);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /jump to latest/i })).toBeDefined();
    });

    // Sending delegates immediately to MessengerContext.sendMessage
    const input = screen.getByLabelText(/message input/i);
    fireEvent.change(input, { target: { value: 'Quick reply' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    expect(mockMessengerState.sendMessage).toHaveBeenCalledWith('dm-1', 'Quick reply', undefined);
  });
});

describe('MessageBubble Component, Delivery States & Authenticated Attachments', () => {
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
    useRealMessengerContext = false;
    vi.clearAllMocks();
  });

  it('renders incoming message content, sender name, and staff badge', () => {
    render(<MessageBubble message={mockMessage} isCurrentUser={false} showAvatar={true} />);
    expect(screen.getByText('Welcome to the program cohort!')).toBeDefined();
    expect(screen.getByText('Instructor Maria')).toBeDefined();
    expect(screen.getByText('Staff')).toBeDefined();
  });

  it('renders outgoing delivery states: Sending, Sent check, and Failed Retry button', () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <MessageBubble
        message={{ ...mockMessage, id: 'opt-1', clientKey: 'opt-1', senderId: 'me', status: 'sending', isNew: true }}
        isCurrentUser={true}
        onRetry={onRetry}
        showAvatar={false}
      />
    );
    expect(screen.getByLabelText('Sending')).toBeDefined();

    rerender(
      <MessageBubble
        message={{ ...mockMessage, id: 'db-1', clientKey: 'opt-1', senderId: 'me', status: 'sent', isNew: true }}
        isCurrentUser={true}
        onRetry={onRetry}
        showAvatar={false}
      />
    );
    expect(screen.getByLabelText('Sent')).toBeDefined();

    rerender(
      <MessageBubble
        message={{ ...mockMessage, id: 'opt-1', clientKey: 'opt-1', senderId: 'me', status: 'failed', isNew: true }}
        isCurrentUser={true}
        onRetry={onRetry}
        showAvatar={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledWith('opt-1');
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
