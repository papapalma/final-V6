import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { useMessenger } from '../../contexts/MessengerContext';
import { messengerApi, Conversation, MessageAttachment } from '../../services/messengerService';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { getFileUrl } from '../../services/api';
import { Users, ArrowLeft, ArrowDown, MessageSquare } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

interface ChatThreadProps {
  conversationId: string;
  onBack?: () => void;
  showBackButton?: boolean;
}

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
const STICKY_BOTTOM_THRESHOLD_PX = 120;

export const ChatThread: React.FC<ChatThreadProps> = ({
  conversationId,
  onBack,
  showBackButton = false,
}) => {
  const { user } = useAuth();
  const {
    activeMessages,
    setActiveMessages,
    markConversationReadLocally,
    startDMWithUser,
    syncNonce,
    getCachedThread,
    setCachedThread,
    sendMessage,
    retryMessage,
  } = useMessenger();

  const prefersReducedMotion = useReducedMotion();

  const [conversation, setConversation] = useState<Conversation | null>(
    () => getCachedThread?.(conversationId)?.conversation ?? null
  );
  const [isLoading, setIsLoading] = useState<boolean>(
    () => !getCachedThread?.(conversationId)
  );
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [unseenBelowCount, setUnseenBelowCount] = useState(0);

  const feedRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loadedConversationIdRef = useRef<string | null>(null);
  const isNearBottomRef = useRef<boolean>(true);
  const prevMsgCountRef = useRef<number>(0);

  // Hydrate immediately from client cache (0ms), then revalidate silently from server
  useEffect(() => {
    let isMounted = true;
    const isConversationSwitch = loadedConversationIdRef.current !== conversationId;

    if (isConversationSwitch) {
      isNearBottomRef.current = true;
      setShowJumpToLatest(false);
      setUnseenBelowCount(0);
      prevMsgCountRef.current = 0;

      const cached = getCachedThread?.(conversationId);
      if (cached) {
        setConversation(cached.conversation);
        setActiveMessages(cached.messages);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }
    }

    async function loadData() {
      try {
        const data = await messengerApi.getConversationMessages(conversationId);
        if (!isMounted) return;
        loadedConversationIdRef.current = conversationId;
        setConversation(data.conversation);
        const merged = setCachedThread
          ? setCachedThread(conversationId, data.conversation, data.messages)
          : data.messages;
        setActiveMessages(merged);
        markConversationReadLocally(conversationId);
      } catch (err: any) {
        console.error('Failed to load conversation messages', err);
        if (isMounted && isConversationSwitch && !getCachedThread?.(conversationId)) {
          toast.error(err?.message || 'Failed to load conversation');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [
    conversationId,
    syncNonce,
    setActiveMessages,
    markConversationReadLocally,
    getCachedThread,
    setCachedThread,
  ]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const effectiveBehavior: ScrollBehavior = prefersReducedMotion ? 'auto' : behavior;
    messagesEndRef.current?.scrollIntoView?.({ behavior: effectiveBehavior });
    isNearBottomRef.current = true;
    setShowJumpToLatest(false);
    setUnseenBelowCount(0);
  };

  // Track user scroll position so incoming messages never hijack reading history
  const handleFeedScroll = () => {
    const el = feedRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom <= STICKY_BOTTOM_THRESHOLD_PX;
    isNearBottomRef.current = nearBottom;
    if (nearBottom) {
      setShowJumpToLatest(false);
      setUnseenBelowCount(0);
    } else {
      setShowJumpToLatest(true);
    }
  };

  // Smart sticky-bottom auto-scroll on new messages
  useEffect(() => {
    const prevCount = prevMsgCountRef.current;
    const currentCount = activeMessages.length;
    prevMsgCountRef.current = currentCount;

    if (currentCount === 0) return;

    // Initial load for this thread: jump directly to latest without slow scroll
    if (prevCount === 0) {
      messagesEndRef.current?.scrollIntoView?.({ behavior: 'auto' });
      return;
    }

    if (currentCount > prevCount) {
      const latest = activeMessages[currentCount - 1];
      const isOwnMessage = latest?.senderId === user?.id;

      if (isOwnMessage || isNearBottomRef.current) {
        scrollToBottom('smooth');
      } else {
        setShowJumpToLatest(true);
        setUnseenBelowCount((c) => c + (currentCount - prevCount));
      }
    }
  }, [activeMessages, user?.id]);

  const canDirectMessageRole = (targetRole?: string): boolean => {
    if (!user) return false;
    if (user.role === 'trainee' && targetRole === 'trainee') {
      return false;
    }
    return true;
  };

  const handleSendMessage = (content: string, attachment?: MessageAttachment) => {
    if (!user) return;
    if (sendMessage) {
      void sendMessage(conversationId, content, attachment);
      return;
    }
    // Fallback for isolated test harnesses mocking useMessenger without sendMessage
    void messengerApi.sendMessage(conversationId, content, attachment);
  };

  const handleRetryMessage = (clientKey: string) => {
    if (retryMessage) {
      void retryMessage(conversationId, clientKey);
    }
  };

  const handleUnsend = async (messageId: string) => {
    try {
      await messengerApi.unsendMessage(conversationId, messageId);
      setActiveMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, isDeleted: true, content: 'This message was unsent', attachmentUrl: null }
            : m
        )
      );
    } catch (err: any) {
      toast.error(err?.message || 'Failed to unsend message');
    }
  };

  const handleDirectMessageMember = async (targetUserId: string) => {
    setShowMembersModal(false);
    await startDMWithUser(targetUserId);
  };

  const isProgramGC = conversation?.type === 'program_group';
  const otherUser = conversation?.otherUser;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header (56px harmonic height, 24px desktop horizontal padding) */}
      <div className="z-10 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          {showBackButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              aria-label="Back to conversations"
              title="Back"
              className="size-8 rounded-full text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
            </Button>
          )}

          {/* Avatar */}
          {isProgramGC ? (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs">
              <Users className="size-4" />
            </div>
          ) : (
            <Avatar className="size-8 shrink-0 border border-border shadow-xs">
              <AvatarImage src={otherUser?.avatar ? getFileUrl(otherUser.avatar) : undefined} />
              <AvatarFallback className="bg-gradient-to-tr from-emerald-600 to-teal-600 text-xs font-medium text-white">
                {otherUser?.name?.slice(0, 2).toUpperCase() || 'DM'}
              </AvatarFallback>
            </Avatar>
          )}

          {/* Title and metadata */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-sm font-semibold text-foreground">
                {conversation?.title || 'Loading chat...'}
              </h2>
              {isProgramGC && (
                <Badge variant="outline" className="h-4 border-primary/30 px-1.5 py-0 text-[10px] text-primary">
                  Program GC
                </Badge>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {isProgramGC
                ? `${conversation?.participants?.length || 0} participants (Trainees & Instructors)`
                : otherUser?.role ? otherUser.role.replace(/_/g, ' ') : 'Direct Message'}
            </p>
          </div>
        </div>

        {/* Action: Program GC Members list */}
        {isProgramGC && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMembersModal(true)}
            className="h-8 rounded-full px-3 text-xs"
          >
            <Users className="size-3.5 text-primary" />
            Members
          </Button>
        )}
      </div>

      {/* Message Feed Container (relative wrapper for floating Jump-to-latest pill) */}
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={feedRef}
          onScroll={handleFeedScroll}
          className="flex h-full flex-col gap-1 overflow-y-auto px-4 pt-6 pb-4 sm:px-6 overscroll-contain"
        >
          {isLoading && activeMessages.length === 0 ? (
            /* Lightweight chat-bubble shimmer skeleton on cold cache miss */
            <div className="flex flex-col gap-3 py-2" aria-label="Loading messages">
              <div className="flex justify-start">
                <div className="messenger-shimmer h-11 w-48 rounded-2xl rounded-bl-xs bg-muted" />
              </div>
              <div className="flex justify-end">
                <div className="messenger-shimmer h-10 w-56 rounded-2xl rounded-br-xs bg-primary/15" />
              </div>
              <div className="flex justify-start">
                <div className="messenger-shimmer h-14 w-64 rounded-2xl rounded-bl-xs bg-muted" />
              </div>
              <div className="flex justify-end">
                <div className="messenger-shimmer h-10 w-40 rounded-2xl rounded-br-xs bg-primary/15" />
              </div>
            </div>
          ) : activeMessages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18, ease: EASE_OUT }}
              className="flex h-full flex-col items-center justify-center p-6 text-center text-muted-foreground"
            >
              <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <MessageSquare className="size-6" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                No messages yet
              </p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed">
                {isProgramGC
                  ? 'Welcome to the Program Group Chat! Send a message to communicate with instructors and classmates.'
                  : 'Send a private message to start this 1-on-1 direct conversation.'}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={conversationId}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18, ease: EASE_OUT }}
              className="flex flex-col gap-1"
            >
              {activeMessages.map((msg, index) => {
                const isCurr = msg.senderId === user?.id;
                const prevMsg = activeMessages[index - 1];
                const showAvatar = isProgramGC && (!prevMsg || prevMsg.senderId !== msg.senderId);
                const allowStartDM = !isCurr && canDirectMessageRole(msg.senderRole);

                return (
                  <MessageBubble
                    key={msg.clientKey || msg.id}
                    message={msg}
                    isCurrentUser={isCurr}
                    onUnsend={handleUnsend}
                    onStartDM={allowStartDM ? handleDirectMessageMember : undefined}
                    onRetry={handleRetryMessage}
                    showAvatar={showAvatar}
                  />
                );
              })}
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Floating Jump-to-Latest / New Messages Pill */}
        <AnimatePresence>
          {showJumpToLatest && (
            <motion.button
              type="button"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              transition={{ duration: prefersReducedMotion ? 0.14 : 0.16, ease: EASE_OUT }}
              onClick={() => scrollToBottom('smooth')}
              className="messenger-press-row absolute bottom-3 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-card/95 px-3.5 py-1.5 text-xs font-semibold text-foreground shadow-md backdrop-blur-md hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>
                {unseenBelowCount > 0
                  ? `${unseenBelowCount} new ${unseenBelowCount === 1 ? 'message' : 'messages'}`
                  : 'Jump to latest'}
              </span>
              <ArrowDown className="size-3.5 text-primary" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Message Input Toolbar */}
      <MessageInput
        conversationId={conversationId}
        onSendMessage={handleSendMessage}
        disabled={isLoading && activeMessages.length === 0}
      />

      {/* Members Modal (Role-scoped DM triggers) */}
      <Dialog open={showMembersModal} onOpenChange={setShowMembersModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-primary" />
              Program GC Participants
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {[...(conversation?.participants || [])]
              .sort((a, b) => {
                const aIsStaff = a.role !== 'trainee';
                const bIsStaff = b.role !== 'trainee';
                if (aIsStaff && !bIsStaff) return -1;
                if (!aIsStaff && bIsStaff) return 1;
                return (a.name || '').localeCompare(b.name || '');
              })
              .map((participant) => {
                const isSelf = participant.id === user?.id;
                const isStaff = participant.role !== 'trainee';
                const allowMemberDM = !isSelf && canDirectMessageRole(participant.role);

                return (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="size-8 shrink-0">
                        <AvatarImage src={participant.avatar ? getFileUrl(participant.avatar) : undefined} />
                        <AvatarFallback
                          className={`text-xs font-bold text-white ${
                            isStaff ? 'bg-primary' : 'bg-emerald-600'
                          }`}
                        >
                          {(participant.name || 'U').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-semibold text-foreground">
                            {participant.name} {isSelf && '(You)'}
                          </span>
                          {isStaff && (
                            <Badge className="h-4 px-1.5 py-0 text-[9px] font-medium">
                              {participant.role === 'super_admin'
                                ? 'Super Admin'
                                : participant.role === 'local_admin'
                                ? 'Admin'
                                : 'Staff'}
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground">{participant.email}</p>
                      </div>
                    </div>

                    {allowMemberDM && (
                      <Button
                        size="sm"
                        variant={isStaff ? 'default' : 'ghost'}
                        onClick={() => handleDirectMessageMember(participant.id)}
                        className="h-8 shrink-0 px-3 text-xs"
                      >
                        <MessageSquare className="size-3.5" />
                        {isStaff ? 'Message Staff' : 'Message'}
                      </Button>
                    )}
                  </div>
                );
              })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
