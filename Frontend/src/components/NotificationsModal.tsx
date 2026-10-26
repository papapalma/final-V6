import { Link } from 'react-router-dom';
import { Bell, Clock, Package } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import type { InAppNotification } from '../services/notificationService';

interface NotificationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notifications: InAppNotification[];
}

export default function NotificationsModal({ open, onOpenChange, notifications }: NotificationsModalProps) {
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
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
            <Bell className="size-10 opacity-40" />
            <p>No notifications available.</p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {notifications.map((notification) => (
              <Link
                key={notification.id}
                to={notification.href}
                onClick={() => onOpenChange(false)}
                className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted"
              >
                <div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full transition-colors ${notification.type === 'overdue' ? 'bg-[#FF3B30]/15 text-[#FF3B30] dark:bg-[#FF453A]/20 dark:text-[#FF453A]' : 'bg-primary/10 text-primary'}`}>
                  {notification.type === 'overdue' ? <Package className="size-4" /> : <Bell className="size-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{notification.title}</p>
                    {notification.type === 'overdue' && (
                      <Badge
                        style={{ backgroundColor: '#FF3B30', color: '#ffffff' }}
                        className="notif-badge-red border-none bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold shadow-sm"
                      >
                        Overdue
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
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
