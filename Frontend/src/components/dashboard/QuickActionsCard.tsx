import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { NotificationBadge } from '../ui/notification-badge';
import {
  Calendar,
  User,
  GraduationCap,
  ClipboardList,
  Pin,
  PinOff,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ATTENDANCE_PIN_EVENT,
  isDashboardAttendancePinned,
  setAttendancePinned,
} from '../../utils/attendancePin';

interface QuickActionItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  description?: string;
  gradient: string;
  iconBg: string;
  id?: string; // Add id to identify the action
}

interface TraineeProfile {
  id: string;
  first_name: string;
  last_name: string;
  [key: string]: any;
}

const allQuickActions: QuickActionItem[] = [
  {
    id: 'attendance',
    label: 'Attendance',
    href: '/trainee/attendance',
    icon: <Calendar className="h-5 w-5" />,
    description: 'Check attendance',
    gradient: 'from-blue-500/10 via-blue-400/5 to-transparent',
    iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600',
  },
  {
    id: 'profile',
    label: 'Profile',
    href: '/trainee/profile',
    icon: <User className="h-5 w-5" />,
    description: 'Edit profile',
    gradient: 'from-purple-500/10 via-purple-400/5 to-transparent',
    iconBg: 'bg-gradient-to-br from-purple-500 to-purple-600',
  },
  {
    id: 'programs',
    label: 'Programs',
    href: '/trainee/programs',
    icon: <GraduationCap className="h-5 w-5" />,
    description: 'Browse programs',
    gradient: 'from-emerald-500/10 via-emerald-400/5 to-transparent',
    iconBg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
  },
  {
    id: 'applications',
    label: 'Applications',
    href: '/trainee/applications',
    icon: <ClipboardList className="h-5 w-5" />,
    description: 'View applications',
    gradient: 'from-amber-500/10 via-amber-400/5 to-transparent',
    iconBg: 'bg-gradient-to-br from-amber-500 to-amber-600',
  },
];

interface QuickActionsCardProps {
  traineeProfile?: TraineeProfile | null;
  attendanceNeedsAction?: boolean;
  attendanceReminderHint?: string | null;
}

export default function QuickActionsCard({
  traineeProfile,
  attendanceNeedsAction = false,
  attendanceReminderHint,
}: QuickActionsCardProps) {
  const activeProgramId = traineeProfile?.program?.id || traineeProfile?.program_id;
  const [attendancePinned, setAttendancePinnedState] = useState<boolean>(() =>
    isDashboardAttendancePinned(activeProgramId)
  );

  useEffect(() => {
    const syncPinState = () => {
      setAttendancePinnedState(isDashboardAttendancePinned(activeProgramId));
    };

    syncPinState();
    window.addEventListener('storage', syncPinState);
    window.addEventListener(ATTENDANCE_PIN_EVENT, syncPinState);

    return () => {
      window.removeEventListener('storage', syncPinState);
      window.removeEventListener(ATTENDANCE_PIN_EVENT, syncPinState);
    };
  }, [activeProgramId]);

  const quickActions = allQuickActions.filter((action) =>
    action.id === 'attendance' ? attendancePinned : true
  );

  const handleUnpinAttendance = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAttendancePinned(false);
    setAttendancePinnedState(false);
    toast.success('Attendance unpinned from dashboard');
  };

  const handlePinAttendance = () => {
    setAttendancePinned(true, activeProgramId);
    setAttendancePinnedState(true);
    toast.success('Attendance pinned to dashboard');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-2xl font-bold">Quick Access</CardTitle>
          <CardDescription>Jump to your most-used sections</CardDescription>
        </div>
        {!attendancePinned && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePinAttendance}
            className="shrink-0 gap-1.5 py-2 px-3.5 text-xs"
          >
            <Pin className="size-3.5" />
            Pin Attendance
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          {quickActions.map((action) => {
            const showAttendanceDot = action.id === 'attendance' && attendanceNeedsAction;
            const actionAriaLabel = showAttendanceDot
              ? `${action.label} — ${attendanceReminderHint || 'attendance check-in needed today'}`
              : undefined;

            return (
              <div key={action.href} className="relative group">
                <Link to={action.href} aria-label={actionAriaLabel} className="block">
                  <div className="flex flex-col items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                    <div className="relative inline-flex shrink-0 p-2 rounded-lg bg-primary/10">
                      {React.cloneElement(action.icon as React.ReactElement<any>, {
                        className: 'h-5 w-5 text-primary',
                      })}
                      {action.id === 'attendance' && (
                        <NotificationBadge
                          variant="dot"
                          show={showAttendanceDot}
                          position="corner"
                          ringClassName="ring-card"
                          ariaLabel={
                            showAttendanceDot
                              ? attendanceReminderHint || 'Attendance check-in needed today'
                              : undefined
                          }
                        />
                      )}
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-center">{action.label}</span>
                  </div>
                </Link>
                {action.id === 'attendance' && (
                  <button
                    type="button"
                    onClick={handleUnpinAttendance}
                    aria-label="Unpin attendance from dashboard"
                    title="Unpin attendance"
                    className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-80 hover:bg-muted hover:text-foreground hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                  >
                    <PinOff className="size-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
