import api, { apiClient, API_BASE_URL } from './api';
import { getEncryptedToken } from '../utils/encryption';

export interface MessageAttachment {
  url: string;
  type: 'image' | 'file';
  name: string;
  size?: number;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  senderAvatar?: string;
  content: string;
  attachmentUrl?: string | null;
  attachmentType?: 'image' | 'file' | null;
  attachmentName?: string | null;
  isDeleted: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'program_group';
  title: string;
  programId?: string | null;
  lastMessageAt: string;
  unreadCount: number;
  latestMessage: {
    id: string;
    senderId: string;
    senderName: string;
    content: string;
    attachmentType?: string | null;
    createdAt: string;
  } | null;
  participants: UserSummary[];
  otherUser?: UserSummary;
}

const TENANT_UPLOAD_RE = /^\/uploads\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/.+)$/i;

/**
 * Convert a stored messenger attachment path (e.g. /uploads/{tenantId}/messenger/file.jpg)
 * into an API-relative path (/files/{tenantId}/messenger/file.jpg) so apiClient attaches
 * the Authorization Bearer header.
 */
export function resolveAttachmentApiPath(attachmentUrl: string | null | undefined): string | null {
  if (!attachmentUrl) return null;
  const normalized = attachmentUrl.replace(/\\/g, '/').trim();
  if (!normalized) return null;

  const tenantMatch = normalized.match(TENANT_UPLOAD_RE);
  if (tenantMatch) {
    return `/files/${tenantMatch[1]}`;
  }

  if (normalized.startsWith('/api/files/')) {
    return normalized.slice(4);
  }

  if (normalized.startsWith('/files/')) {
    return normalized;
  }

  return normalized;
}

export const messengerApi = {
  /**
   * Fetch all conversations for current user
   */
  async getConversations(): Promise<Conversation[]> {
    const response = await api.get<Conversation[]>('/messages');
    return Array.isArray(response?.data) ? response.data : [];
  },

  /**
   * Fetch messages and metadata for a conversation
   */
  async getConversationMessages(
    conversationId: string
  ): Promise<{ conversation: Conversation | null; messages: Message[] }> {
    const response = await api.get<{ conversation: Conversation | null; messages: Message[] }>(
      `/messages/${conversationId}`
    );
    return {
      conversation: response?.data?.conversation ?? null,
      messages: Array.isArray(response?.data?.messages) ? response.data.messages : [],
    };
  },

  /**
   * Send a message
   */
  async sendMessage(
    conversationId: string,
    content: string,
    attachment?: MessageAttachment
  ): Promise<Message> {
    const response = await api.post<Message>(`/messages/${conversationId}`, {
      content,
      attachment,
    });
    return response?.data;
  },

  /**
   * Unsend a message within 15 minutes
   */
  async unsendMessage(conversationId: string, messageId: string): Promise<boolean> {
    const response = await api.post<{ success?: boolean; messageId?: string }>(
      `/messages/${conversationId}/unsend`,
      { messageId }
    );
    return Boolean(response?.success ?? response?.data?.success);
  },

  /**
   * Start or get direct conversation with another user
   */
  async startDirectConversation(recipientId: string): Promise<string | undefined> {
    const response = await api.post<{ conversationId: string; conversation?: Conversation }>(
      '/messages',
      { recipientId }
    );
    return response?.data?.conversationId;
  },

  /**
   * Fetch contacts that the current user is allowed to DM
   */
  async getContacts(): Promise<UserSummary[]> {
    const response = await api.get<UserSummary[]>('/messages/contacts');
    return Array.isArray(response?.data) ? response.data : [];
  },

  /**
   * Upload an attachment
   */
  async uploadAttachment(file: File, conversationId?: string): Promise<MessageAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    if (conversationId) {
      formData.append('conversationId', conversationId);
    }

    const response = await api.post<MessageAttachment>('/messages/upload', formData);
    return response?.data;
  },

  /**
   * Fetch an attachment as an authenticated Blob and return a local Object URL.
   * Caller must revoke the returned blob: URL on unmount.
   */
  async fetchAttachmentBlobUrl(attachmentUrl: string): Promise<string> {
    if (attachmentUrl.startsWith('blob:') || attachmentUrl.startsWith('data:')) {
      return attachmentUrl;
    }

    const apiPath = resolveAttachmentApiPath(attachmentUrl);
    if (!apiPath) {
      throw new Error('Invalid attachment path');
    }

    const response = await apiClient.get(apiPath, { responseType: 'blob' });
    const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
    return URL.createObjectURL(blob);
  },

  /**
   * Download an attachment via authenticated Bearer request.
   */
  async downloadAttachment(attachmentUrl: string, filename: string): Promise<void> {
    const apiPath = resolveAttachmentApiPath(attachmentUrl);
    if (!apiPath) {
      throw new Error('Invalid attachment path');
    }
    await api.downloadFile(apiPath, filename || 'attachment');
  },

  /**
   * Build authenticated SSE stream URL
   */
  getStreamUrl(token: string): string {
    return `${API_BASE_URL}/messages/stream?token=${encodeURIComponent(token)}`;
  },

  /**
   * Get raw token for SSE EventSource stream connection
   */
  async getStreamToken(): Promise<string | null> {
    return await getEncryptedToken('bmdc-auth-token');
  },
};
