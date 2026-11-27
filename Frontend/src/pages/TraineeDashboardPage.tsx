import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import { Button } from '../components/ui/button';





import { 
  GraduationCap, 
  Calendar, 
  Clock, 
  Award, 
  BookOpen,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MapPin,
  User as UserIcon,
  TrendingUp,
  CalendarX,
  WifiOff,
  Bell,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Settings as SettingsIcon, Download as DownloadIcon } from 'lucide-react';
import { isStandalone, canInstallPWA, promptPWAInstall, subscribeInstallPrompt } from '../utils/pwa';
import {
  isPushNotificationSupported,
  requestNotificationPermission,
  subscribeToPushNotifications,
  syncPushSubscriptions,
} from '../utils/pushSubscription';
import { ATTENDANCE_UPDATED_EVENT } from '../components/OverdueBellNotification';
import { getFileUrl } from '../services/api';
import traineeService from '../services/traineeService';
import programService from '../services/programService';
import { toast } from 'sonner';
import logger from '../utils/logger';
import { CardGridSkeleton, ListSkeleton, DashboardSkeletonLoader } from '../components/LoadingSkeletons';
import { Skeleton } from '../components/ui/skeleton';
import { offlineManager } from '../utils/offlineManager';
import { STORES } from '../utils/offlineDB';
import QuickActionsCard from '../components/dashboard/QuickActionsCard';
import ActiveProgramsCard from '../components/dashboard/ActiveProgramsCard';
import ProgressSummaryCard from '../components/dashboard/ProgressSummaryCard';
import UpcomingEventsCard from '../components/dashboard/UpcomingEventsCard';
import { DashboardErrorState } from '../components/EmptyStates';

interface AttendanceStats {
  total_sessions: number;
  present_count: number;
  late_count: number;
  absent_count: number;
  attendance_rate: number;
}

interface Attendance {
  id: string;
  status: string;
  check_in_time: string;
  check_out_time?: string;
  created_at: string;
  program_sessions?: {
    session_date: string;
    start_time: string;
    end_time: string;
    programs?: {
      name: string;
    };
  };
}

interface ProgramSession {
  id: string;
  program_id: string;
  session_number: number;
  date: string;
  session_date?: string;
  start_time: string;
  end_time: string;
  topic?: string;
  title?: string;
  description?: string;
  location?: string;
  session_type?: string;
  is_excluded_date?: boolean;
}

interface ExcludedDate {
  id: string;
  date: string;
  reason: string;
  description?: string;
}

interface TraineeProfile {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  email: string;
  phone: string;
  photo_path?: string;
  program_id?: string;
  status: string;
  enrollment_date: string;
  program?: {
    id: string;
    name: string;
    description: string;
    start_date: string;
    end_date: string;
    status: string;
    instructor?: string | null;
    duration_weeks?: number;
    max_trainees?: number;
  };
}

interface TodayAttendanceStatus {
  date: string;
  hasSession: boolean;
  isExcludedDay: boolean;
  sessionId: string | null;
  sessionTitle: string | null;
  programId: string | null;
  programName: string | null;
  morningDone: boolean;
  afternoonDone: boolean;
  needsAttendance: boolean;
  pendingSessionLabel: 'morning' | 'afternoon' | null;
  windowOpen: boolean;
  windowSessionLabel: 'morning' | 'afternoon' | null;
  windowOpenTime: string | null;
  windowCloseTime: string | null;
  secondsUntilOpen: number | null;
  secondsUntilClose: number | null;
}

export default function TraineeDashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [traineeProfile, setTraineeProfile] = useState<TraineeProfile | null>(null);
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStats | null>(null);
  const [_recentAttendance, setRecentAttendance] = useState<Attendance[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<ProgramSession[]>([]);
  const [excludedDates, setExcludedDates] = useState<ExcludedDate[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendanceStatus | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [enablingPush, setEnablingPush] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isAppInstalled, setIsAppInstalled] = useState(isStandalone());
  const [canInstall, setCanInstall] = useState(canInstallPWA());

  useEffect(() => {
    setIsAppInstalled(isStandalone());
    const unsub = subscribeInstallPrompt((avail) => setCanInstall(avail));
    // Track online/offline status
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check if push notifications are already enabled & sync device subscription with backend
    if ('Notification' in window) {
      const isGranted = Notification.permission === 'granted';
      setNotificationsEnabled(isGranted);
      if (isGranted && navigator.onLine) {
        void syncPushSubscriptions();
      }
    }

    // Load all dashboard data with a single optimized API call
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        
        // Use offline-aware fetch: try API first, fall back to IndexedDB cache
        let dashboardData: any;
        try {
          dashboardData = await traineeService.getMyDashboard();
          // Cache the profile data for offline access
          if (dashboardData?.profile) {
            await offlineManager.fetchWithOfflineSupport(
              STORES.TRAINEES,
              async () => [dashboardData.profile],
              true
            );
          }
          // Cache programs for offline access
          try {
            await offlineManager.fetchWithOfflineSupport(
              STORES.PROGRAMS,
              () => programService.getPrograms({ status: 'active' }).then(r => r.data || []),
              false
            );
          } catch {
            // Non-critical — ignore
          }
        } catch (apiError) {
          // Offline fallback: load from IndexedDB
          logger.warn('API unavailable, loading from offline cache', { apiError });
          const cachedProfiles = await offlineManager.fetchWithOfflineSupport<any>(
            STORES.TRAINEES,
            async () => [],
            false
          );
          if (cachedProfiles.length > 0) {
            dashboardData = { profile: cachedProfiles[0], attendanceStats: null, recentAttendance: [], upcomingSessions: [], excludedDates: [] };
            toast.info('Showing cached data', { description: 'Connect to internet for latest updates' });
          } else {
            throw apiError;
          }
        }
        
        // Set profile data
        const profileData: TraineeProfile = {
          id: dashboardData.profile.id,
          first_name: dashboardData.profile.first_name,
          last_name: dashboardData.profile.last_name,
          middle_name: dashboardData.profile.middle_name,
          email: dashboardData.profile.email,
          phone: dashboardData.profile.phone,
          photo_path: dashboardData.profile.photo_path || '',
          program_id: dashboardData.profile.program_id,
          status: dashboardData.profile.status,
          enrollment_date: dashboardData.profile.enrollment_date,
          program: (dashboardData.profile as any).program || undefined
        };
        
        setTraineeProfile(profileData);
        setAttendanceStats(dashboardData.attendanceStats);
        setRecentAttendance(dashboardData.recentAttendance);
        setUpcomingSessions(dashboardData.upcomingSessions || []);
        setExcludedDates(dashboardData.excludedDates || []);
        setTodayAttendance(dashboardData.todayAttendance || null);

      } catch (error: any) {
        logger.error('Failed to load dashboard data', { error });
        toast.error(error?.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    const handleAttendanceUpdated = () => {
      traineeService.clearProfileCache();
      void loadDashboardData();
    };
    window.addEventListener(ATTENDANCE_UPDATED_EVENT, handleAttendanceUpdated);

    loadDashboardData();

    return () => {
      unsub();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(ATTENDANCE_UPDATED_EVENT, handleAttendanceUpdated);
    };
  }, [user]);

  const _formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const _formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const _getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle2 className="size-4 text-green-500" />;
      case 'absent':
        return <XCircle className="size-4 text-red-500" />;
      case 'late':
        return <AlertCircle className="size-4 text-yellow-500" />;
      case 'excused':
        return <Clock className="size-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const _getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      present: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      absent: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      late: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      excused: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const _getSessionTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      lecture: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
      lab: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300',
      workshop: 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300',
      exam: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
      seminar: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-200',
      field_trip: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-300',
    };
    return colors[type] || 'bg-muted text-muted-foreground';
  };

  const handleEnableNotifications = async () => {
    if (!isPushNotificationSupported()) {
      toast.error('Push notifications are not supported in this browser');
      return;
    }
    setEnablingPush(true);
    try {
      const granted = await requestNotificationPermission();
      if (!granted) {
        toast.info('Notifications blocked', {
          description: 'Enable notifications in your browser settings to receive attendance reminders',
        });
        return;
      }

      // Ensure device is subscribed and registered in backend push_subscriptions
      const subscriptionId = await subscribeToPushNotifications();
      setNotificationsEnabled(true);
      if (subscriptionId) {
        toast.success('Push notifications enabled', {
          description: 'You will receive reminders for morning and afternoon attendance check-ins',
        });
      } else {
        toast.success('Browser alerts enabled', {
          description: 'In-app attendance alerts are active; background push registration will retry automatically',
        });
      }
    } catch (error) {
      logger.error('Failed to enable push notifications', { error });
      toast.error('Failed to enable notifications');
    } finally {
      setEnablingPush(false);
    }
  };

  const attendanceReminderHint = (() => {
    if (!todayAttendance?.needsAttendance) return null;
    const slot = todayAttendance.pendingSessionLabel;
    const timeRange =
      todayAttendance.windowOpenTime && todayAttendance.windowCloseTime
        ? `${_formatTime(todayAttendance.windowOpenTime)} – ${_formatTime(todayAttendance.windowCloseTime)}`
        : null;
    if (todayAttendance.windowOpen && slot) {
      return `${slot === 'morning' ? 'Morning' : 'Afternoon'} attendance window is open${timeRange ? ` (${timeRange})` : ''}`;
    }
    if (slot) {
      return `${slot === 'morning' ? 'Morning' : 'Afternoon'} attendance pending${timeRange ? ` (${timeRange})` : ''}`;
    }
    return 'Attendance check-in needed today';
  })();

  if (loading) {
    return (
      <DashboardLayout title="Dashboard">
        <DashboardSkeletonLoader />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Dashboard">
      <main className="w-full overflow-x-hidden">
        <div className="space-y-4 sm:space-y-6">
          {/* HEADER - Simple and Clean */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-gray-200 dark:border-gray-700">
                <AvatarImage src={traineeProfile?.photo_path ? getFileUrl(traineeProfile.photo_path) : ''} />
                <AvatarFallback className="bg-blue-500 text-white font-bold">
                  {traineeProfile?.first_name?.[0]}{traineeProfile?.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
                  Welcome back, {traineeProfile?.first_name}
                </h1>
                {traineeProfile?.program && (
                  <p className="text-lg text-gray-600 dark:text-gray-400 mt-1">
                    {traineeProfile.program.name}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/settings">
                <Button variant="outline" className="gap-2">
                  <SettingsIcon className="size-4" />
                  <span>Settings</span>
                </Button>
              </Link>
              <Link to="/trainee/profile">
                <Button className="gap-2">
                  <UserIcon className="size-4" />
                  <span>Profile</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* DOWNLOAD PWA APP BANNER */}
          {!isAppInstalled && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-lg border border-primary/20 bg-primary/5">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <DownloadIcon className="size-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">Download the BMDC App (PWA)</p>
                  <p className="text-xs text-muted-foreground">Install on your mobile or desktop for fast offline attendance, QR, and schedules.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                  onClick={async () => {
                    if (canInstall) {
                      const res = await promptPWAInstall();
                      if (res.outcome === 'accepted') setIsAppInstalled(true);
                    } else {
                      toast.info('Go to Settings to view step-by-step install instructions for your device.');
                    }
                  }}
                >
                  <DownloadIcon className="size-3.5" />
                  <span>Download App</span>
                </Button>
                <Link to="/settings">
                  <Button variant="outline" size="sm" className="text-xs">
                    Instructions
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* STATUS ALERTS - Simple */}
          {isOffline && (
            <div className="flex items-start gap-4 p-3 sm:p-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700">
              <WifiOff className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900 dark:text-amber-100">Offline Mode</p>
                <p className="text-sm text-amber-800 dark:text-amber-300">Viewing cached data. Connect to internet for updates.</p>
              </div>
            </div>
          )}

          {todayAttendance?.needsAttendance && !isOffline && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-red-200 bg-red-50/70 dark:border-red-900/60 dark:bg-red-950/30">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-600/15 text-red-600 dark:bg-red-500/20 dark:text-red-400">
                  <Calendar className="size-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-red-950 dark:text-red-100">
                    {todayAttendance.windowOpen
                      ? `${todayAttendance.pendingSessionLabel === 'afternoon' ? 'Afternoon' : 'Morning'} Attendance Window Is Open`
                      : 'Attendance Reminder'}
                  </p>
                  <p className="text-xs text-red-800 dark:text-red-300 mt-0.5 leading-relaxed">
                    {attendanceReminderHint || 'You have not submitted your attendance for today’s session yet.'}
                  </p>
                </div>
              </div>
              <Link to="/trainee/attendance" className="shrink-0">
                <Button size="sm" className="w-full sm:w-auto gap-1.5 py-2 px-3.5 bg-red-600 hover:bg-red-700 text-white">
                  <Calendar className="size-4" />
                  Take Attendance
                </Button>
              </Link>
            </div>
          )}

          {'Notification' in window && !notificationsEnabled && !isOffline && (
            <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-blue-200 bg-blue-50/80 dark:bg-blue-950/30 dark:border-blue-800">
              <div className="flex items-start gap-3 flex-1">
                <Bell className="size-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm text-blue-900 dark:text-blue-100">Enable Push Notifications</p>
                  <p className="text-xs text-blue-800 dark:text-blue-300 mt-0.5 leading-relaxed">Get reminders for morning &amp; afternoon attendance windows and schedule updates.</p>
                </div>
              </div>
              <Button 
                onClick={handleEnableNotifications}
                disabled={enablingPush}
                size="sm"
                className="shrink-0 gap-2 py-2 px-3.5"
              >
                <Bell className="size-4" />
                {enablingPush ? 'Enabling...' : 'Enable'}
              </Button>
            </div>
          )}

          {/* MAIN CONTENT - Grid Layout */}
          <div className="space-y-4 sm:space-y-6">
            {/* Quick Actions */}
            <QuickActionsCard
              traineeProfile={traineeProfile}
              attendanceNeedsAction={Boolean(todayAttendance?.needsAttendance)}
              attendanceReminderHint={attendanceReminderHint}
            />

            {/* Programs and Progress */}
            <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
              <div className="lg:col-span-1">
                <ActiveProgramsCard traineeProfile={traineeProfile} />
              </div>
              <div className="lg:col-span-2">
                <ProgressSummaryCard attendanceStats={attendanceStats} upcomingSessions={upcomingSessions} />
              </div>
            </div>

            {/* Upcoming Events */}
            <UpcomingEventsCard upcomingSessions={upcomingSessions} excludedDates={excludedDates} />
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}


