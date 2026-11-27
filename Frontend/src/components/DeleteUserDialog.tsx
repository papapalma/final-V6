import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { AlertCircle, Archive, ShieldAlert } from 'lucide-react';
import { getRoleBadgeColor, getRoleDisplayName } from '../utils/roles';
import type { User } from '../services/userService';

interface DeleteUserDialogProps {
  open: boolean;
  user: User | null;
  isDeleting: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export default function DeleteUserDialog({
  open,
  user,
  isDeleting,
  onConfirm,
  onCancel,
}: DeleteUserDialogProps) {
  if (!user) return null;

  const isTraineeAccount = user.role === 'trainee';

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !isDeleting) {
      onCancel();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="att-modal-panel sm:max-w-[460px] p-6 gap-4"
        onEscapeKeyDown={(e) => {
          if (isDeleting) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (isDeleting) e.preventDefault();
        }}
      >
        <DialogHeader className="space-y-1.5 text-left">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold leading-tight text-destructive">
            <AlertCircle className="size-5 shrink-0" />
            <span>Archive User Account?</span>
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            Portal access will be revoked immediately, while audit and activity records stay preserved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Target account summary card */}
          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/50 p-3">
            <Avatar className="size-10 shrink-0">
              <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                {user.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="truncate text-sm font-semibold text-foreground">{user.username}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <Badge
              className={`${getRoleBadgeColor(user.role)} shrink-0 py-0.5 px-2 text-xs`}
              style={
                isTraineeAccount
                  ? { backgroundColor: '#2563eb', color: 'white', borderColor: '#1e40af' }
                  : undefined
              }
            >
              {getRoleDisplayName(user.role)}
            </Badge>
          </div>

          {/* Soft-delete assurance callout */}
          <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-3 space-y-1.5 text-sm leading-relaxed">
            <p className="font-medium text-destructive">
              Active sessions for <span className="font-semibold">{user.username}</span> will be signed out right away.
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>Soft-delete:</strong> This account moves to <strong>Archive → User Accounts</strong> and can be restored by an administrator within 30 days.
            </p>
          </div>

          {/* Independent trainee profile notice */}
          {isTraineeAccount && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-300/70 bg-amber-50/80 dark:border-amber-800/70 dark:bg-amber-950/30 p-3 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p>
                <strong>Portal login only:</strong> Archiving this user account revokes login access without deleting their trainee profile, enrollments, or attendance records.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isDeleting}
            className="py-2 px-3.5"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void onConfirm()}
            disabled={isDeleting}
            className="py-2 px-4"
          >
            {isDeleting ? (
              <>
                <span className="mr-2 inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Archiving...
              </>
            ) : (
              <>
                <Archive className="mr-2 size-4" />
                Archive Account
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
