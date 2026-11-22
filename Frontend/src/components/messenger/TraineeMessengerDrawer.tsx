import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useMessenger } from '../../contexts/MessengerContext';
import { ConversationList } from './ConversationList';
import { ChatThread } from './ChatThread';
import { NotificationBadge, formatBadgeAriaLabel } from '../ui/notification-badge';
import { MessageSquare, X } from 'lucide-react';

export const TraineeMessengerDrawer: React.FC = () => {
  const {
    isDrawerOpen,
    setIsDrawerOpen,
    totalUnreadCount,
    activeConversationId,
    setActiveConversationId,
  } = useMessenger();

  const handleSelectConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
  };

  const handleBackToList = () => {
    setActiveConversationId(null);
  };

  const dockAriaLabel = formatBadgeAriaLabel(
    isDrawerOpen ? 'Close Messenger' : 'Open Messenger',
    totalUnreadCount,
    'unread message',
  );

  return (
    <>
      {/* Floating Messenger Dock Button (56px harmonic touch target) */}
      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsDrawerOpen(!isDrawerOpen)}
        className="fixed bottom-20 right-4 z-40 flex size-14 items-center justify-center overflow-visible rounded-full border border-white/20 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25 transition-shadow hover:shadow-xl hover:shadow-blue-600/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:bottom-6 sm:right-6 no-print"
        title={dockAriaLabel}
        aria-label={dockAriaLabel}
        aria-expanded={isDrawerOpen}
      >
        <MessageSquare className="size-6" />

        {/* Live Unread Badge */}
        <NotificationBadge
          variant="count"
          count={totalUnreadCount}
          position="corner"
          ringClassName="ring-background"
        />
      </motion.button>

      {/* Floating Messenger Drawer */}
      <AnimatePresence>
        {isDrawerOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{
              type: 'spring',
              damping: 26,
              stiffness: 300,
            }}
            role="dialog"
            aria-label="Messenger drawer"
            className="fixed bottom-[84px] right-3 left-3 z-40 flex h-[72dvh] max-h-[85dvh] w-auto flex-col overflow-hidden rounded-2xl border border-border bg-card/95 shadow-2xl backdrop-blur-xl sm:bottom-24 sm:left-auto sm:right-6 sm:h-[580px] sm:w-[380px] no-print"
          >
            {/* Drawer Header Bar (36px harmonic bar) */}
            <div className="flex h-9 w-full shrink-0 items-center justify-between border-b border-border bg-muted/60 px-3">
              <div className="size-6" />
              <div className="h-1 w-8 rounded-full bg-muted-foreground/30" />
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Close"
                aria-label="Close messenger"
              >
                <X className="size-3.5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="relative flex-1 overflow-hidden">
              {activeConversationId ? (
                <ChatThread
                  conversationId={activeConversationId}
                  onBack={handleBackToList}
                  showBackButton={true}
                />
              ) : (
                <ConversationList
                  onSelectConversation={handleSelectConversation}
                  selectedConversationId={activeConversationId}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
