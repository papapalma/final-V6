/**
 * TraineeAttendancePage  —  /trainee/attendance
 *
 * PROGRESSIVE DATA LOADING:
 *   1. Render shell UI with skeletons immediately (< 100ms)
 *   2. Fetch calendar + window status in parallel
 *   3. Show calendar skeleton while data loads
 *   4. Replace skeletons as data arrives
 *
 * Performance targets:
 *   - Initial paint: < 300ms (skeleton structure)
 *   - LCP: < 1.8s (first content arrival)
 *   - Fully interactive: < 2.5s (all data loaded)
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/ui/skeleton';
import { Button } from '../components/ui/button';
import {
  CheckCircle2, Clock, XCircle, TrendingUp, AlertCircle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import attendanceService from '../services/attendanceService';
import type {
  CalendarDayData,
  AttendanceWindowStatus,
  CalendarDayStatus,
} from '../services/attendanceService';
import AttendanceCalendar from '../components/attendance/AttendanceCalendar';
import AttendanceSubmitFlow from '../components/attendance/AttendanceSubmitFlow';
import { AttendanceStatusDot } from '../components/attendance/AttendanceStatusBadge';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function computeStats(data: CalendarDayData[]) {
  const trackable: CalendarDayStatus[] = ['present', 'late', 'absent', 'excused', 'pending'];
  const tracked = data.filter((d) => trackable.includes(d.status));
  const present = data.filter((d) => d.status === 'present').length;
  const late    = data.filter((d) => d.status === 'late').length;
  const absent  = data.filter((d) => d.status === 'absent').length;
  const total   = tracked.length;
  const rate    = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
  return { present, late, absent, rate, total };
}

function getStatusColor(status: CalendarDayStatus): string {
  switch (status) {
    case 'present':
      return 'text-green-700 dark:text-green-400';
    case 'late':
      return 'text-yellow-700 dark:text-yellow-400';
    case 'absent':
      return 'text-red-700 dark:text-red-400';
    case 'excused':
      return 'text-blue-700 dark:text-blue-400';
    case 'pending':
      return 'text-gray-700 dark:text-gray-400';
    default:
      return 'text-muted-foreground';
  }
}

function getStatusBgColor(status: CalendarDayStatus): string {
  switch (status) {
    case 'present':
      return 'bg-green-50 dark:bg-green-950/30';
    case 'late':
      return 'bg-yellow-50 dark:bg-yellow-950/30';
    case 'absent':
      return 'bg-red-50 dark:bg-red-950/30';
    case 'excused':
      return 'bg-blue-50 dark:bg-blue-950/30';
    case 'pending':
      return 'bg-gray-50 dark:bg-gray-950/30';
    default:
      return 'bg-muted/30';
  }
}

// Skeleton loaders for progressive rendering
function PunchCardSkeleton() {
  return (
    <Card className="overflow-hidden border-l-4 border-l-teal-500">
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-3 space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-6 w-12" />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TraineeAttendancePage() {
  const navigate = useNavigate();

  // Data states
  const [calendarData, setCalendarData] = useState<CalendarDayData[]>([]);
  const [windowStatus, setWindowStatus] = useState<AttendanceWindowStatus | null>(null);
  const [displayMonth, setDisplayMonth] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState<number>(0);

  // Loading states - separate for progressive rendering
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [windowLoading, setWindowLoading] = useState(true);

  // Track whether window was open on last poll to detect flip
  const prevIsOpen = useRef<boolean | null>(null);
  const yearMonth = useRef<string>(currentYearMonth());
  const notifiedRef = useRef<boolean>(false);

  // ── Fetch helpers ─────────────────────────────────────────────────────────
  const fetchCalendar = useCallback(async (ym: string) => {
    try {
      const res = await attendanceService.getCalendarMonth(ym);
      setCalendarData(res.data ?? []);
    } catch (error) {
      // Silent fail on background refresh
    } finally {
      setCalendarLoading(false);
    }
  }, []);

  const fetchWindow = useCallback(async () => {
    try {
      const res = await attendanceService.getWindowStatus();
      const ws = res.data ?? null;

      // If open/closed state flipped → refetch calendar
      if (prevIsOpen.current !== null && prevIsOpen.current !== ws?.isOpen) {
        // Call fetchCalendar directly with currentYearMonth instead of depending on it
        const ym = currentYearMonth();
        const calRes = await attendanceService.getCalendarMonth(ym);
        setCalendarData(calRes.data ?? []);
      }
      prevIsOpen.current = ws?.isOpen ?? false;
      setWindowStatus(ws);

      // Seed countdown
      const secs = ws?.isOpen
        ? (ws.seconds_until_close ?? 0)
        : (ws?.seconds_until_open ?? 0);
      setCountdown(Math.max(0, secs));
    } catch (error) {
      console.error('Failed to fetch window status:', error);
    } finally {
      setWindowLoading(false);
    }
  }, []);

  // ── Initial load: Fetch both in parallel but render skeleton first ────────
  useEffect(() => {
    const ym = currentYearMonth();
    yearMonth.current = ym;
    
    // Immediately set loading states (UI renders skeleton)
    setCalendarLoading(true);
    setWindowLoading(true);

    // Fetch both in parallel
    // Note: Promise.allSettled() never rejects, so .catch() would never fire
    // The loading states are cleared in the individual fetch functions
    Promise.allSettled([
      fetchCalendar(ym),
      fetchWindow(),
    ]);
  }, [fetchCalendar, fetchWindow]);

  // ── 60-second poll for window status (reduced from 30s) ──────────────────
  useEffect(() => {
    const interval = setInterval(fetchWindow, 60_000);
    return () => clearInterval(interval);
  }, [fetchWindow]);

  // ── 1-second countdown ticker ─────────────────────────────────────────────
  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown((prev) => {
        const next = prev <= 1 ? 0 : prev - 1;

        // Fire a browser notification once when ~15 min before window opens
        if (
          next > 0 &&
          next <= 900 &&
          !notifiedRef.current &&
          !windowStatus?.isOpen &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          notifiedRef.current = true;
          const mins = Math.ceil(next / 60);
          new Notification('Attendance opens soon', {
            body: `Your attendance window opens in ${mins} minute${mins !== 1 ? 's' : ''}.`,
            icon: '/icons/icon-192x192.png',
            tag: 'attendance-reminder',
          });
        }

        // Reset notified flag when a new window cycle starts
        if (next === 0) {
          notifiedRef.current = false;
          fetchWindow();
        }

        return next;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [fetchWindow, windowStatus?.isOpen]);

  // ── Month navigation ──────────────────────────────────────────────────────
  const handleMonthChange = useCallback((newMonth: Date) => {
    setDisplayMonth(newMonth);
    setCalendarData([]); // Clear old data immediately to avoid stale flash
    const ym = `${newMonth.getFullYear()}-${String(newMonth.getMonth() + 1).padStart(2, '0')}`;
    yearMonth.current = ym;
    setCalendarLoading(true);
    fetchCalendar(ym);
  }, [fetchCalendar]);

  // ── After submission complete ─────────────────────────────────────────────
  const handleSubmitComplete = useCallback(() => {
    setCalendarLoading(true);
    fetchCalendar(yearMonth.current);
    fetchWindow();
  }, [fetchCalendar, fetchWindow]);

  // ── Navigate to date details ──────────────────────────────────────────────
  const handleDateClick = useCallback((date: string) => {
    navigate(`/trainee/attendance/${date}`);
  }, [navigate]);

  // ── Derived stats (memoized) ──────────────────────────────────────────────
  const stats = useMemo(() => computeStats(calendarData), [calendarData]);

  // ── Today's status ────────────────────────────────────────────────────────
  const todayStr = (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
  })();
  const todayData = useMemo(
    () => calendarData.find((d) => d.date === todayStr),
    [calendarData, todayStr]
  );

  const countdownLabel = (() => {
    if (!windowStatus) return 'No attendance window today';
    if (windowStatus.isOpen) {
      return countdown > 0 ? `Closes in ${formatCountdown(countdown)}` : 'Window closing…';
    }
    return countdown > 0 ? `Opens in ${formatCountdown(countdown)}` : 'Window opening…';
  })();

  // ── Format greeting and name ──────────────────────────────────────────────
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';

  const traineeNameFromStorage = useMemo(() => {
    try {
      const profile = localStorage.getItem('traineeProfile');
      if (profile) {
        const parsed = JSON.parse(profile);
        return parsed.firstName || 'Trainee';
      }
    } catch {
      //silent
    }
    return 'Trainee';
  }, []);

  const today = new Date();
  const dateString = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // ---------------------------------------------------------------------------
  // Render - Progressive rendering: Show skeleton first, fill in data as it arrives
  // ---------------------------------------------------------------------------

  return (
    <DashboardLayout title="Attendance">
      <div className="space-y-4 sm:space-y-6">
        {/* ── Header Section with Greeting ── */}
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold">
            {greeting}, <span className="text-amber-500">{traineeNameFromStorage}</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Punch in for each session, then browse your month on the right.
          </p>
          <p className="text-xs text-muted-foreground mt-1 sm:mt-2">{dateString}</p>
        </div>

        {/* ── Punch Session Cards (Progressive rendering) ── */}
        <div className="sticky lg:top-16 z-20 space-y-2 sm:space-y-3 bg-background lg:pb-4">
          <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2">
            {windowLoading ? (
              <>
                <PunchCardSkeleton />
                <PunchCardSkeleton />
              </>
            ) : (
              <>
                {/* MORNING Session Card */}
                <Card className="overflow-hidden border-l-4 border-l-teal-500 dark:border-l-teal-400">
                  <CardContent className="p-2 sm:p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0">
                        {windowStatus?.session_label === 'morning' && windowStatus?.isOpen ? (
                          <Button
                            size="lg"
                            variant="ghost"
                            className="h-10 sm:h-12 w-10 sm:w-12 rounded-full p-0 border-2 border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-950/30"
                            onClick={() => {
                              const flow = document.querySelector('[data-attendance-flow]');
                              if (!flow) {
                                console.warn('Attendance flow trigger not found in DOM');
                                toast.error('Unable to open attendance form');
                                return;
                              }
                              (flow as HTMLElement).click();
                            }}
                          >
                            <span className="text-lg sm:text-xl font-bold text-teal-600">+</span>
                          </Button>
                        ) : (
                          <div className="h-10 sm:h-12 w-10 sm:w-12 rounded-full border-2 border-teal-300 dark:border-teal-700 flex items-center justify-center opacity-40">
                            <span className="text-base sm:text-lg text-teal-600">☀</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Morning</p>
                        <p className="text-xs font-medium mt-0.5 truncate">
                          {windowStatus?.session_label === 'morning' && windowStatus?.isOpen
                            ? 'Punch in'
                            : todayData?.status === 'present' || todayData?.status === 'late'
                              ? 'Done'
                              : 'Not punched'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* AFTERNOON Session Card */}
                <Card className="overflow-hidden border-l-4 border-l-teal-500 dark:border-l-teal-400">
                  <CardContent className="p-2 sm:p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0">
                        {windowStatus?.session_label === 'afternoon' && windowStatus?.isOpen ? (
                          <Button
                            size="lg"
                            variant="ghost"
                            className="h-10 sm:h-12 w-10 sm:w-12 rounded-full p-0 border-2 border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-950/30"
                            onClick={() => {
                              const flow = document.querySelector('[data-attendance-flow]');
                              if (!flow) {
                                console.warn('Attendance flow trigger not found in DOM');
                                toast.error('Unable to open attendance form');
                                return;
                              }
                              (flow as HTMLElement).click();
                            }}
                          >
                            <span className="text-lg sm:text-xl font-bold text-teal-600">+</span>
                          </Button>
                        ) : (
                          <div className="h-10 sm:h-12 w-10 sm:w-12 rounded-full border-2 border-teal-300 dark:border-teal-700 flex items-center justify-center opacity-40">
                            <span className="text-base sm:text-lg text-teal-600">🌙</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Afternoon</p>
                        <p className="text-xs font-medium mt-0.5 truncate">
                          {windowStatus?.session_label === 'afternoon' && windowStatus?.isOpen
                            ? 'Punch in'
                            : 'Not punched'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>

        {/* ── Quick Stats Cards (Progressive rendering) ── */}
        <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-4">
          {calendarLoading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Sessions</p>
                  <p className="text-2xl font-bold text-orange-600 mt-1">{stats.present + stats.late}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Streak</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{Math.floor(stats.total / 4)}d</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Attendance</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{stats.rate}%</p>
                  <Progress value={stats.rate} className="h-1 mt-1.5" />
                </CardContent>
              </Card>
              {todayData && (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Today</p>
                    <div className="mt-1 space-y-0.5">
                      {todayData.record?.morning_time_in && (
                        <p className="text-xs text-muted-foreground">
                          In: {new Date(todayData.record.morning_time_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                      {(todayData.record as any)?.morning_time_out && (
                        <p className="text-xs text-muted-foreground">
                          Out: {new Date((todayData.record as any).morning_time_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        {/* ── Full Width Calendar (Progressive rendering) ── */}
        <div className="overflow-hidden">
          <Card className="shadow-lg">
            <CardHeader className="pb-3 sm:pb-4 border-b">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-semibold truncate">
                    {displayMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h2>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMonthChange(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1))}
                    className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMonthChange(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1))}
                    className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                  >
                    <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-2 sm:gap-4 mt-3 sm:mt-4 text-xs overflow-x-auto pb-1">
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="h-2 w-2 rounded-full bg-teal-500" />
                  <span className="text-xs">Present</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="text-xs">Late</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="h-2 w-2 rounded-full bg-neutral-500" />
                  <span className="text-xs">Absent</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-2 sm:p-4">
              {calendarLoading ? (
                <Skeleton className="h-72 sm:h-96 w-full rounded-lg" />
              ) : (
                <div className="overflow-x-auto -mx-2 sm:mx-0">
                  <div className="min-w-full sm:min-w-0">
                    <AttendanceSubmitFlow
                      windowStatus={windowStatus}
                      onComplete={handleSubmitComplete}
                    >
                      {(triggerAttendance) => (
                        <AttendanceCalendar
                          calendarData={calendarData}
                          windowStatus={windowStatus ?? {
                            isOpen: false,
                            session_label: null,
                            window_open: null,
                            window_close: null,
                            seconds_until_open: null,
                            seconds_until_close: null,
                          }}
                          onTakeAttendance={triggerAttendance}
                          onDateClick={handleDateClick}
                          month={displayMonth}
                          onMonthChange={handleMonthChange}
                        />
                      )}
                    </AttendanceSubmitFlow>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Hidden flow trigger for accessibility */}
      <div data-attendance-flow style={{ display: 'none' }} />
    </DashboardLayout>
  );
}
