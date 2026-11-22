import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from './ui/button';
import { NotificationBadge, formatBadgeAriaLabel } from './ui/notification-badge';
import { Bell } from 'lucide-react';
import notificationService, { type InAppNotification } from '../services/notificationService';
import NotificationsModal from './NotificationsModal';
import logger from '../utils/logger';
import { useAuth } from '../contexts/AuthContext';

const SEEN_STORAGE_PREFIX = 'bmdc-seen-notifications';
const MAX_STORED_SEEN_IDS = 200;

// shortcut: client-side seen-ID persistence does not sync across browsers/devices; upgrade to a backend /api/notifications/read endpoint when multi-device sync is needed.
function getSeenStorageKey(tenantId: string | undefined, userId: string): string {
  return `${SEEN_STORAGE_PREFIX}:${tenantId || 'global'}:${userId}`;
}

function readSeenIds(storageKey: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

function writeSeenIds(storageKey: string, ids: Set<string>): void {
  try {
    const bounded = Array.from(ids).slice(-MAX_STORED_SEEN_IDS);
    window.localStorage.setItem(storageKey, JSON.stringify(bounded));
  } catch {
    // Ignore storage quota or private-browsing errors; in-memory state remains active.
  }
}

export default function OverdueBellNotification() {
  const { user, isAuthenticated, isAuthReady } = useAuth();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(() => new Set());
  const [sessionUnreadIds, setSessionUnreadIds] = useState<ReadonlySet<string>>(() => new Set());
  const [modalOpen, setModalOpen] = useState(false);

  // The backend applies the same role filter to the notification feed.
  const shouldShow =
    isAuthenticated &&
    Boolean(user) &&
    ['super_admin', 'local_admin', 'staff_inventory_manager', 'staff_training_coordinator'].includes(user!.role);

  const storageKey = user?.id ? getSeenStorageKey(user.tenantId, user.id) : null;

  useEffect(() => {
    if (!storageKey) {
      setSeenIds(new Set());
      return;
    }
    setSeenIds(readSeenIds(storageKey));
  }, [storageKey]);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await notificationService.getNotifications();
      setNotifications(response.notifications || []);
    } catch (error) {
      const status = (error as any)?.status ?? (error as any)?.response?.status;
      if (status !== 403 && status !== 404) {
        logger.error('Failed to fetch overdue items for bell notification', { error });
      }
    }
  }, []);

  useEffect(() => {
    if (!isAuthReady || !shouldShow) {
      return;
    }

    fetchNotifications();

    // Check for new notifications every 5 minutes
    const interval = window.setInterval(() => {
      fetchNotifications();
    }, 5 * 60 * 1000);

    return () => window.clearInterval(interval);
  }, [shouldShow, isAuthReady, fetchNotifications]);

  const unreadIds = useMemo(() => {
    const next = new Set<string>();
    for (const notification of notifications) {
      if (!seenIds.has(notification.id)) {
        next.add(notification.id);
      }
    }
    return next;
  }, [notifications, seenIds]);

  const unreadCount = unreadIds.size;

  const handleBellClick = () => {
    // Snapshot which items were unread before immediately clearing the badge on open.
    setSessionUnreadIds(new Set(unreadIds));

    if (notifications.length > 0) {
      setSeenIds((prev) => {
        const next = new Set(prev);
        for (const notification of notifications) {
          next.add(notification.id);
        }
        if (storageKey) {
          writeSeenIds(storageKey, next);
        }
        return next;
      });
    }

    setModalOpen(true);
  };

  if (!shouldShow) {
    return null;
  }

  const buttonLabel = formatBadgeAriaLabel('Notifications', unreadCount, 'unread notification');

  return (
    <>
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBellClick}
          aria-label={buttonLabel}
          className="relative overflow-visible hover:bg-primary/10"
          title={buttonLabel}
        >
          <Bell className={`size-5 transition-colors ${unreadCount > 0 ? 'text-red-600 dark:text-red-400' : ''}`} />
          <NotificationBadge
            variant="count"
            count={unreadCount}
            position="corner"
            ringClassName="ring-card"
          />
        </Button>
      </div>

      <NotificationsModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        notifications={notifications}
        unreadIds={sessionUnreadIds}
      />
    </>
  );
}
