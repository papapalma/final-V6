import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useMessenger } from '../../contexts/MessengerContext';
import { ConversationList } from './ConversationList';
import { ChatThread } from './ChatThread';
import { NotificationBadge, formatBadgeAriaLabel } from '../ui/notification-badge';
import { MessageSquare, X } from 'lucide-react';

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

export const TraineeMessengerDrawer: React.FC = () => {
  const {
    isDrawerOpen,
    setIsDrawerOpen,
    totalUnreadCount,
    activeConversationId,
    setActiveConversationId,
  } = useMessenger();
  const prefersReducedMotion = useReducedMotion();

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
        whileHover={prefersReducedMotion ? undefined : { scale: 1.04 }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
        transition={{ duration: 0.14, ease: EASE_OUT }}
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

      {/* FAB-Anchored Floating Messenger Drawer */}
      <AnimatePresence>
        {isDrawerOpen && (
          <motion.div
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 16, scale: 0.94 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 16, scale: 0.94 }
            }
            transition={
              prefersReducedMotion
                ? { duration: 0.16, ease: 'easeOut' }
                : { type: 'spring', duration: 0.28, bounce: 0.08 }
            }
            style={{ transformOrigin: 'bottom right' }}
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

            {/* Directional List <-> Thread Navigation */}
            <div className="relative flex-1 overflow-hidden">
              <AnimatePresence mode="popLayout" initial={false}>
                {activeConversationId ? (
                  <motion.div
                    key={`thread-${activeConversationId}`}
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
                    transition={{ duration: prefersReducedMotion ? 0.15 : 0.2, ease: EASE_OUT }}
                    className="absolute inset-0"
                  >
                    <ChatThread
                      conversationId={activeConversationId}
                      onBack={handleBackToList}
                      showBackButton={true}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="conversation-list"
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -16 }}
                    transition={{ duration: prefersReducedMotion ? 0.15 : 0.2, ease: EASE_OUT }}
                    className="absolute inset-0"
                  >
                    <ConversationList
                      onSelectConversation={handleSelectConversation}
                      selectedConversationId={activeConversationId}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
