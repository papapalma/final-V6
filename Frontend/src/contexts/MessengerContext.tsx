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
import { messengerApi, Conversation, Message } from '../services/messengerService';
import { soundEffects } from '../utils/audioChime';
import { toast } from 'sonner';
import { MessageSquare } from 'lucide-react';

interface MessengerContextType {
  conversations: Conversation[];
  totalUnreadCount: number;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  isLoading: boolean;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  refreshConversations: () => Promise<void>;
  startDMWithUser: (userId: string) => Promise<string | null>;
  markConversationReadLocally: (convId: string) => void;
  activeMessages: Message[];
  setActiveMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  syncNonce: number;
}

const MessengerContext = createContext<MessengerContextType | undefined>(undefined);

export function MessengerProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [syncNonce, setSyncNonce] = useState(0);

  // Keep latest activeConversationId in a ref so SSE stays persistently connected across chat switches
  const activeConversationIdRef = useRef<string | null>(activeConversationId);
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const lastVisibilitySyncRef = useRef<number>(0);

  // Compute total unread count across all conversations
  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((acc, conv) => acc + (conv.unreadCount || 0), 0);
  }, [conversations]);

  const refreshConversations = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await messengerApi.getConversations();
      setConversations(data);
    } catch {
      // Background fetch error ignored
    }
  }, [isAuthenticated]);

  // Initial load
  useEffect(() => {
    if (isAuthenticated) {
      setIsLoading(true);
      refreshConversations().finally(() => setIsLoading(false));
    } else {
      setConversations([]);
      setActiveConversationId(null);
      setActiveMessages([]);
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
          // Resync after SSE reconnect so no messages were missed during disconnect
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
          const currentActiveId = activeConversationIdRef.current;

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

          // If this is the active conversation, merge cleanly without duplicating optimistic bubbles
          if (currentActiveId === conversationId) {
            setActiveMessages((prev) => {
              if (prev.some((m) => m.id === message.id)) return prev;

              if (message.senderId === user.id) {
                const optimisticIdx = prev.findIndex(
                  (m) =>
                    m.id.startsWith('optimistic-') &&
                    m.senderId === message.senderId &&
                    m.content === message.content &&
                    (m.attachmentUrl || null) === (message.attachmentUrl || null)
                );
                if (optimisticIdx >= 0) {
                  const next = [...prev];
                  next[optimisticIdx] = message;
                  return next;
                }
              }

              return [...prev, message];
            });
          }

          // Update conversation in the list
          setConversations((prev) => {
            const existingIndex = prev.findIndex((c) => c.id === conversationId);
            if (existingIndex >= 0) {
              const updated = [...prev];
              const conv = updated[existingIndex];
              const isCurrentOpen = currentActiveId === conversationId;

              updated[existingIndex] = {
                ...conv,
                lastMessageAt: message.createdAt,
                unreadCount: isCurrentOpen
                  ? 0
                  : (conv.unreadCount || 0) + (message.senderId !== user.id ? 1 : 0),
                latestMessage: {
                  id: message.id,
                  senderId: message.senderId,
                  senderName: message.senderName,
                  content: message.content,
                  attachmentType: message.attachmentType,
                  createdAt: message.createdAt,
                },
              };

              // Re-sort conversation to top
              const [moved] = updated.splice(existingIndex, 1);
              return [moved, ...updated];
            } else {
              // Brand new conversation, refresh list
              refreshConversations();
              return prev;
            }
          });
        } catch (err) {
          console.error('[SSE] Failed to parse message', err);
        }
      });

      eventSource.addEventListener('message_unsend', (e) => {
        try {
          const { conversationId, messageId } = JSON.parse(e.data);
          setActiveMessages((prev) =>
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
  }, [isAuthenticated, user, refreshConversations]);

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
