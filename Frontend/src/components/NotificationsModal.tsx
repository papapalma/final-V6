import { Link } from 'react-router-dom';
import { Bell, Calendar, Clock, Package } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import type { InAppNotification } from '../services/notificationService';

interface NotificationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notifications: InAppNotification[];
  unreadIds?: ReadonlySet<string>;
}

export default function NotificationsModal({
  open,
  onOpenChange,
  notifications,
  unreadIds,
}: NotificationsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-w-2xl flex-col overflow-hidden p-4 sm:p-6"
        style={{
          width: 'min(90vw, 42rem)',
          height: 'calc(100vh - 4rem)',
          maxHeight: 'calc(100vh - 4rem)',
        }}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Bell className="size-5" />
            Notifications
          </DialogTitle>
          <DialogDescription>
            Updates relevant to your role and current organization.
          </DialogDescription>
        </DialogHeader>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
            <Bell className="size-10 opacity-40" />
            <p>No notifications available.</p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {notifications.map((notification) => {
              const isNew = unreadIds?.has(notification.id) ?? false;
              const isOverdue = notification.type === 'overdue';
              const isAttendance = notification.type === 'attendance';

              return (
                <Link
                  key={notification.id}
                  to={notification.href}
                  onClick={() => onOpenChange(false)}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted ${
                    isNew || isAttendance
                      ? 'border-l-2 border-l-red-600 bg-red-50/40 dark:bg-red-950/20'
                      : ''
                  }`}
                >
                  <div
                    className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full transition-colors ${
                      isOverdue || isAttendance
                        ? 'bg-red-600/15 text-red-600 dark:bg-red-500/20 dark:text-red-400'
                        : 'bg-primary/10 text-primary'
                    }`}
                  >
                    {isOverdue ? (
                      <Package className="size-4" />
                    ) : isAttendance ? (
                      <Calendar className="size-4" />
                    ) : (
                      <Bell className="size-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{notification.title}</p>
                      {isNew && (
                        <Badge
                          variant="secondary"
                          className="border-red-200 bg-red-100 text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300 text-[11px] font-semibold"
                        >
                          New
                        </Badge>
                      )}
                      {isOverdue && (
                        <Badge className="border-none bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold shadow-xs">
                          Overdue
                        </Badge>
                      )}
                      {isAttendance && (
                        <Badge className="border-none bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold shadow-xs">
                          Attendance
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{notification.description}</p>
                    <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
