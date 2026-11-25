import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import {
  messengerApi,
  Conversation,
  Message,
  MessageAttachment,
} from '../services/messengerService';
import { soundEffects } from '../utils/audioChime';
import { toast } from 'sonner';
import { MessageSquare } from 'lucide-react';

export interface CachedThread {
  conversation: Conversation | null;
  messages: Message[];
  fetchedAt: number;
}

interface MessengerContextType {
  conversations: Conversation[];
  totalUnreadCount: number;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  isLoading: boolean;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  refreshConversations: (forceSync?: boolean) => Promise<void>;
  startDMWithUser: (userId: string) => Promise<string | null>;
  markConversationReadLocally: (convId: string) => void;
  activeMessages: Message[];
  setActiveMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  syncNonce: number;
  getCachedThread: (convId: string) => CachedThread | undefined;
  setCachedThread: (convId: string, conversation: Conversation | null, messages: Message[]) => Message[];
  sendMessage: (conversationId: string, content: string, attachment?: MessageAttachment) => Promise<void>;
  retryMessage: (conversationId: string, clientKey: string) => Promise<void>;
}

const MessengerContext = createContext<MessengerContextType | undefined>(undefined);

/**
 * Reconcile a newly saved server message into a message list while preserving `clientKey`
 * so the bubble never re-mounts or replays its entrance animation.
 */
function reconcileSavedMessage(prev: Message[], tempId: string, saved: Message): Message[] {
  const existingRealIdx = prev.findIndex((m) => m.id === saved.id);
  const tempIdx = prev.findIndex((m) => m.clientKey === tempId || m.id === tempId);

  if (existingRealIdx >= 0 && tempIdx >= 0 && existingRealIdx !== tempIdx) {
    // SSE delivered saved.id as a separate entry before POST returned; keep stable clientKey once
    const next = prev.filter((_, idx) => idx !== existingRealIdx);
    const updatedTempIdx = next.findIndex((m) => m.clientKey === tempId || m.id === tempId);
    if (updatedTempIdx >= 0) {
      next[updatedTempIdx] = {
        ...saved,
        clientKey: next[updatedTempIdx].clientKey || tempId,
        status: 'sent',
        isNew: next[updatedTempIdx].isNew,
      };
    }
    return next;
  }

  if (tempIdx >= 0) {
    const next = [...prev];
    next[tempIdx] = {
      ...saved,
      clientKey: next[tempIdx].clientKey || tempId,
      status: 'sent',
      isNew: next[tempIdx].isNew,
    };
    return next;
  }

  if (existingRealIdx >= 0) {
    const next = [...prev];
    next[existingRealIdx] = {
      ...saved,
      clientKey: next[existingRealIdx].clientKey || saved.id,
      status: 'sent',
      isNew: next[existingRealIdx].isNew,
    };
    return next;
  }

  return [...prev, { ...saved, clientKey: tempId, status: 'sent', isNew: true }];
}

/**
 * Merge server-fetched historical messages with any local in-flight ('sending' | 'failed') bubbles
 * so background revalidation never wipes a pending rapid-fire message.
 */
function mergeServerMessagesWithPending(serverMessages: Message[], existingMessages: Message[]): Message[] {
  const normalizedServer: Message[] = serverMessages.map((m) => {
    const existing = existingMessages.find((e) => e.id === m.id);
    return {
      ...m,
      clientKey: existing?.clientKey || m.id,
      status: 'sent',
      isNew: false,
    };
  });

  const serverIds = new Set(normalizedServer.map((m) => m.id));
  const pendingLocal = existingMessages.filter(
    (m) => (m.status === 'sending' || m.status === 'failed') && !serverIds.has(m.id)
  );

  return pendingLocal.length > 0 ? [...normalizedServer, ...pendingLocal] : normalizedServer;
}

export function MessengerProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [syncNonce, setSyncNonce] = useState(0);

  // Keep latest activeConversationId and user in refs so SSE & FIFO queues never go stale
  const activeConversationIdRef = useRef<string | null>(activeConversationId);
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const threadCacheRef = useRef<Map<string, CachedThread>>(new Map());
  const sendQueuesRef = useRef<Map<string, Promise<void>>>(new Map());
  const optimisticSeqRef = useRef<number>(0);
  const lastVisibilitySyncRef = useRef<number>(0);

  // Compute total unread count across all conversations
  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((acc, conv) => acc + (conv.unreadCount || 0), 0);
  }, [conversations]);

  const refreshConversations = useCallback(
    async (forceSync?: boolean) => {
      if (!isAuthenticated) return;
      try {
        const data = await messengerApi.getConversations(forceSync);
        setConversations(data);
      } catch {
        // Background fetch error ignored
      }
    },
    [isAuthenticated]
  );

  const getCachedThread = useCallback((convId: string): CachedThread | undefined => {
    return threadCacheRef.current.get(convId);
  }, []);

  const setCachedThread = useCallback(
    (convId: string, conversation: Conversation | null, serverMessages: Message[]): Message[] => {
      const existing = threadCacheRef.current.get(convId);
      const merged = mergeServerMessagesWithPending(serverMessages, existing?.messages || []);
      threadCacheRef.current.set(convId, {
        conversation: conversation ?? existing?.conversation ?? null,
        messages: merged,
        fetchedAt: Date.now(),
      });
      return merged;
    },
    []
  );

  /** Update a conversation's messages in both the thread cache and activeMessages (if open) */
  const updateConversationMessages = useCallback(
    (conversationId: string, updater: (prev: Message[]) => Message[]) => {
      const cached = threadCacheRef.current.get(conversationId);
      if (cached) {
        threadCacheRef.current.set(conversationId, {
          ...cached,
          messages: updater(cached.messages),
        });
      }
      if (activeConversationIdRef.current === conversationId) {
        setActiveMessages((prev) => {
          const next = updater(prev);
          const existing = threadCacheRef.current.get(conversationId);
          threadCacheRef.current.set(conversationId, {
            conversation: existing?.conversation ?? null,
            messages: next,
            fetchedAt: existing?.fetchedAt ?? Date.now(),
          });
          return next;
        });
      }
    },
    []
  );

  /** Project a newly sent or received message onto the conversation list locally in 0ms */
  const projectMessageToConversationList = useCallback(
    (conversationId: string, message: Message, incrementUnread: boolean) => {
      setConversations((prev) => {
        const existingIndex = prev.findIndex((c) => c.id === conversationId);
        if (existingIndex >= 0) {
          const updated = [...prev];
          const conv = updated[existingIndex];
          const isCurrentOpen = activeConversationIdRef.current === conversationId;

          updated[existingIndex] = {
            ...conv,
            lastMessageAt: message.createdAt,
            unreadCount: isCurrentOpen
              ? 0
              : (conv.unreadCount || 0) + (incrementUnread ? 1 : 0),
            latestMessage: {
              id: message.id,
              senderId: message.senderId,
              senderName: message.senderName,
              content: message.content,
              attachmentType: message.attachmentType,
              createdAt: message.createdAt,
            },
          };

          const [moved] = updated.splice(existingIndex, 1);
          return [moved, ...updated];
        }
        // Unknown brand-new conversation (e.g. received from another user): fetch list
        refreshConversations();
        return prev;
      });
    },
    [refreshConversations]
  );

  /** Enqueue a single network POST strictly FIFO per conversationId */
  const enqueueSend = useCallback(
    (
      conversationId: string,
      tempId: string,
      content: string,
      attachment?: MessageAttachment
    ): Promise<void> => {
      const priorQueue = sendQueuesRef.current.get(conversationId) ?? Promise.resolve();

      const nextTask = priorQueue
        .catch(() => {})
        .then(async () => {
          try {
            const saved = await messengerApi.sendMessage(conversationId, content, attachment);
            if (!saved || !saved.id) {
              throw new Error('Failed to save message');
            }
            updateConversationMessages(conversationId, (prev) =>
              reconcileSavedMessage(prev, tempId, saved)
            );
            projectMessageToConversationList(conversationId, saved, false);
          } catch (err: any) {
            updateConversationMessages(conversationId, (prev) =>
              prev.map((m) =>
                m.clientKey === tempId || m.id === tempId
                  ? { ...m, status: 'failed' as const }
                  : m
              )
            );
            toast.error(err?.message || 'Failed to send message');
          }
        });

      const settledQueue = nextTask.finally(() => {
        if (sendQueuesRef.current.get(conversationId) === settledQueue) {
          sendQueuesRef.current.delete(conversationId);
        }
      });
      sendQueuesRef.current.set(conversationId, settledQueue);
      return settledQueue;
    },
    [updateConversationMessages, projectMessageToConversationList]
  );

  /** 0ms optimistic send + per-conversation FIFO dispatch */
  const sendMessage = useCallback(
    (conversationId: string, content: string, attachment?: MessageAttachment): Promise<void> => {
      const currentUser = userRef.current;
      if (!currentUser) return Promise.resolve();

      const tempId = `optimistic-${Date.now()}-${++optimisticSeqRef.current}`;
      const optimisticMessage: Message = {
        id: tempId,
        clientKey: tempId,
        conversationId,
        senderId: currentUser.id,
        senderName: currentUser.name || 'You',
        senderRole: currentUser.role,
        content,
        attachmentUrl: attachment?.url || null,
        attachmentType: attachment?.type || null,
        attachmentName: attachment?.name || null,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        status: 'sending',
        isNew: true,
        pendingAttachment: attachment,
      };

      // Instant 0ms local projection + synchronized audio cue
      updateConversationMessages(conversationId, (prev) => [...prev, optimisticMessage]);
      projectMessageToConversationList(conversationId, optimisticMessage, false);
      soundEffects.playMessageSent();

      return enqueueSend(conversationId, tempId, content, attachment);
    },
    [updateConversationMessages, projectMessageToConversationList, enqueueSend]
  );

  /** Retry a failed optimistic message in place on the FIFO queue */
  const retryMessage = useCallback(
    (conversationId: string, clientKey: string): Promise<void> => {
      const cached = threadCacheRef.current.get(conversationId);
      const target =
        cached?.messages.find((m) => m.clientKey === clientKey || m.id === clientKey) ||
        activeMessages.find((m) => m.clientKey === clientKey || m.id === clientKey);

      if (!target || target.status !== 'failed') return Promise.resolve();

      updateConversationMessages(conversationId, (prev) =>
        prev.map((m) =>
          m.clientKey === clientKey || m.id === clientKey
            ? { ...m, status: 'sending' as const }
            : m
        )
      );

      return enqueueSend(
        conversationId,
        target.clientKey || target.id,
        target.content,
        target.pendingAttachment
      );
    },
    [activeMessages, updateConversationMessages, enqueueSend]
  );

  // Initial load & logout cleanup
  useEffect(() => {
    if (isAuthenticated) {
      setIsLoading(true);
      refreshConversations().finally(() => setIsLoading(false));
    } else {
      setConversations([]);
      setActiveConversationId(null);
      setActiveMessages([]);
      threadCacheRef.current.clear();
      sendQueuesRef.current.clear();
    }
  }, [isAuthenticated, refreshConversations]);

  // Mark conversation read locally
  const markConversationReadLocally = useCallback((convId: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
    );
  }, []);

  // Re-sync conversations and active thread when user returns to the tab
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastVisibilitySyncRef.current < 2000) return;
      lastVisibilitySyncRef.current = now;
      refreshConversations();
      if (activeConversationIdRef.current) {
        setSyncNonce((n) => n + 1);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, refreshConversations]);

  // Persistent real-time Server-Sent Events (SSE) listener
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    let eventSource: EventSource | null = null;
    let isSubscribed = true;
    let hasConnectedOnce = false;

    async function setupStream() {
      const token = await messengerApi.getStreamToken();
      if (!token || !isSubscribed) return;

      const streamUrl = messengerApi.getStreamUrl(token);
      eventSource = new EventSource(streamUrl);

      eventSource.addEventListener('connected', () => {
        if (hasConnectedOnce) {
          refreshConversations();
          if (activeConversationIdRef.current) {
            setSyncNonce((n) => n + 1);
          }
        }
        hasConnectedOnce = true;
      });

      eventSource.addEventListener('new_message', (e) => {
        try {
          const payload = JSON.parse(e.data);
          const { conversationId, message } = payload;

          // If the message is from someone else:
          if (message.senderId !== user.id) {
            soundEffects.playMessageReceived();

            toast(message.senderName, {
              description: message.content || 'Sent an attachment',
              icon: <MessageSquare className="w-4 h-4 text-blue-500" />,
              action: {
                label: 'View',
                onClick: () => {
                  setActiveConversationId(conversationId);
                  if (typeof window !== 'undefined' && window.location.pathname !== '/messages') {
                    setIsDrawerOpen(true);
                  }
                },
              },
            });
          }

          // Merge cleanly into thread cache & active thread, preserving clientKey for optimistic echoes
          updateConversationMessages(conversationId, (prev) => {
            if (prev.some((m) => m.id === message.id)) return prev;

            if (message.senderId === user.id) {
              // FIFO match: match earliest 'sending' optimistic bubble with same content/attachment
              const optimisticIdx = prev.findIndex(
                (m) =>
                  m.status === 'sending' &&
                  m.senderId === message.senderId &&
                  m.content === message.content &&
                  (m.attachmentUrl || null) === (message.attachmentUrl || null)
              );
              if (optimisticIdx >= 0) {
                const next = [...prev];
                next[optimisticIdx] = {
                  ...message,
                  clientKey: next[optimisticIdx].clientKey || next[optimisticIdx].id,
                  status: 'sent',
                  isNew: next[optimisticIdx].isNew,
                };
                return next;
              }
            }

            return [
              ...prev,
              {
                ...message,
                clientKey: message.id,
                status: 'sent',
                isNew: true,
              },
            ];
          });

          projectMessageToConversationList(
            conversationId,
            message,
            message.senderId !== user.id
          );
        } catch (err) {
          console.error('[SSE] Failed to parse message', err);
        }
      });

      eventSource.addEventListener('message_unsend', (e) => {
        try {
          const { conversationId, messageId } = JSON.parse(e.data);
          updateConversationMessages(conversationId, (prev) =>
            prev.map((m) =>
              m.id === messageId
                ? { ...m, isDeleted: true, content: 'This message was unsent', attachmentUrl: null }
                : m
            )
          );
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id === conversationId && c.latestMessage?.id === messageId) {
                return {
                  ...c,
                  latestMessage: {
                    ...c.latestMessage,
                    content: 'This message was unsent',
                  },
                };
              }
              return c;
            })
          );
        } catch (err) {
          console.error('[SSE] Failed to parse unsend', err);
        }
      });

      eventSource.onerror = () => {
        // EventSource automatically retries with backoff; 'connected' handler resyncs on recovery
      };
    }

    setupStream();

    return () => {
      isSubscribed = false;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [
    isAuthenticated,
    user,
    refreshConversations,
    updateConversationMessages,
    projectMessageToConversationList,
  ]);

  // Start direct message helper
  const startDMWithUser = useCallback(
    async (targetUserId: string): Promise<string | null> => {
      try {
        const convId = await messengerApi.startDirectConversation(targetUserId);
        if (convId) {
          await refreshConversations();
          setActiveConversationId(convId);
          if (typeof window !== 'undefined' && window.location.pathname !== '/messages') {
            setIsDrawerOpen(true);
          }
          return convId;
        }
        toast.error('Could not start conversation');
      } catch (err: any) {
        const errorMessage =
          err?.message ||
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          'Could not start conversation';
        toast.error(errorMessage);
      }
      return null;
    },
    [refreshConversations]
  );

  return (
    <MessengerContext.Provider
      value={{
        conversations,
        totalUnreadCount,
        activeConversationId,
        setActiveConversationId,
        isLoading,
        isDrawerOpen,
        setIsDrawerOpen,
        refreshConversations,
        startDMWithUser,
        markConversationReadLocally,
        activeMessages,
        setActiveMessages,
        syncNonce,
        getCachedThread,
        setCachedThread,
        sendMessage,
        retryMessage,
      }}
    >
      {children}
    </MessengerContext.Provider>
  );
}

export function useMessenger() {
  const context = useContext(MessengerContext);
  if (!context) {
    throw new Error('useMessenger must be used within a MessengerProvider');
  }
  return context;
}
