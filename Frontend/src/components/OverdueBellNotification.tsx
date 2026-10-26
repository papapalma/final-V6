import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Bell } from 'lucide-react';
import notificationService, { type InAppNotification } from '../services/notificationService';
import NotificationsModal from './NotificationsModal';
import logger from '../utils/logger';
import { useAuth } from '../contexts/AuthContext';

export default function OverdueBellNotification() {
  const { user, isAuthenticated, isAuthReady } = useAuth();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  // The backend applies the same role filter to the notification feed.
  const shouldShow = isAuthenticated && user &&
    ['super_admin', 'local_admin', 'staff_inventory_manager', 'staff_training_coordinator'].includes(user.role);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    if (!shouldShow) {
      return;
    }

    fetchNotifications();
    
    // Check for overdue items every 5 minutes
    const interval = setInterval(() => {
      fetchNotifications();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [shouldShow, isAuthReady]);

  const fetchNotifications = async () => {
    try {
      const response = await notificationService.getNotifications();
      setNotifications(response.notifications || []);
      setUnreadCount(response.unreadCount ?? response.notifications?.length ?? 0);
    } catch (error) {
      const status = (error as any)?.status ?? (error as any)?.response?.status;
      if (status !== 403 && status !== 404) {
        logger.error('Failed to fetch overdue items for bell notification', { error });
      }
    }
  };

  const handleBellClick = () => {
    setModalOpen(true);
  };

  if (!shouldShow) {
    return null;
  }

  const notificationCount = unreadCount;
  const hasOverdue = notifications.some((notification) => notification.type === 'overdue');

  return (
    <>
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBellClick}
          aria-label={`${notificationCount} notification${notificationCount !== 1 ? 's' : ''}`}
          className="relative hover:bg-primary/10"
          title={`${notificationCount} notification${notificationCount !== 1 ? 's' : ''}`}
        >
          <motion.div
            animate={notificationCount > 0 ? { rotate: [0, -10, 10, -8, 8, -4, 0] } : { rotate: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            <Bell className={`size-5 transition-colors ${notificationCount > 0 || hasOverdue ? 'text-[#FF3B30] dark:text-[#FF453A]' : ''}`} />
          </motion.div>
          <AnimatePresence>
            {notificationCount > 0 && (
              <motion.div
                key={`badge-${notificationCount}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 24 }}
                className="absolute -top-1 -right-1 flex items-center justify-center"
              >
                {hasOverdue && (
                  <motion.span
                    animate={{ scale: [1, 1.45, 1], opacity: [0.65, 0, 0.65] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 size-full rounded-full bg-[#FF3B30] pointer-events-none"
                  />
                )}
                <Badge
                  style={{ backgroundColor: '#FF3B30', color: '#ffffff' }}
                  className="notif-badge-red relative flex h-5 min-w-5 items-center justify-center rounded-full border-none bg-red-600 px-1 text-[10px] font-semibold tabular-nums text-white ring-2 ring-card shadow-[0_2px_6px_rgba(255,59,48,0.45)]"
                >
                  {notificationCount > 99 ? '99+' : notificationCount}
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </div>

      <NotificationsModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        notifications={notifications}
      />
    </>
  );
}
