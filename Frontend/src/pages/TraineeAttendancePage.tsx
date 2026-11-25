/**
 * TraineeAttendancePage  —  /trainee/attendance
 *
 * Progressive data loading:
 *   1. Render shell UI with skeletons immediately
 *   2. Fetch calendar + window status in parallel
 *   3. Wire both top Punch Session Cards AND AttendanceCalendar inside AttendanceSubmitFlow
 *      so clicking Morning/Afternoon (+) opens CameraModal directly
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/ui/skeleton';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  CheckCircle2, Clock, ChevronLeft, ChevronRight, Sun, Moon, Plus,
} from 'lucide-react';
import attendanceService from '../services/attendanceService';
import type {
  CalendarDayData,
  AttendanceWindowStatus,
  CalendarDayStatus,
} from '../services/attendanceService';
import AttendanceCalendar from '../components/attendance/AttendanceCalendar';
import AttendanceSubmitFlow from '../components/attendance/AttendanceSubmitFlow';

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

function formatShortTime(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function computeStats(data: CalendarDayData[], todayStr: string) {
  const trackable: CalendarDayStatus[] = ['present', 'late', 'absent', 'excused', 'pending'];
  const tracked = data.filter((d) => trackable.includes(d.status));
  const present = data.filter((d) => d.status === 'present').length;
  const late    = data.filter((d) => d.status === 'late').length;
  const absent  = data.filter((d) => d.status === 'absent').length;
  const total   = tracked.length;
  const rate    = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

  // Compute real consecutive attended session days up to today (skipping weekends/holidays/no_session)
  const pastSessionDays = data
    .filter((d) => d.date <= todayStr && ['present', 'late', 'absent', 'excused', 'pending'].includes(d.status))
    .sort((a, b) => b.date.localeCompare(a.date));

  let streak = 0;
  for (const day of pastSessionDays) {
    if (day.status === 'present' || day.status === 'late') {
      streak++;
    } else if (day.date === todayStr && day.status === 'pending') {
      // Today's session is still open/pending — don't break prior streak yet
      continue;
    } else {
      break;
    }
  }

  return { present, late, absent, rate, total, streak };
}

function PunchCardSkeleton() {
  return (
    <Card className="overflow-hidden border-l-4 border-l-primary">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card className="border shadow-xs">
      <CardContent className="p-4 space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-7 w-14" />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TraineeAttendancePage() {
  const navigate = useNavigate();

  const [calendarData, setCalendarData] = useState<CalendarDayData[]>([]);
  const [windowStatus, setWindowStatus] = useState<AttendanceWindowStatus | null>(null);
  const [displayMonth, setDisplayMonth] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState<number>(0);

  const [calendarLoading, setCalendarLoading] = useState(true);
  const [windowLoading, setWindowLoading] = useState(true);

  const prevIsOpen = useRef<boolean | null>(null);
  const yearMonth = useRef<string>(currentYearMonth());
  const notifiedRef = useRef<boolean>(false);

  const fetchCalendar = useCallback(async (ym: string) => {
    try {
      const res = await attendanceService.getCalendarMonth(ym);
      setCalendarData(res.data ?? []);
    } catch {
      // Silent fail on background refresh
    } finally {
      setCalendarLoading(false);
    }
  }, []);

  const fetchWindow = useCallback(async () => {
    try {
      const res = await attendanceService.getWindowStatus();
      const ws = res.data ?? null;

      if (prevIsOpen.current !== null && prevIsOpen.current !== ws?.isOpen) {
        const ym = currentYearMonth();
        const calRes = await attendanceService.getCalendarMonth(ym);
        setCalendarData(calRes.data ?? []);
      }
      prevIsOpen.current = ws?.isOpen ?? false;
      setWindowStatus(ws);

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

  useEffect(() => {
    const ym = currentYearMonth();
    yearMonth.current = ym;
    setCalendarLoading(true);
    setWindowLoading(true);
    Promise.allSettled([fetchCalendar(ym), fetchWindow()]);
  }, [fetchCalendar, fetchWindow]);

  useEffect(() => {
    const interval = setInterval(fetchWindow, 60_000);
    return () => clearInterval(interval);
  }, [fetchWindow]);

  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 0) return 0;
        const next = prev - 1;

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
            icon: '/icons/bmdc-logo-192x192.png',
            tag: 'attendance-reminder',
          });
        }

        if (next === 0) {
          notifiedRef.current = false;
          fetchWindow();
        }

        return next;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [fetchWindow, windowStatus?.isOpen]);

  const handleMonthChange = useCallback((newMonth: Date) => {
    setDisplayMonth(newMonth);
    setCalendarData([]);
    const ym = `${newMonth.getFullYear()}-${String(newMonth.getMonth() + 1).padStart(2, '0')}`;
    yearMonth.current = ym;
    setCalendarLoading(true);
    fetchCalendar(ym);
  }, [fetchCalendar]);

  const handleSubmitComplete = useCallback(() => {
    setCalendarLoading(true);
    fetchCalendar(yearMonth.current);
    fetchWindow();
  }, [fetchCalendar, fetchWindow]);

  const handleDateClick = useCallback((date: string) => {
    navigate(`/trainee/attendance/${date}`);
  }, [navigate]);

  const todayStr = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
  }, []);

  const stats = useMemo(() => computeStats(calendarData, todayStr), [calendarData, todayStr]);

  const todayData = useMemo(
    () => calendarData.find((d) => d.date === todayStr),
    [calendarData, todayStr]
  );

  const morningStatus = todayData?.record?.morning_status;
  const afternoonStatus = todayData?.record?.afternoon_status;
  const morningDone = morningStatus === 'present' || morningStatus === 'late';
  const afternoonDone = afternoonStatus === 'present' || afternoonStatus === 'late';

  const isMorningOpenNow = Boolean(windowStatus?.isOpen && windowStatus.session_label === 'morning');
  const isAfternoonOpenNow = Boolean(windowStatus?.isOpen && windowStatus.session_label === 'afternoon');

  const countdownLabel = (() => {
    if (!windowStatus || (!windowStatus.isOpen && !windowStatus.window_open)) {
      return 'No active attendance window right now';
    }
    if (windowStatus.isOpen) {
      return countdown > 0
        ? `${windowStatus.session_label === 'morning' ? 'Morning' : 'Afternoon'} window closes in ${formatCountdown(countdown)}`
        : 'Window closing…';
    }
    return countdown > 0
      ? `${windowStatus.session_label === 'morning' ? 'Morning' : 'Afternoon'} window opens in ${formatCountdown(countdown)}`
      : 'Window closed for today';
  })();

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';

  const traineeNameFromStorage = useMemo(() => {
    try {
      const profile = localStorage.getItem('traineeProfile');
      if (profile) {
        const parsed = JSON.parse(profile);
        return parsed.firstName || parsed.first_name || 'Trainee';
      }
    } catch {
      // silent
    }
    return 'Trainee';
  }, []);

  const dateString = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <DashboardLayout title="Attendance">
      <AttendanceSubmitFlow
        windowStatus={windowStatus}
        onComplete={handleSubmitComplete}
      >
        {(triggerAttendance) => (
          <div className="space-y-6">
            {/* ── Header Section (Golden Rule proximity: tight inner grouping) ── */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
                  {greeting}, <span className="text-primary">{traineeNameFromStorage}</span>
                </h1>
                <p className="text-sm text-muted-foreground mt-1.5">
                  Punch in with a live selfie during your active session window.
                </p>
                <p className="text-xs text-muted-foreground mt-1">{dateString}</p>
              </div>

              {!windowLoading && (
                <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-2 text-xs font-medium shadow-xs self-start sm:self-auto">
                  <Clock className={`size-3.5 ${windowStatus?.isOpen ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                  <span className="tabular-nums">{countdownLabel}</span>
                </div>
              )}
            </div>

            {/* ── Punch Session Cards ── */}
            <div className="sticky lg:top-16 z-20 bg-background/95 backdrop-blur-xs py-1">
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                {windowLoading ? (
                  <>
                    <PunchCardSkeleton />
                    <PunchCardSkeleton />
                  </>
                ) : (
                  <>
                    {/* MORNING Session Card */}
                    <Card className={`overflow-hidden border-l-4 ${morningDone ? 'border-l-emerald-500' : isMorningOpenNow ? 'border-l-primary ring-1 ring-primary/20' : 'border-l-slate-300 dark:border-l-slate-700'}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="shrink-0">
                            {morningDone ? (
                              <div className="size-12 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                <CheckCircle2 className="size-6" />
                              </div>
                            ) : isMorningOpenNow ? (
                              <button
                                type="button"
                                aria-label="Punch in for Morning session"
                                onClick={triggerAttendance}
                                className="att-punch-trigger size-12 rounded-full border-2 border-primary bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center shadow-sm cursor-pointer"
                              >
                                <Plus className="size-6" />
                              </button>
                            ) : (
                              <div className="size-12 rounded-full border border-border bg-muted/50 flex items-center justify-center text-amber-500">
                                <Sun className="size-5" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Morning Session
                              </p>
                              {morningStatus === 'late' && (
                                <Badge className="py-0.5 px-2 text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-0">
                                  Late
                                </Badge>
                              )}
                              {morningStatus === 'present' && (
                                <Badge className="py-0.5 px-2 text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-0">
                                  Present
                                </Badge>
                              )}
                              {morningStatus === 'absent' && (
                                <Badge className="py-0.5 px-2 text-[10px] bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-0">
                                  Missed
                                </Badge>
                              )}
                            </div>

                            <p className="text-sm font-semibold mt-1 truncate">
                              {morningDone
                                ? `Recorded at ${formatShortTime(todayData?.record?.morning_time_in || todayData?.record?.check_in_time)}`
                                : isMorningOpenNow
                                  ? 'Tap + to Punch In'
                                  : windowStatus?.morning_open && windowStatus?.morning_close
                                    ? `Window: ${windowStatus.morning_open.slice(0, 5)} – ${windowStatus.morning_close.slice(0, 5)}`
                                    : 'Not punched'}
                            </p>
                          </div>

                          {isMorningOpenNow && !morningDone && (
                            <Button
                              size="sm"
                              onClick={triggerAttendance}
                              className="py-2 px-3.5 text-xs shrink-0"
                            >
                              Punch In
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* AFTERNOON Session Card */}
                    <Card className={`overflow-hidden border-l-4 ${afternoonDone ? 'border-l-emerald-500' : isAfternoonOpenNow ? 'border-l-primary ring-1 ring-primary/20' : 'border-l-slate-300 dark:border-l-slate-700'}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="shrink-0">
                            {afternoonDone ? (
                              <div className="size-12 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                <CheckCircle2 className="size-6" />
                              </div>
                            ) : isAfternoonOpenNow ? (
                              <button
                                type="button"
                                aria-label="Punch in for Afternoon session"
                                onClick={triggerAttendance}
                                className="att-punch-trigger size-12 rounded-full border-2 border-primary bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center shadow-sm cursor-pointer"
                              >
                                <Plus className="size-6" />
                              </button>
                            ) : (
                              <div className="size-12 rounded-full border border-border bg-muted/50 flex items-center justify-center text-blue-500">
                                <Moon className="size-5" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Afternoon Session
                              </p>
                              {afternoonStatus === 'late' && (
                                <Badge className="py-0.5 px-2 text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-0">
                                  Late
                                </Badge>
                              )}
                              {afternoonStatus === 'present' && (
                                <Badge className="py-0.5 px-2 text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-0">
                                  Present
                                </Badge>
                              )}
                            </div>

                            <p className="text-sm font-semibold mt-1 truncate">
                              {afternoonDone
                                ? `Recorded at ${formatShortTime(todayData?.record?.afternoon_time_out || todayData?.record?.check_out_time)}`
                                : isAfternoonOpenNow
                                  ? 'Tap + to Punch In'
                                  : windowStatus?.afternoon_open && windowStatus?.afternoon_close
                                    ? `Window: ${windowStatus.afternoon_open.slice(0, 5)} – ${windowStatus.afternoon_close.slice(0, 5)}`
                                    : 'Not punched'}
                            </p>
                          </div>

                          {isAfternoonOpenNow && !afternoonDone && (
                            <Button
                              size="sm"
                              onClick={triggerAttendance}
                              className="py-2 px-3.5 text-xs shrink-0"
                            >
                              Punch In
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </div>

            {/* ── Quick Stats Cards ── */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              {calendarLoading ? (
                <>
                  <StatCardSkeleton />
                  <StatCardSkeleton />
                  <StatCardSkeleton />
                  <StatCardSkeleton />
                </>
              ) : (
                <>
                  <Card className="border shadow-xs">
                    <CardContent className="p-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Attended Days</p>
                      <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{stats.present + stats.late}</p>
                    </CardContent>
                  </Card>
                  <Card className="border shadow-xs">
                    <CardContent className="p-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Streak</p>
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">{stats.streak}d</p>
                    </CardContent>
                  </Card>
                  <Card className="border shadow-xs">
                    <CardContent className="p-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Attendance Rate</p>
                      <p className="text-2xl font-bold text-primary mt-1 tabular-nums">{stats.rate}%</p>
                      <Progress value={stats.rate} className="h-1.5 mt-2" />
                    </CardContent>
                  </Card>
                  <Card className="border shadow-xs">
                    <CardContent className="p-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Today</p>
                      <div className="mt-1.5 space-y-0.5 text-xs">
                        <p className="text-muted-foreground">
                          AM:{' '}
                          <span className="font-medium text-foreground">
                            {todayData?.record?.morning_time_in
                              ? formatShortTime(todayData.record.morning_time_in)
                              : '—'}
                          </span>
                        </p>
                        <p className="text-muted-foreground">
                          PM:{' '}
                          <span className="font-medium text-foreground">
                            {todayData?.record?.afternoon_time_out
                              ? formatShortTime(todayData.record.afternoon_time_out)
                              : '—'}
                          </span>
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {/* ── Monthly Calendar ── */}
            <Card className="shadow-sm overflow-hidden">
              <CardHeader className="p-4 border-b">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold truncate">
                    {displayMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h2>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMonthChange(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1))}
                      className="size-8"
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMonthChange(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1))}
                      className="size-8"
                      aria-label="Next month"
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4">
                {calendarLoading ? (
                  <Skeleton className="h-80 w-full rounded-lg" />
                ) : (
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
              </CardContent>
            </Card>
          </div>
        )}
      </AttendanceSubmitFlow>
    </DashboardLayout>
  );
}
