/**
 * AttendancePage  —  /programs/:id/attendance  (local_admin role)
 * 
 * Features:
 * - Monthly calendar view with mini day cards
 * - Punch buttons for Morning/Afternoon
 * - Overview, Records, Schedules tabs
 * 
 * Uses existing theme tokens:
 * - Present → secondary (#43A047)
 * - Late → accent (#FBC02D)
 * - Absent → destructive (#d32f2f)
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
  ChevronLeft, ChevronRight, Flame, TrendingUp,
  Calendar, Clock, X,
} from 'lucide-react';
import { toast } from 'sonner';
import programService from '../services/programService';
import attendanceService from '../services/attendanceService';
import { useAuth } from '../contexts/AuthContext';
import AttendanceDetailModal from '../components/attendance/AttendanceDetailModal';
import ScheduleFormModal from '../components/attendance/ScheduleFormModal';
import ScheduleOverrideModal from '../components/attendance/ScheduleOverrideModal';
import { getFileUrl } from '../services/api';
import type { DayAttendanceData, AttendanceRecord, AttendanceSchedule } from '../services/attendanceService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AttendanceStatus = 'present' | 'late' | 'absent' | 'pending';

interface DayRecord {
  date: string;
  morning?: AttendanceStatus;
  afternoon?: AttendanceStatus;
}

interface MonthData {
  [date: string]: DayRecord;
}

interface StoredAttendance {
  [programId: string]: MonthData;
}

const STATUS_BADGE: Record<string, string> = {
  present: 'bg-[var(--secondary)]/20 text-[var(--secondary)]',
  late: 'bg-[var(--accent)]/20 text-[var(--accent)]',
  absent: 'bg-[var(--destructive)]/20 text-[var(--destructive)]',
  excused: 'bg-purple-100 text-purple-800',
  pending: 'bg-blue-100 text-blue-800',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function getStatusColor(status: AttendanceStatus | undefined): string {
  switch (status) {
    case 'present': return 'bg-[var(--secondary)]';
    case 'late': return 'bg-[var(--accent)]';
    case 'absent': return 'bg-[var(--destructive)]';
    default: return 'bg-border';
  }
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
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'bmdc_localadmin_attendance';

function loadAttendance(): StoredAttendance {
  try {
    const data = window.localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch { return {}; }
}

function saveAttendanceData(data: StoredAttendance): void {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch (e) { console.error('Failed to save:', e); }
}

function seedMockData(_programId: string): MonthData {
  const today = new Date();
  const data: MonthData = {};
  let generated = 0;
  
  for (let i = 1; i <= 30 && generated < 15; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    if (isWeekend(date)) continue;
    
    const dateKey = formatDateKey(date);
    const random = Math.random();
    
    if (random < 0.7) {
      data[dateKey] = { date: dateKey, morning: Math.random() < 0.15 ? 'late' : 'present', afternoon: Math.random() < 0.15 ? 'late' : 'present' };
    } else if (random < 0.85) {
      data[dateKey] = { date: dateKey, morning: 'present', afternoon: Math.random() < 0.5 ? 'present' : 'absent' };
    } else {
      data[dateKey] = { date: dateKey, morning: Math.random() < 0.5 ? 'present' : 'absent', afternoon: Math.random() < 0.5 ? 'present' : 'absent' };
    }
    generated++;
  }
  return data;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function AttendancePage() {
  const { id: programId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthReady, hasPermission, user } = useAuth();
  
  // State
  const [program, setProgram] = useState<any>(null);
  const [displayMonth, setDisplayMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(formatDateKey(new Date()));
  const [attendanceData, setAttendanceData] = useState<MonthData>({});
  const [dayData, setDayData] = useState<DayAttendanceData | null>(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [schedules, setSchedules] = useState<AttendanceSchedule[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [scheduleFormOpen, setScheduleFormOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<AttendanceSchedule | undefined>();
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideScheduleId, setOverrideScheduleId] = useState<string>('');
  const [modalRecord, setModalRecord] = useState<AttendanceRecord | null>(null);
  const [modalTrainee, setModalTrainee] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [dayModalDate, setDayModalDate] = useState<string | null>(null);
  
  const canOverride = user?.role === 'local_admin';

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = displayMonth.getFullYear();
    const month = displayMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days: (null | { date: Date; dateKey: string })[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({ date: new Date(year, month, day), dateKey: formatDateKey(new Date(year, month, day)) });
    }
    return days;
  }, [displayMonth]);

  // Load program
  useEffect(() => {
    if (!programId || !isAuthReady) return;
    if (!hasPermission('canManagePrograms')) {
      toast.error('No permission');
      navigate('/programs', { replace: true });
      return;
    }
    programService.getProgramById(programId)
      .then((prog) => setProgram(prog))
      .catch((err: any) => { if (err?.status === 403) { toast.error('Access denied'); navigate('/programs', { replace: true }); } else toast.error('Failed to load program'); })
  }, [programId, isAuthReady, hasPermission, navigate]);

  // Load attendance data
  useEffect(() => {
    if (!programId) return;
    const stored = loadAttendance();
    const programData = stored[programId];
    if (programData && Object.keys(programData).length > 0) setAttendanceData(programData);
    else { const seeded = seedMockData(programId); setAttendanceData(seeded); saveAttendanceData({ ...stored, [programId]: seeded }); }
  }, [programId]);

  // Load day attendance
  useEffect(() => {
    if (!selectedDate || !programId) return;
    setDayLoading(true);
    attendanceService.getDayAttendance(programId, selectedDate)
      .then((res) => setDayData(res.data ?? null))
      .catch(() => toast.error('Failed to load'))
      .finally(() => setDayLoading(false));
  }, [selectedDate, programId]);

  // Load schedules
  const loadSchedules = useCallback(async () => {
    if (!programId) return;
    setSchedulesLoading(true);
    try { const res = await attendanceService.getSchedules(programId); setSchedules(res.data ?? []); }
    catch { /* silent */ }
    finally { setSchedulesLoading(false); }
  }, [programId]);

  useEffect(() => { loadSchedules(); }, [loadSchedules]);

  // Stats
  const stats = useMemo(() => {
    let presentCount = 0, totalSessions = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      if (isWeekend(date) || date > today) continue;
      totalSessions += 2;
      const record = attendanceData[formatDateKey(date)];
      if (record?.morning === 'present' || record?.morning === 'late') presentCount++;
      if (record?.afternoon === 'present' || record?.afternoon === 'late') presentCount++;
    }
    return { presentCount, totalSessions, rate: totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0 };
  }, [attendanceData]);

  const openModal = (record: AttendanceRecord | null, trainee: any) => { setModalRecord(record); setModalTrainee(trainee); setModalOpen(true); };

  const goToPrevMonth = () => { const d = new Date(displayMonth); d.setMonth(displayMonth.getMonth() - 1); setDisplayMonth(d); };
  const goToNextMonth = () => { const d = new Date(displayMonth); d.setMonth(displayMonth.getMonth() + 1); setDisplayMonth(d); };
  const goToToday = () => { setDisplayMonth(new Date()); setSelectedDate(formatDateKey(new Date())); };

  const selectedDateObj = selectedDate ? new Date(selectedDate + 'T00:00:00') : null;
  const today = new Date();

  const morningRecords = dayData?.records.filter(r => r.morning_time_in || r.check_in_time) ?? [];
  const afternoonRecords = dayData?.records.filter(r => r.afternoon_time_out || r.check_out_time) ?? [];
  const noRecordTrainees = dayData?.noRecord ?? [];

  return (
    <DashboardLayout>
      <div className="min-h-[calc(100dvh-80px)] overflow-visible p-3">
        <div className="min-h-[calc(100dvh-80px)] flex flex-col max-w-5xl mx-auto">
          
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 shrink-0">
            <div className="flex min-w-0 items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => navigate('/programs')} className="shrink-0 h-8 w-8">
                <ChevronLeft className="size-4" />
              </Button>
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold" style={{ fontFamily: 'Poppins, sans-serif' }}>{program?.name || 'Attendance'}</h1>
                <p className="text-[10px] text-muted-foreground">{today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <div className="text-center px-2"><div className="flex items-center gap-1"><TrendingUp className="size-3" style={{ color: 'var(--secondary)' }} /></div><p className="text-xs font-bold" style={{ color: 'var(--secondary)' }}>{stats.presentCount}/{stats.totalSessions}</p></div>
              <div className="text-center px-2"><div className="flex items-center gap-1"><Flame className="size-3" style={{ color: 'var(--accent)' }} /></div><p className="text-xs font-bold" style={{ color: 'var(--accent)' }}>{stats.rate}%</p></div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="calendar" className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-3 h-8">
              <TabsTrigger value="calendar" className="text-xs">Calendar</TabsTrigger>
              <TabsTrigger value="records" className="text-xs">Records</TabsTrigger>
              <TabsTrigger value="schedules" className="text-xs">Schedules</TabsTrigger>
            </TabsList>

            {/* TAB 1: MONTHLY CALENDAR */}
            <TabsContent value="calendar" className="flex-1 flex flex-col m-0 space-y-2 overflow-hidden">
              
              {/* Month Calendar with Mini Day Cards */}
              <Card className="border shadow-sm flex-1 overflow-hidden flex flex-col">
                <CardHeader className="py-2 px-3 pb-1 shrink-0">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="icon" onClick={goToPrevMonth} className="h-6 w-6"><ChevronLeft className="size-3" /></Button>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm">{displayMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</CardTitle>
                      <Button variant="outline" size="sm" onClick={goToToday} className="h-5 text-[10px] px-1.5">Today</Button>
                    </div>
                    <Button variant="ghost" size="icon" onClick={goToNextMonth} className="h-6 w-6"><ChevronRight className="size-3" /></Button>
                  </div>
                </CardHeader>
                
                <CardContent className="flex-1 overflow-auto p-2 pt-0">
                  {/* Table header - Day names */}
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-[10px] text-muted-foreground">
                        <th className="py-1 text-center font-medium">Sun</th>
                        <th className="py-1 text-center font-medium">Mon</th>
                        <th className="py-1 text-center font-medium">Tue</th>
                        <th className="py-1 text-center font-medium">Wed</th>
                        <th className="py-1 text-center font-medium">Thu</th>
                        <th className="py-1 text-center font-medium">Fri</th>
                        <th className="py-1 text-center font-medium">Sat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Calendar grid as table rows */}
                      {(() => {
                        const rows: (typeof calendarDays)[] = [];
                        for (let i = 0; i < calendarDays.length; i += 7) {
                          rows.push(calendarDays.slice(i, i + 7));
                        }
                        return rows.map((row, rowIdx) => (
                          <tr key={rowIdx}>
                            {row.map((day, colIdx) => {
                              if (!day) return <td key={colIdx} className="p-0.5"><div className="min-h-[50px]"></div></td>;
                              
                              const dateKey = day.dateKey;
                              const record = attendanceData[dateKey];
                              const isSelected = selectedDate === dateKey;
                              const isTodayDate = isToday(day.date);
                              const isFuture = !isPastOrToday(day.date);
                              const isWeekendDay = isWeekend(day.date);
                              
                              return (
                                <td key={colIdx} className="p-0.5">
                                  <button
                                    onClick={() => {
                                      if (!isFuture) {
                                        setSelectedDate(dateKey);
                                        setDayModalDate(dateKey);
                                        setDayModalOpen(true);
                                      }
                                    }}
                                    disabled={isFuture}
                                    className={`
                                      w-full min-h-[50px] p-1 rounded border flex flex-col items-center justify-center text-[10px] transition-all
                                      ${isSelected ? 'ring-2 ring-primary ring-offset-1 bg-primary/10 border-primary' : 'border-border'}
                                      ${isTodayDate && !isSelected ? 'border-primary bg-primary/5' : ''}
                                      ${isFuture ? 'opacity-30 cursor-not-allowed bg-muted/20' : 'hover:bg-muted/50 cursor-pointer'}
                                      ${isWeekendDay ? 'bg-muted/10' : ''}
                                    `}
                                  >
                                    <span className={`text-xs font-medium ${isTodayDate ? 'text-primary font-bold' : ''}`}>{day.date.getDate()}</span>
                                    <div className="flex gap-0.5 mt-0.5">
                                      <div className={`w-2 h-2 rounded-full ${getStatusColor(record?.morning)}`} title={record?.morning || 'No record'} />
                                      <div className={`w-2 h-2 rounded-full ${getStatusColor(record?.afternoon)}`} title={record?.afternoon || 'No record'} />
                                    </div>
                                  </button>
                                </td>
                              );
                            })}
                            {/* Fill empty cells if last row is incomplete */}
                            {row.length < 7 && Array.from({ length: 7 - row.length }).map((_, i) => (
                              <td key={`empty-end-${i}`} className="p-0.5"><div className="min-h-[50px]"></div></td>
                            ))}
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Legend */}
              <div className="flex justify-center gap-3 text-[9px] text-muted-foreground shrink-0">
                <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--secondary)' }} /><span>Present</span></div>
                <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--accent)' }} /><span>Late</span></div>
                <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--destructive)' }} /><span>Absent</span></div>
                <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-border" /><span>No record</span></div>
              </div>
            </TabsContent>

            {/* TAB 2: RECORDS */}
            <TabsContent value="records" className="flex-1 overflow-auto m-0 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="size-4 text-primary" />
                <span className="text-sm font-medium">{selectedDateObj?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) || 'Select a date'}</span>
              </div>

              {dayLoading ? (
                <div className="grid gap-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
              ) : (
                <>
                  <div>
                    <h3 className="text-xs font-semibold mb-2 flex items-center gap-1"><span>🌅</span> Morning ({morningRecords.length})</h3>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {morningRecords.map((r) => {
                        const t = r.trainee as any;
                        return (
                          <button key={r.id} onClick={() => openModal(r, t)} className="text-left rounded-lg border p-2 hover:shadow-sm hover:border-primary/50 transition-all bg-card">
                            <div className="flex items-center gap-2">
                              {t?.photo_path ? (
                                <img
                                  src={getFileUrl(t.photo_path)}
                                  alt=""
                                  className="size-8 rounded-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const next = e.currentTarget.nextElementSibling as HTMLElement | null;
                                    if (next) next.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div className={`size-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold ${t?.photo_path ? 'hidden' : ''}`}>
                                {t?.first_name?.[0]}{t?.last_name?.[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{t?.first_name} {t?.last_name}</p>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_BADGE[r.status] ?? ''}`}>{r.status}</span>
                              </div>
                              <div className="text-right text-[10px]">
                                <p className="text-muted-foreground">{formatTime(r.morning_time_in ?? r.check_in_time)}</p>
                                {r.late_duration_minutes ? <p className="text-amber-600">Late {r.late_duration_minutes}m</p> : null}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold mb-2 flex items-center gap-1"><span>🌆</span> Afternoon ({afternoonRecords.length})</h3>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {afternoonRecords.map((r) => {
                        const t = r.trainee as any;
                        return (
                          <button key={r.id} onClick={() => openModal(r, t)} className="text-left rounded-lg border p-2 hover:shadow-sm hover:border-primary/50 transition-all bg-card">
                            <div className="flex items-center gap-2">
                              {t?.photo_path ? (
                                <img
                                  src={getFileUrl(t.photo_path)}
                                  alt=""
                                  className="size-8 rounded-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const next = e.currentTarget.nextElementSibling as HTMLElement | null;
                                    if (next) next.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div className={`size-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold ${t?.photo_path ? 'hidden' : ''}`}>
                                {t?.first_name?.[0]}{t?.last_name?.[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{t?.first_name} {t?.last_name}</p>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_BADGE[r.status] ?? ''}`}>{r.status}</span>
                              </div>
                              <div className="text-right text-[10px]"><p className="text-muted-foreground">{formatTime(r.afternoon_time_out ?? r.check_out_time)}</p></div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {noRecordTrainees.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold mb-2 flex items-center gap-1 text-muted-foreground"><span>❌</span> No Record ({noRecordTrainees.length})</h3>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {noRecordTrainees.map((t: any) => (
                          <button key={t.id} onClick={() => openModal(null, t)} className="text-left rounded-lg border border-dashed p-2 hover:shadow-sm transition-all opacity-75">
                            <div className="flex items-center gap-2">
                              <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">{t.first_name?.[0]}{t.last_name?.[0]}</div>
                              <p className="text-xs font-medium truncate">{t.first_name} {t.last_name}</p>
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
              {canOverride && (
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[10px] text-muted-foreground">One schedule active at a time.</p>
                  <Button size="sm" onClick={() => { setEditingSchedule(undefined); setScheduleFormOpen(true); }} className="h-7 text-xs">+ Create</Button>
                </div>
              )}

              {schedulesLoading ? (
                <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
              ) : schedules.length === 0 ? (
                <Card className="border-dashed border-2"><CardContent className="py-6 text-center"><Clock className="size-8 text-muted-foreground mx-auto mb-2" /><p className="text-sm text-muted-foreground">No schedule yet</p></CardContent></Card>
              ) : (
                <div className="space-y-2">
                  {schedules.map((s) => (
                    <Card key={s.id} className={s.status === 'active' ? 'border-primary' : ''}>
                      <CardContent className="p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{s.name}</p>
                            <p className="break-words text-[10px] text-muted-foreground">AM: {s.morning_open?.slice(0, 5)} - {s.morning_close?.slice(0, 5)} | PM: {s.afternoon_open?.slice(0, 5)} - {s.afternoon_close?.slice(0, 5)}</p>
                          </div>
                          <div className="flex flex-wrap gap-1 sm:shrink-0 sm:justify-end">
                            {s.status === 'active' ? <Badge className="text-[10px] bg-green-600">Active</Badge> : (
                              <Button size="sm" variant="outline" onClick={async () => { try { await attendanceService.activateSchedule(s.id); loadSchedules(); toast.success('Activated'); } catch { toast.error('Failed'); } }} className="h-6 text-[10px]">Activate</Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => { setEditingSchedule(s); setScheduleFormOpen(true); }} className="h-6 text-[10px]">Edit</Button>
                            <Button size="sm" variant="ghost" onClick={() => { setOverrideScheduleId(s.id); setOverrideModalOpen(true); }} className="h-6 text-[10px]">Override</Button>
                          </div>
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
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onStatusUpdated={() => { if (selectedDate && programId) attendanceService.getDayAttendance(programId, selectedDate).then(r => setDayData(r.data ?? null)); }}
      />
      <ScheduleFormModal isOpen={scheduleFormOpen} onClose={() => setScheduleFormOpen(false)} programId={programId!} schedule={editingSchedule} onSaved={() => { setScheduleFormOpen(false); loadSchedules(); }} />
      <ScheduleOverrideModal isOpen={overrideModalOpen} onClose={() => setOverrideModalOpen(false)} scheduleId={overrideScheduleId} onSaved={() => { setOverrideModalOpen(false); loadSchedules(); }} />

      {/* Day Attendance Modal - Adaptive sizing */}
      {dayModalOpen && dayModalDate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDayModalOpen(false)}>
          <div 
            className="bg-background rounded-xl overflow-hidden flex flex-col max-w-[min(90vw,500px)] max-h-[min(90vh,80vh)]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header - Always visible */}
            <div className="p-4 border-b flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-lg font-semibold">{new Date(dayModalDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</h2>
                <p className="text-xs text-muted-foreground">
                  {dayData ? `${dayData.records.length + dayData.noRecord.length} trainees` : 'Loading...'}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setDayModalOpen(false)} className="h-10 w-10 rounded-full shrink-0">
                <X className="size-5" />
              </Button>
            </div>
            
            {/* Content - Adaptive, scrolls if needed but constrained */}
            <div className="overflow-y-auto p-4 pt-2 space-y-4 min-h-0">
              {dayLoading ? (
                <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
              ) : (
                <>
                  {/* Quick Stats */}
                  <div className="flex gap-2 text-xs flex-wrap">
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--secondary)]/10">
                      <div className="w-2 h-2 rounded-full bg-[var(--secondary)]" />
                      <span>{morningRecords.length + afternoonRecords.length} Present</span>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--accent)]/10">
                      <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                      <span>Late</span>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted">
                      <div className="w-2 h-2 rounded-full bg-border" />
                      <span>{noRecordTrainees.length} No Record</span>
                    </div>
                  </div>

                  {/* All Trainees List - Compact */}
                  <div className="space-y-1">
                    {morningRecords.length > 0 || afternoonRecords.length > 0 || noRecordTrainees.length > 0 ? (
                      [...morningRecords, ...afternoonRecords, ...noRecordTrainees.map(t => ({ ...t, isNoRecord: true }))].slice(0, 10).map((r: any, idx: number) => {
                        const t = r.isNoRecord ? r : r.trainee;
                        const status = r.isNoRecord ? 'no-record' : r.status;
                        return (
                          <button key={r.id || idx} onClick={() => { openModal(r.isNoRecord ? null : r, t); setDayModalOpen(false); }}
                            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left">
                            <div className="size-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                              {t?.first_name?.[0]}{t?.last_name?.[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{t?.first_name} {t?.last_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {r.isNoRecord ? 'No record' : formatTime(r.morning_time_in ?? r.afternoon_time_out)}
                              </p>
                            </div>
                            <div className={`w-3 h-3 rounded-full shrink-0 ${
                              status === 'present' ? 'bg-[var(--secondary)]' :
                              status === 'late' ? 'bg-[var(--accent)]' :
                              status === 'absent' ? 'bg-[var(--destructive)]' : 'bg-border'
                            }`} />
                          </button>
                        );
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">No attendance data</p>
                    )}
                    {morningRecords.length + afternoonRecords.length + noRecordTrainees.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center">+ more trainees</p>
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