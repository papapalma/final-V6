import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useMessenger } from '../../contexts/MessengerContext';
import { messengerApi, Conversation, Message, MessageAttachment } from '../../services/messengerService';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { soundEffects } from '../../utils/audioChime';
import { getFileUrl } from '../../services/api';
import { Users, ArrowLeft, MessageSquare, Loader2 } from 'lucide-react';
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
    refreshConversations,
    startDMWithUser,
    syncNonce,
  } = useMessenger();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loadedConversationIdRef = useRef<string | null>(null);

  // Load conversation details and messages (show spinner only on conversation switch)
  useEffect(() => {
    let isMounted = true;
    const isConversationSwitch = loadedConversationIdRef.current !== conversationId;
    if (isConversationSwitch) {
      setIsLoading(true);
    }

    async function loadData() {
      try {
        const data = await messengerApi.getConversationMessages(conversationId);
        if (!isMounted) return;
        loadedConversationIdRef.current = conversationId;
        setConversation(data.conversation);
        setActiveMessages(data.messages);
        markConversationReadLocally(conversationId);
      } catch (err: any) {
        console.error('Failed to load conversation messages', err);
        if (isMounted && isConversationSwitch) {
          toast.error(err?.message || 'Failed to load conversation');
        }
      } finally {
        if (isMounted && isConversationSwitch) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [conversationId, syncNonce, setActiveMessages, markConversationReadLocally]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [activeMessages]);

  const canDirectMessageRole = (targetRole?: string): boolean => {
    if (!user) return false;
    // Trainees can only DM staff & administrators
    if (user.role === 'trainee' && targetRole === 'trainee') {
      return false;
    }
    return true;
  };

  const handleSendMessage = async (content: string, attachment?: MessageAttachment) => {
    if (!user) return;

    const tempId = `optimistic-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      conversationId,
      senderId: user.id,
      senderName: user.name || 'You',
      senderRole: user.role,
      content,
      attachmentUrl: attachment?.url,
      attachmentType: attachment?.type,
      attachmentName: attachment?.name,
      isDeleted: false,
      createdAt: new Date().toISOString(),
    };

    setActiveMessages((prev) => [...prev, optimisticMessage]);
    soundEffects.playMessageSent();

    try {
      const saved = await messengerApi.sendMessage(conversationId, content, attachment);
      if (!saved || !saved.id) {
        throw new Error('Failed to save message');
      }

      // Reconcile optimistic message cleanly even if SSE already delivered `saved.id`
      setActiveMessages((prev) => {
        const alreadyDelivered = prev.some((m) => m.id === saved.id);
        if (alreadyDelivered) {
          return prev.filter((m) => m.id !== tempId);
        }
        const hasTemp = prev.some((m) => m.id === tempId);
        return hasTemp
          ? prev.map((m) => (m.id === tempId ? saved : m))
          : [...prev, saved];
      });
      refreshConversations();
    } catch (err) {
      setActiveMessages((prev) => prev.filter((m) => m.id !== tempId));
      throw err;
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

      {/* Message Feed (harmonic padding) */}
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 pt-6 pb-4 sm:px-6">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-6 animate-spin text-primary opacity-70" />
          </div>
        ) : activeMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center text-muted-foreground">
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
          </div>
        ) : (
          activeMessages.map((msg, index) => {
            const isCurr = msg.senderId === user?.id;
            const prevMsg = activeMessages[index - 1];
            const showAvatar = isProgramGC && (!prevMsg || prevMsg.senderId !== msg.senderId);
            const allowStartDM = !isCurr && canDirectMessageRole(msg.senderRole);

            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                isCurrentUser={isCurr}
                onUnsend={handleUnsend}
                onStartDM={allowStartDM ? handleDirectMessageMember : undefined}
                showAvatar={showAvatar}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Toolbar */}
      <MessageInput
        conversationId={conversationId}
        onSendMessage={handleSendMessage}
        disabled={isLoading}
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
