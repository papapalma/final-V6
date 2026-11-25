import React, { useState, useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useMessenger } from '../../contexts/MessengerContext';
import { useAuth } from '../../contexts/AuthContext';
import { messengerApi, UserSummary } from '../../services/messengerService';
import { getFileUrl } from '../../services/api';
import { formatDistanceToNow } from 'date-fns';
import { Search, Plus, Users, MessageSquare, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { NotificationBadge, formatBadgeAriaLabel } from '../ui/notification-badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

interface ConversationListProps {
  onSelectConversation: (conversationId: string) => void;
  selectedConversationId?: string | null;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  onSelectConversation,
  selectedConversationId,
}) => {
  const { conversations, isLoading, startDMWithUser } = useMessenger();
  const { user } = useAuth();
  const prefersReducedMotion = useReducedMotion();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'program_group' | 'direct'>('all');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [contacts, setContacts] = useState<UserSummary[]>([]);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [startingContactId, setStartingContactId] = useState<string | null>(null);

  // Filter contacts by search query and sort staff/admin first
  const filteredContacts = useMemo(() => {
    let list = contacts;
    if (contactSearchQuery.trim()) {
      const q = contactSearchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          (c.name || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.role && c.role.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) => {
      const aIsStaff = a.role !== 'trainee';
      const bIsStaff = b.role !== 'trainee';
      if (aIsStaff && !bIsStaff) return -1;
      if (!aIsStaff && bIsStaff) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [contacts, contactSearchQuery]);

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      if (filterType !== 'all' && conv.type !== filterType) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = conv.title.toLowerCase().includes(query);
        const matchesSender = conv.latestMessage?.senderName.toLowerCase().includes(query);
        const matchesContent = conv.latestMessage?.content.toLowerCase().includes(query);
        return matchesTitle || matchesSender || matchesContent;
      }
      return true;
    });
  }, [conversations, filterType, searchQuery]);

  const handleOpenNewChatModal = async () => {
    setShowNewChatModal(true);
    setContactSearchQuery('');
    setLoadingContacts(true);
    setContactError(null);
    try {
      const data = await messengerApi.getContacts();
      setContacts(data || []);
    } catch (err: any) {
      console.error('Failed to load contacts:', err);
      setContactError(
        err?.message ||
          err?.response?.data?.error ||
          'Unable to load contacts. Please verify backend connectivity.'
      );
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleSelectContact = async (contactId: string) => {
    if (startingContactId) return;
    setStartingContactId(contactId);
    try {
      const convId = await startDMWithUser(contactId);
      if (convId) {
        setShowNewChatModal(false);
        onSelectConversation(convId);
      }
    } finally {
      setStartingContactId(null);
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-card">
      {/* Header (56px harmonic height, 24px desktop horizontal padding) */}
      <div className="z-10 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 sm:px-6">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="size-5 shrink-0 text-primary" />
          <span className="truncate text-base font-bold tracking-tight text-foreground">
            Messenger
          </span>
        </div>

        <Button
          size="sm"
          onClick={handleOpenNewChatModal}
          className="h-8 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-xs"
        >
          <Plus className="size-3.5 stroke-[2.5]" />
          <span>New Chat</span>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="shrink-0 px-4 pt-3 pb-2 sm:px-6">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            aria-label="Search conversations"
            className="h-9 rounded-xl pl-10 pr-3.5 text-base md:text-sm bg-muted/50 border-border focus-visible:bg-card"
          />
        </div>
      </div>

      {/* Segmented Filter Tabs */}
      <div className="shrink-0 px-4 pb-3 sm:px-6">
        <div className="flex h-9 gap-1 rounded-xl border border-border bg-muted p-1" role="tablist" aria-label="Filter conversations">
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'program_group', label: 'Program GCs' },
              { key: 'direct', label: 'Direct' },
            ] as const
          ).map((tab) => {
            const isActive = filterType === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setFilterType(tab.key)}
                className={`relative flex flex-1 items-center justify-center rounded-lg px-2 text-xs whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive
                    ? 'font-semibold text-foreground'
                    : 'font-medium text-muted-foreground hover:text-foreground'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="messenger-filter-pill"
                    aria-hidden="true"
                    transition={
                      prefersReducedMotion
                        ? { duration: 0.12 }
                        : { type: 'spring', duration: 0.22, bounce: 0 }
                    }
                    className="absolute inset-0 rounded-lg bg-card shadow-xs"
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1 overscroll-contain">
        {isLoading ? (
          <div className="flex justify-center px-6 py-8">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary shadow-xs">
              <MessageSquare className="size-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {user?.role === 'trainee' ? 'Connect with Staff & Admins' : 'No conversations found'}
              </p>
              <p className="mt-1.5 max-w-[260px] text-xs leading-relaxed text-muted-foreground">
                {user?.role === 'trainee'
                  ? 'Send a direct message to your instructors, training coordinators, or administrators.'
                  : 'Start a direct message with any trainee or staff member.'}
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleOpenNewChatModal}
              className="mt-1 rounded-full px-4 py-2 text-xs font-semibold shadow-xs"
            >
              <Plus className="size-3.5 stroke-[2.5]" />
              <span>{user?.role === 'trainee' ? 'Message Staff & Admin' : 'Start New Message'}</span>
            </Button>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isSelected = selectedConversationId === conv.id;
            const isGC = conv.type === 'program_group';
            const otherUser = conv.otherUser;

            let relativeTime = '';
            try {
              if (conv.lastMessageAt) {
                relativeTime = formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: false });
              }
            } catch {
              // Ignore malformed timestamps
            }

            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => onSelectConversation(conv.id)}
                aria-label={
                  conv.unreadCount > 0
                    ? formatBadgeAriaLabel(conv.title, conv.unreadCount, 'unread message')
                    : undefined
                }
                className={`messenger-press-row flex w-full items-center gap-3 rounded-xl border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isSelected
                    ? 'border-primary/30 bg-accent/70 dark:bg-primary/15'
                    : 'border-transparent bg-transparent hover:bg-muted/70'
                }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  {isGC ? (
                    <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-xs">
                      <Users className="size-5" />
                    </div>
                  ) : (
                    <Avatar className="size-10 border border-border">
                      <AvatarImage src={otherUser?.avatar ? getFileUrl(otherUser.avatar) : undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-emerald-600 to-teal-600 text-xs font-bold text-white">
                        {otherUser?.name?.slice(0, 2).toUpperCase() || 'DM'}
                      </AvatarFallback>
                    </Avatar>
                  )}

                  {isGC && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card bg-primary"
                    />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <h3 className="truncate text-sm font-semibold text-foreground">
                      {conv.title}
                    </h3>
                    {relativeTime && (
                      <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                        {relativeTime}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-muted-foreground">
                      {conv.latestMessage ? (
                        <span>
                          <strong className="font-semibold text-foreground/80">
                            {conv.latestMessage.senderId === user?.id
                              ? 'You: '
                              : `${conv.latestMessage.senderName.split(' ')[0]}: `}
                          </strong>
                          {conv.latestMessage.content || 'Sent an attachment'}
                        </span>
                      ) : (
                        <span className="italic opacity-70">No messages yet</span>
                      )}
                    </p>

                    <NotificationBadge
                      variant="count"
                      count={conv.unreadCount}
                      position="inline"
                      ringClassName="ring-card"
                    />
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* New Chat Contacts Modal */}
      <Dialog open={showNewChatModal} onOpenChange={setShowNewChatModal}>
        <DialogContent className="w-[92vw] sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 pr-8">
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                <Plus className="size-4 text-primary" />
                <span>Start a Direct Message</span>
              </DialogTitle>
              {!loadingContacts && contacts.length > 0 && (
                <Badge variant="secondary" className="text-xs font-semibold">
                  {contacts.length} Contacts
                </Badge>
              )}
            </div>
          </DialogHeader>

          {/* Contact Search Box */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={contactSearchQuery}
              onChange={(e) => setContactSearchQuery(e.target.value)}
              placeholder="Search staff, admin, or trainee name..."
              aria-label="Search contacts"
              className="pl-10"
            />
          </div>

          <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
            {loadingContacts ? (
              <div className="flex flex-col items-center gap-2 px-6 py-12">
                <Loader2 className="size-6 animate-spin text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Loading contacts...</span>
              </div>
            ) : contactError ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm font-semibold text-destructive">
                  Failed to load contacts
                </p>
                <p className="mt-1 mb-4 text-xs text-muted-foreground">
                  {contactError}
                </p>
                <Button size="sm" variant="outline" onClick={handleOpenNewChatModal}>
                  Retry Loading
                </Button>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-semibold text-foreground">
                  No matching contacts found.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {contactSearchQuery ? 'Try adjusting your search keywords.' : 'No available contacts found in your directory.'}
                </p>
              </div>
            ) : (
              filteredContacts.map((contact) => {
                const isStaff = contact.role !== 'trainee';
                const isStarting = startingContactId === contact.id;
                return (
                  <button
                    key={contact.id}
                    type="button"
                    disabled={Boolean(startingContactId)}
                    onClick={() => handleSelectContact(contact.id)}
                    className="messenger-press-row flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-transparent px-3.5 py-2.5 text-left hover:border-primary/40 hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="size-10 shrink-0 border border-border">
                        <AvatarImage src={contact.avatar ? getFileUrl(contact.avatar) : undefined} />
                        <AvatarFallback
                          className={`text-xs font-bold text-white ${
                            isStaff
                              ? 'bg-gradient-to-br from-blue-600 to-indigo-600'
                              : 'bg-gradient-to-br from-emerald-600 to-teal-600'
                          }`}
                        >
                          {(contact.name || 'U').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 text-left">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {contact.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {contact.email}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 capitalize text-[10px] font-semibold ${
                        isStaff
                          ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                      }`}
                    >
                      {isStarting ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : contact.role ? (
                        contact.role.replace(/_/g, ' ')
                      ) : (
                        'User'
                      )}
                    </Badge>
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
