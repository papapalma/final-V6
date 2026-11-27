/**
 * AttendancePage  —  /programs/:id/attendance  (local_admin & staff roles)
 *
 * Features:
 * - Real backend calendar & stats (no fake localStorage Math.random() mock data)
 * - High-contrast semantic status badges/dots (emerald / amber / red / purple)
 * - Calendar, Records, and Schedules tabs + 1-click Attendance Setup Wizard
 * - Manual status override support for both recorded and "No Record" trainees
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  ChevronLeft, ChevronRight, TrendingUp, CheckCircle2,
  Calendar, Clock, X, Zap, BellRing, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import programService from '../services/programService';
import sessionService, { ProgramSession } from '../services/sessionService';
import attendanceService from '../services/attendanceService';
import notificationService from '../services/notificationService';
import { useAuth } from '../contexts/AuthContext';
import AttendanceDetailModal from '../components/attendance/AttendanceDetailModal';
import AttendanceSetupWizard from '../components/attendance/AttendanceSetupWizard';
import ScheduleFormModal from '../components/attendance/ScheduleFormModal';
import ScheduleOverrideModal from '../components/attendance/ScheduleOverrideModal';
import { getFileUrl } from '../services/api';
import type {
  DayAttendanceData,
  AttendanceRecord,
  AttendanceSchedule,
  AdminDashboardData,
} from '../services/attendanceService';

const STATUS_BADGE: Record<string, string> = {
  present: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  late:    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  absent:  'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  excused: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  pending: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatTime(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isWeekend(date: Date): boolean {
  return date.getDay() === 0 || date.getDay() === 6;
}

function isPastOrToday(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compareDate = new Date(date);
  compareDate.setHours(0, 0, 0, 0);
  return compareDate <= today;
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export default function AttendancePage() {
  const { id: programId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthReady, hasPermission, user } = useAuth();

  const [program, setProgram] = useState<any>(null);
  const [displayMonth, setDisplayMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(formatDateKey(new Date()));
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [sessions, setSessions] = useState<ProgramSession[]>([]);
  const [dayData, setDayData] = useState<DayAttendanceData | null>(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [schedules, setSchedules] = useState<AttendanceSchedule[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [scheduleFormOpen, setScheduleFormOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<AttendanceSchedule | undefined>();
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideScheduleId, setOverrideScheduleId] = useState<string>('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [modalRecord, setModalRecord] = useState<AttendanceRecord | null>(null);
  const [modalTrainee, setModalTrainee] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [dayModalDate, setDayModalDate] = useState<string | null>(null);
  const [sendingReminder, setSendingReminder] = useState(false);

  const canOverride = user?.role === 'local_admin' || user?.role === 'staff_training_coordinator';
  const isLocalAdmin = user?.role === 'local_admin';

  // Generate calendar days for displayMonth
  const calendarDays = useMemo(() => {
    const year = displayMonth.getFullYear();
    const month = displayMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: (null | { date: Date; dateKey: string })[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const dt = new Date(year, month, day);
      days.push({ date: dt, dateKey: formatDateKey(dt) });
    }
    return days;
  }, [displayMonth]);

  // Load program details
  useEffect(() => {
    if (!programId || !isAuthReady) return;
    if (!hasPermission('canManagePrograms')) {
      toast.error('No permission');
      navigate('/programs', { replace: true });
      return;
    }
    programService
      .getProgramById(programId)
      .then((prog) => setProgram(prog))
      .catch((err: any) => {
        if (err?.status === 403) {
          toast.error('Access denied');
          navigate('/programs', { replace: true });
        } else {
          toast.error('Failed to load program');
        }
      });
  }, [programId, isAuthReady, hasPermission, navigate]);

  // Load real dashboard trend + program sessions (replaces fake localStorage mock data)
  const loadOverview = useCallback(async () => {
    if (!programId) return;
    const year = displayMonth.getFullYear();
    const month = displayMonth.getMonth();
    const startDate = formatDateKey(new Date(year, month, 1));
    const endDate = formatDateKey(new Date(year, month + 1, 0));

    try {
      const [dashRes, sessRes] = await Promise.all([
        attendanceService.getAdminDashboard(programId, { startDate, endDate }),
        sessionService.getSessionsByProgram(programId),
      ]);
      setDashboard(dashRes.data ?? null);
      setSessions(sessRes.data ?? []);
    } catch {
      // Non-fatal
    }
  }, [programId, displayMonth]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // Load selected day attendance
  const loadDayAttendance = useCallback(async (date: string) => {
    if (!programId) return;
    setDayLoading(true);
    try {
      const res = await attendanceService.getDayAttendance(programId, date);
      setDayData(res.data ?? null);
    } catch {
      toast.error('Failed to load day attendance');
    } finally {
      setDayLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    if (!selectedDate) return;
    loadDayAttendance(selectedDate);
  }, [selectedDate, loadDayAttendance]);

  // Load schedules
  const loadSchedules = useCallback(async () => {
    if (!programId) return;
    setSchedulesLoading(true);
    try {
      const res = await attendanceService.getSchedules(programId);
      setSchedules(res.data ?? []);
    } catch {
      // silent
    } finally {
      setSchedulesLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  // Index daily trend & scheduled sessions by date
  const trendMap = useMemo(() => {
    const m = new Map<string, { present: number; late: number; absent: number }>();
    for (const item of dashboard?.dailyTrend ?? []) {
      m.set(item.date, { present: item.present, late: item.late, absent: item.absent });
    }
    return m;
  }, [dashboard]);

  const sessionDateSet = useMemo(() => {
    return new Set(sessions.map((s) => s.session_date));
  }, [sessions]);

  const activeSchedule = useMemo(
    () => schedules.find((s) => s.status === 'active') ?? schedules[0] ?? null,
    [schedules]
  );

  const openModal = (record: AttendanceRecord | null, trainee: any) => {
    setModalRecord(record);
    setModalTrainee(trainee);
    setModalOpen(true);
  };

  const goToPrevMonth = () => {
    const d = new Date(displayMonth);
    d.setMonth(displayMonth.getMonth() - 1);
    setDisplayMonth(d);
  };
  const goToNextMonth = () => {
    const d = new Date(displayMonth);
    d.setMonth(displayMonth.getMonth() + 1);
    setDisplayMonth(d);
  };
  const goToToday = () => {
    setDisplayMonth(new Date());
    setSelectedDate(formatDateKey(new Date()));
  };

  const selectedDateObj = selectedDate ? new Date(selectedDate + 'T00:00:00') : null;
  const today = new Date();

  const allDayRecords = dayData?.records ?? [];
  const morningRecords = allDayRecords.filter((r) => r.morning_time_in || r.check_in_time || r.status === 'present' || r.status === 'late' || r.status === 'excused' || r.status === 'absent');
  const afternoonRecords = allDayRecords.filter((r) => r.afternoon_time_out || r.check_out_time);
  const noRecordTrainees = dayData?.noRecord ?? [];

  const summaryRate = dashboard?.summaryCards?.attendanceRate ?? 0;
  const presentToday = (dashboard?.summaryCards?.presentToday ?? 0) + (dashboard?.summaryCards?.lateToday ?? 0);
  const todayDateKey = formatDateKey(today);
  const hasSessionToday = sessionDateSet.has(todayDateKey);

  const handleSendAttendanceReminder = async () => {
    if (!programId) return;
    setSendingReminder(true);
    try {
      const result = await notificationService.sendAttendanceReminders(programId);
      if (result.pendingTrainees === 0) {
        toast.info('All enrolled trainees have already recorded attendance for this session.');
      } else if (result.pushSent > 0) {
        toast.success(
          `Sent ${result.pushSent} push reminder${result.pushSent === 1 ? '' : 's'} (${result.pendingTrainees} pending trainee${result.pendingTrainees === 1 ? '' : 's'}).`
        );
      } else {
        toast.info(
          `${result.pendingTrainees} trainee${result.pendingTrainees === 1 ? '' : 's'} still pending (in-app reminders active; 0 devices subscribed to Web Push yet).`
        );
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send attendance reminders');
    } finally {
      setSendingReminder(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="min-h-[calc(100dvh-80px)] p-4">
        <div className="min-h-[calc(100dvh-80px)] flex flex-col max-w-5xl mx-auto space-y-4">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex min-w-0 items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/programs')}
                aria-label="Back to programs"
                className="shrink-0 size-9"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <div className="min-w-0">
                <h1 className="truncate text-lg sm:text-xl font-bold leading-snug">
                  {program?.name || 'Program Attendance'}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {today.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1.5 rounded-lg border bg-card py-1.5 px-3">
                <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-semibold text-foreground tabular-nums">
                  {presentToday} today
                </span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border bg-card py-1.5 px-3">
                <TrendingUp className="size-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground tabular-nums">
                  {summaryRate}% rate
                </span>
              </div>
              {canOverride && hasSessionToday && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSendAttendanceReminder}
                  disabled={sendingReminder}
                  className="gap-1.5 py-2 px-3.5 text-xs"
                  title="Send push attendance reminder to trainees who have not checked in today"
                >
                  {sendingReminder ? (
                    <Loader2 className="size-3.5 animate-spin text-primary" />
                  ) : (
                    <BellRing className="size-3.5 text-primary" />
                  )}
                  Send Reminder
                </Button>
              )}
              {isLocalAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setWizardOpen(true)}
                  className="gap-1.5 py-2 px-3.5 text-xs"
                >
                  <Zap className="size-3.5 text-primary" />
                  Setup Wizard
                </Button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="calendar" className="flex-1 flex flex-col min-h-0 space-y-3">
            <TabsList className="grid w-full grid-cols-3 h-10">
              <TabsTrigger value="calendar" className="text-xs sm:text-sm">Calendar</TabsTrigger>
              <TabsTrigger value="records" className="text-xs sm:text-sm">Records</TabsTrigger>
              <TabsTrigger value="schedules" className="text-xs sm:text-sm">Schedules</TabsTrigger>
            </TabsList>

            {/* TAB 1: MONTHLY CALENDAR */}
            <TabsContent value="calendar" className="flex-1 flex flex-col m-0 space-y-3 overflow-hidden">
              <Card className="border shadow-sm flex-1 overflow-hidden flex flex-col">
                <CardHeader className="p-4 pb-2 shrink-0">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="icon" onClick={goToPrevMonth} aria-label="Previous month" className="size-8">
                      <ChevronLeft className="size-4" />
                    </Button>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">
                        {displayMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </CardTitle>
                      <Button variant="outline" size="sm" onClick={goToToday} className="py-1 px-2.5 text-xs h-7">
                        Today
                      </Button>
                    </div>
                    <Button variant="ghost" size="icon" onClick={goToNextMonth} aria-label="Next month" className="size-8">
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 overflow-auto p-4 pt-2">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-xs text-muted-foreground">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                          <th key={d} className="py-2 text-center font-medium">{d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const rows: (typeof calendarDays)[] = [];
                        for (let i = 0; i < calendarDays.length; i += 7) {
                          rows.push(calendarDays.slice(i, i + 7));
                        }
                        return rows.map((row, rowIdx) => (
                          <tr key={rowIdx}>
                            {row.map((day, colIdx) => {
                              if (!day) {
                                return (
                                  <td key={colIdx} className="p-1">
                                    <div className="min-h-[56px]" />
                                  </td>
                                );
                              }

                              const dateKey = day.dateKey;
                              const trend = trendMap.get(dateKey);
                              const hasSession = sessionDateSet.has(dateKey);
                              const isSelected = selectedDate === dateKey;
                              const isTodayDate = isToday(day.date);
                              const isFuture = !isPastOrToday(day.date);
                              const isWeekendDay = isWeekend(day.date);

                              return (
                                <td key={colIdx} className="p-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!isFuture) {
                                        setSelectedDate(dateKey);
                                        setDayModalDate(dateKey);
                                        setDayModalOpen(true);
                                      }
                                    }}
                                    disabled={isFuture}
                                    className={[
                                      'w-full min-h-[56px] p-1.5 rounded-lg border flex flex-col items-center justify-center text-xs transition-colors',
                                      isSelected ? 'ring-2 ring-primary ring-offset-1 bg-primary/10 border-primary' : 'border-border',
                                      isTodayDate && !isSelected ? 'border-primary bg-primary/5' : '',
                                      isFuture ? 'opacity-35 cursor-not-allowed bg-muted/20' : 'hover:bg-muted/50 cursor-pointer',
                                      isWeekendDay ? 'bg-muted/10' : '',
                                    ].join(' ')}
                                  >
                                    <span className={`text-xs font-medium ${isTodayDate ? 'text-primary font-bold' : ''}`}>
                                      {day.date.getDate()}
                                    </span>
                                    <div className="flex items-center gap-1 mt-1 min-h-[8px]">
                                      {trend ? (
                                        <>
                                          {trend.present > 0 && (
                                            <span className="size-2 rounded-full bg-emerald-500" title={`${trend.present} present`} />
                                          )}
                                          {trend.late > 0 && (
                                            <span className="size-2 rounded-full bg-amber-500" title={`${trend.late} late`} />
                                          )}
                                          {trend.absent > 0 && (
                                            <span className="size-2 rounded-full bg-red-500" title={`${trend.absent} absent`} />
                                          )}
                                        </>
                                      ) : hasSession ? (
                                        <span className="size-2 rounded-full bg-primary/40" title="Scheduled session" />
                                      ) : null}
                                    </div>
                                  </button>
                                </td>
                              );
                            })}
                            {row.length < 7 &&
                              Array.from({ length: 7 - row.length }).map((_, i) => (
                                <td key={`empty-end-${i}`} className="p-1">
                                  <div className="min-h-[56px]" />
                                </td>
                              ))}
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Legend */}
              <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span>Present</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-amber-500" />
                  <span>Late</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-red-500" />
                  <span>Absent</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-primary/40" />
                  <span>Scheduled Session</span>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: RECORDS */}
            <TabsContent value="records" className="flex-1 overflow-auto m-0 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-primary" />
                  <span className="text-sm font-semibold">
                    {selectedDateObj?.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    }) || 'Select a date'}
                  </span>
                </div>
                {!dayData?.session_id && !dayLoading && (
                  <Badge variant="outline" className="text-xs">No session scheduled</Badge>
                )}
              </div>

              {dayLoading ? (
                <div className="grid gap-3">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                  ))}
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-4 mb-2 flex items-center gap-1.5">
                      <span>🌅</span> Recorded Attendance ({morningRecords.length})
                    </h3>
                    {morningRecords.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">No attendance recorded for this date yet.</p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {morningRecords.map((r) => {
                          const t = r.trainee as any;
                          return (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => openModal(r, t)}
                              className="text-left rounded-xl border p-3 hover:shadow-sm hover:border-primary/50 transition-all bg-card cursor-pointer"
                            >
                              <div className="flex items-center gap-3">
                                {t?.photo_path ? (
                                  <img
                                    src={getFileUrl(t.photo_path)}
                                    alt=""
                                    className="size-9 rounded-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      const next = e.currentTarget.nextElementSibling as HTMLElement | null;
                                      if (next) next.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div className={`size-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold ${t?.photo_path ? 'hidden' : ''}`}>
                                  {t?.first_name?.[0]}
                                  {t?.last_name?.[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {t?.first_name} {t?.last_name}
                                  </p>
                                  <span className={`inline-block text-[11px] font-medium py-0.5 px-2 rounded-full capitalize mt-0.5 ${STATUS_BADGE[r.status] ?? 'bg-muted text-muted-foreground'}`}>
                                    {r.status}
                                  </span>
                                </div>
                                <div className="text-right text-xs shrink-0">
                                  <p className="text-muted-foreground">
                                    {formatTime(r.morning_time_in ?? r.afternoon_time_out ?? r.check_in_time)}
                                  </p>
                                  {r.late_duration_minutes ? (
                                    <p className="text-amber-600 dark:text-amber-400 font-medium">
                                      Late {r.late_duration_minutes}m
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {afternoonRecords.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-6 mb-2 flex items-center gap-1.5">
                        <span>🌆</span> Afternoon Time-Out ({afternoonRecords.length})
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {afternoonRecords.map((r) => {
                          const t = r.trainee as any;
                          return (
                            <button
                              key={`pm-${r.id}`}
                              type="button"
                              onClick={() => openModal(r, t)}
                              className="text-left rounded-xl border p-3 hover:shadow-sm hover:border-primary/50 transition-all bg-card cursor-pointer"
                            >
                              <div className="flex items-center gap-3">
                                <div className="size-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                                  {t?.first_name?.[0]}
                                  {t?.last_name?.[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {t?.first_name} {t?.last_name}
                                  </p>
                                  <span className={`inline-block text-[11px] font-medium py-0.5 px-2 rounded-full capitalize mt-0.5 ${STATUS_BADGE[r.afternoon_status ?? r.status] ?? 'bg-muted text-muted-foreground'}`}>
                                    {r.afternoon_status ?? r.status}
                                  </span>
                                </div>
                                <div className="text-right text-xs">
                                  <p className="text-muted-foreground">
                                    {formatTime(r.afternoon_time_out ?? r.check_out_time)}
                                  </p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {noRecordTrainees.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-6 mb-2 flex items-center gap-1.5">
                        <span>⏳</span> No Record ({noRecordTrainees.length})
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {noRecordTrainees.map((t: any) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => openModal(null, t)}
                            className="text-left rounded-xl border border-dashed p-3 hover:shadow-sm hover:border-primary/50 transition-all bg-card/60 cursor-pointer"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="size-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                                  {t.first_name?.[0]}
                                  {t.last_name?.[0]}
                                </div>
                                <p className="text-sm font-medium truncate">
                                  {t.first_name} {t.last_name}
                                </p>
                              </div>
                              <span className="text-xs text-primary font-medium shrink-0">Mark</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* TAB 3: SCHEDULES */}
            <TabsContent value="schedules" className="flex-1 overflow-auto m-0 space-y-3">
              {isLocalAdmin && (
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">One schedule active at a time per program.</p>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingSchedule(undefined);
                      setScheduleFormOpen(true);
                    }}
                    className="py-2 px-3.5 text-xs"
                  >
                    + Create Schedule
                  </Button>
                </div>
              )}

              {schedulesLoading ? (
                <div className="space-y-3">
                  {[...Array(2)].map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-xl" />
                  ))}
                </div>
              ) : schedules.length === 0 ? (
                <Card className="border-dashed border-2">
                  <CardContent className="py-8 text-center space-y-3">
                    <Clock className="size-8 text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">No attendance schedule configured yet.</p>
                    {isLocalAdmin && (
                      <Button size="sm" onClick={() => setWizardOpen(true)} className="py-2 px-4 text-xs">
                        Launch Attendance Setup Wizard
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {schedules.map((s) => (
                    <Card key={s.id} className={s.status === 'active' ? 'border-primary shadow-xs' : ''}>
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{s.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              AM: {s.morning_open?.slice(0, 5)} – {s.morning_close?.slice(0, 5)} (late +{s.morning_late_threshold}m) · PM: {s.afternoon_open?.slice(0, 5)} – {s.afternoon_close?.slice(0, 5)} (late +{s.afternoon_late_threshold}m)
                            </p>
                          </div>
                          {isLocalAdmin && (
                            <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
                              {s.status === 'active' ? (
                                <Badge className="py-0.5 px-2.5 text-xs bg-emerald-600 text-white">Active</Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    try {
                                      await attendanceService.activateSchedule(s.id);
                                      loadSchedules();
                                      toast.success('Schedule activated');
                                    } catch {
                                      toast.error('Failed to activate schedule');
                                    }
                                  }}
                                  className="py-1.5 px-3 text-xs h-8"
                                >
                                  Activate
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingSchedule(s);
                                  setScheduleFormOpen(true);
                                }}
                                className="py-1.5 px-3 text-xs h-8"
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setOverrideScheduleId(s.id);
                                  setOverrideModalOpen(true);
                                }}
                                className="py-1.5 px-3 text-xs h-8"
                              >
                                Override
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <AttendanceDetailModal
        record={modalRecord}
        trainee={modalTrainee}
        sessionId={dayData?.session_id ?? null}
        canOverride={canOverride}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onStatusUpdated={() => {
          if (selectedDate) loadDayAttendance(selectedDate);
          loadOverview();
        }}
      />

      <ScheduleFormModal
        isOpen={scheduleFormOpen}
        onClose={() => setScheduleFormOpen(false)}
        programId={programId!}
        schedule={editingSchedule}
        onSaved={() => {
          setScheduleFormOpen(false);
          loadSchedules();
        }}
      />

      <ScheduleOverrideModal
        isOpen={overrideModalOpen}
        onClose={() => setOverrideModalOpen(false)}
        scheduleId={overrideScheduleId}
        onSaved={() => {
          setOverrideModalOpen(false);
          loadSchedules();
        }}
      />

      {programId && (
        <AttendanceSetupWizard
          isOpen={wizardOpen}
          onClose={() => setWizardOpen(false)}
          onComplete={() => {
            setWizardOpen(false);
            loadSchedules();
            loadOverview();
            if (selectedDate) loadDayAttendance(selectedDate);
          }}
          programId={programId}
          programName={program?.name}
          programStartDate={program?.start_date || program?.startDate}
          programEndDate={program?.end_date || program?.endDate}
          existingSessionCount={sessions.length}
          existingSchedule={activeSchedule}
        />
      )}

      {/* Day Attendance Modal — Fluid scrim & panel */}
      {dayModalOpen && dayModalDate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Attendance for ${dayModalDate}`}
          className="att-modal-scrim fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setDayModalOpen(false)}
        >
          <div
            className="att-modal-panel bg-card border shadow-xl rounded-xl overflow-hidden flex flex-col w-full max-w-[min(92vw,500px)] max-h-[min(90vh,80vh)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-semibold">
                  {new Date(dayModalDate + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {dayData ? `${allDayRecords.length + noRecordTrainees.length} enrolled trainees` : 'Loading…'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDayModalOpen(false)}
                aria-label="Close day summary"
                className="size-9 rounded-full shrink-0"
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="overflow-y-auto p-4 space-y-4 min-h-0">
              {dayLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-14 rounded-lg" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="flex gap-2 text-xs flex-wrap">
                    <div className="flex items-center gap-1.5 py-1 px-2.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                      <span className="size-2 rounded-full bg-emerald-500" />
                      <span>{allDayRecords.filter((r) => r.status === 'present').length} Present</span>
                    </div>
                    <div className="flex items-center gap-1.5 py-1 px-2.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                      <span className="size-2 rounded-full bg-amber-500" />
                      <span>{allDayRecords.filter((r) => r.status === 'late').length} Late</span>
                    </div>
                    <div className="flex items-center gap-1.5 py-1 px-2.5 rounded-full bg-muted text-muted-foreground">
                      <span className="size-2 rounded-full bg-border" />
                      <span>{noRecordTrainees.length} No Record</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {allDayRecords.length > 0 || noRecordTrainees.length > 0 ? (
                      [
                        ...allDayRecords,
                        ...noRecordTrainees.map((t) => ({ ...t, isNoRecord: true })),
                      ]
                        .slice(0, 15)
                        .map((r: any, idx: number) => {
                          const t = r.isNoRecord ? r : r.trainee;
                          const status = r.isNoRecord ? 'no-record' : r.status;
                          return (
                            <button
                              key={r.id || idx}
                              type="button"
                              onClick={() => {
                                openModal(r.isNoRecord ? null : r, t);
                                setDayModalOpen(false);
                              }}
                              className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left cursor-pointer"
                            >
                              <div className="size-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                                {t?.first_name?.[0]}
                                {t?.last_name?.[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {t?.first_name} {t?.last_name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {r.isNoRecord
                                    ? dayData?.session_id
                                      ? 'No record · Click to mark'
                                      : 'No session scheduled'
                                    : formatTime(r.morning_time_in ?? r.afternoon_time_out ?? r.check_in_time)}
                                </p>
                              </div>
                              <span
                                className={`size-2.5 rounded-full shrink-0 ${
                                  status === 'present'
                                    ? 'bg-emerald-500'
                                    : status === 'late'
                                      ? 'bg-amber-500'
                                      : status === 'absent'
                                        ? 'bg-red-500'
                                        : status === 'excused'
                                          ? 'bg-purple-500'
                                          : 'bg-border'
                                }`}
                              />
                            </button>
                          );
                        })
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        No enrolled trainees or attendance records yet.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
