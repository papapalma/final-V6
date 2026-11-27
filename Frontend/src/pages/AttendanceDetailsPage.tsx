/**
 * AttendanceDetailsPage  —  /trainee/attendance/:date
 *
 * Read-only expandable view of a single day's attendance record.
 * Sections (shadcn Accordion):
 *   1. Attendance Summary
 *   2. Selfie Verification  (images via getFileUrl)
 *   3. GPS Information      (Google Maps iframe)
 *   4. Device Information
 *   5. Additional Metadata
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '../components/ui/accordion';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import {
  ChevronLeft, Camera, MapPin, Smartphone, FileText, AlertCircle, Clock, Sun, Moon, Info, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import attendanceService from '../services/attendanceService';
import type { AttendanceRecord, AttendanceWindowStatus } from '../services/attendanceService';
import { getFileUrl, apiClient } from '../services/api';
import AttendanceSubmitFlow from '../components/attendance/AttendanceSubmitFlow';
import { getGpsAccuracyInfo } from '../lib/gpsFormat';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function formatTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatTimeHM(time?: string): string {
  if (!time) return '—';
  return time; // Already in HH:MM format
}

function getTodayDateStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseTimeMinutes(time?: string | null): number | null {
  if (!time) return null;
  const parts = time.split(':').map(Number);
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
  return parts[0] * 60 + parts[1];
}

function formatMinutes12h(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(normalized / 60);
  const m = normalized % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatTime12h(time?: string | null): string {
  const mins = parseTimeMinutes(time);
  return mins === null ? '—' : formatMinutes12h(mins);
}

function formatLateCutoff12h(openTime?: string | null, thresholdMinutes?: number | null): string | null {
  const openMins = parseTimeMinutes(openTime);
  if (openMins === null || thresholdMinutes == null || thresholdMinutes <= 0) return null;
  return formatMinutes12h(openMins + thresholdMinutes);
}

function formatCountdownShort(seconds?: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const totalMins = Math.ceil(seconds / 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function isPastLateCutoffNow(windowStatus: AttendanceWindowStatus | null): boolean {
  if (!windowStatus?.isOpen || !windowStatus.session_label) return false;
  const openTime =
    windowStatus.session_label === 'morning'
      ? windowStatus.morning_open ?? windowStatus.window_open
      : windowStatus.afternoon_open ?? windowStatus.window_open;
  const threshold =
    windowStatus.session_label === 'morning'
      ? windowStatus.morning_late_threshold
      : windowStatus.afternoon_late_threshold;

  const openMins = parseTimeMinutes(openTime);
  if (openMins === null || threshold == null) return false;
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return nowMins > openMins + threshold;
}

function formatDuration(morningIn?: string, afternoonOut?: string): string {
  if (!morningIn || !afternoonOut) return '—';
  const diff = new Date(afternoonOut).getTime() - new Date(morningIn).getTime();
  if (diff <= 0) return '—';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const STATUS_BADGE: Record<string, string> = {
  present: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  late:    'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  absent:  'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  excused: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  pending: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};

// ---------------------------------------------------------------------------
// Selfie panel sub-component
// ---------------------------------------------------------------------------

function SelfiePanel({
  path, label,
}: { path?: string | null; label: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!path) {
      setImageUrl(null);
      setLoading(false);
      setError(false);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;

    const loadImage = async () => {
      setLoading(true);
      setError(false);
      try {
        const fileUrl = getFileUrl(path);
        // Fetch the image with authentication headers
        const response = await apiClient.get(fileUrl, {
          responseType: 'blob',
        });
        if (!active) return;
        const blob = response.data as Blob;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      } catch (err) {
        if (!active) return;
        console.error(`[SelfiePanel] Failed to load ${label} image:`, err);
        setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadImage();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [path, label]);

  if (!path) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 aspect-square p-4">
        <Camera className="size-8 text-muted-foreground/50" />
        <p className="text-xs text-muted-foreground">{label}: Not submitted</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 aspect-square p-4">
        <Skeleton className="w-full h-full rounded-lg" />
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 aspect-square p-4">
        <AlertCircle className="size-8 text-red-500" />
        <p className="text-xs text-muted-foreground">{label}: Failed to load image</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="rounded-lg overflow-hidden border aspect-square">
        <img
          src={imageUrl}
          alt={`${label} selfie`}
          className="w-full h-full object-cover"
        />
      </div>
      <a
        href={imageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-primary underline underline-offset-2 block"
      >
        View full size
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AttendanceDetailsPage() {
  const { date } = useParams<{ date: string }>();
  const navigate  = useNavigate();

  const [loading, setLoading] = useState(true);
  const [record,  setRecord]  = useState<AttendanceRecord | null>(null);
  const [windowStatus, setWindowStatus] = useState<AttendanceWindowStatus | null>(null);

  const loadAttendanceData = useCallback(() => {
    if (!date) return;

    setLoading(true);

    // Fetch attendance record (required)
    attendanceService.getMyAttendanceByDate(date)
      .then((res) => {
        const records = res.data ?? [];
        setRecord(records[0] ?? null);
      })
      .catch(() => {
        toast.error('Failed to load attendance details');
        setRecord(null);
      })
      .finally(() => {
        setLoading(false);
      });

    // Fetch window status separately (optional, don't block if it fails)
    attendanceService.getWindowStatus()
      .then((res) => {
        setWindowStatus(res.data ?? null);
      })
      .catch(() => {
        setWindowStatus(null);
      });
  }, [date]);

  useEffect(() => {
    loadAttendanceData();
  }, [loadAttendanceData]);

  const isToday = Boolean(date && date === getTodayDateStr());
  const hasSchedule = Boolean(windowStatus?.morning_open || windowStatus?.afternoon_open);
  const activeSessionName =
    windowStatus?.session_label === 'afternoon' ? 'Afternoon' : 'Morning';
  const activeCutoff12h =
    windowStatus?.session_label === 'afternoon'
      ? formatLateCutoff12h(
          windowStatus.afternoon_open ?? windowStatus.window_open,
          windowStatus.afternoon_late_threshold
        )
      : formatLateCutoff12h(
          windowStatus?.morning_open ?? windowStatus?.window_open,
          windowStatus?.morning_late_threshold
        );
  const isLateRightNow = isPastLateCutoffNow(windowStatus);
  const morningCutoff12h = formatLateCutoff12h(
    windowStatus?.morning_open,
    windowStatus?.morning_late_threshold
  );
  const afternoonCutoff12h = formatLateCutoff12h(
    windowStatus?.afternoon_open,
    windowStatus?.afternoon_late_threshold
  );
  const nextOpenCountdown = formatCountdownShort(windowStatus?.seconds_until_open);
  const closeCountdown = formatCountdownShort(windowStatus?.seconds_until_close);

  const hasGps = record?.gps_lat != null && record?.gps_lng != null;

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <DashboardLayout title="Attendance Details">
        <div className="space-y-4 max-w-2xl mx-auto">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-6 w-64" />
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Attendance Details">
      <AttendanceSubmitFlow windowStatus={windowStatus} onComplete={loadAttendanceData}>
        {(triggerAttendance) => (
          <div className="max-w-2xl mx-auto space-y-6">

            {/* ── Back button + header ── */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost" size="icon"
                onClick={() => navigate('/trainee/attendance')}
                aria-label="Back to calendar"
              >
                <ChevronLeft className="size-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">{date ? formatDate(date) : 'Attendance Details'}</h1>
                {record && (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${STATUS_BADGE[record.status] ?? STATUS_BADGE.pending}`}>
                    {record.status}
                  </span>
                )}
              </div>
            </div>

            {/* ── No record state ── */}
            {!record && isToday && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="flex flex-col items-center justify-center p-6 sm:p-8 text-center gap-3">
                    {windowStatus?.isOpen ? (
                      <>
                        <div className={`flex size-12 items-center justify-center rounded-full ${isLateRightNow ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                          <Camera className="size-6" />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-center gap-2 flex-wrap">
                            <h2 className="text-base sm:text-lg font-semibold">
                              {activeSessionName} Attendance Window Open
                            </h2>
                            {isLateRightNow ? (
                              <Badge className="py-0.5 px-2 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-0">
                                Late Check-In
                              </Badge>
                            ) : (
                              <Badge className="py-0.5 px-2 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-0">
                                <CheckCircle2 className="size-3 mr-1" />
                                On Time
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground max-w-md mx-auto">
                            {isLateRightNow && activeCutoff12h
                              ? `You can still check in now — submissions after ${activeCutoff12h} are marked Late.`
                              : activeCutoff12h
                                ? `Check in by ${activeCutoff12h} to be marked Present.`
                                : 'Submit your live selfie to record your attendance for this session.'}
                          </p>
                          {windowStatus.window_close && (
                            <p className="text-xs text-muted-foreground">
                              Window closes at {formatTime12h(windowStatus.window_close)}
                              {closeCountdown ? ` (in ${closeCountdown})` : ''}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                          <Button
                            onClick={triggerAttendance}
                            className="py-2.5 px-4"
                          >
                            <Camera className="size-4 mr-2" />
                            Punch In Now
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => navigate('/trainee/attendance')}
                            className="py-2.5 px-4"
                          >
                            Back to Calendar
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <Clock className="size-6" />
                        </div>
                        <div className="space-y-1.5">
                          <h2 className="text-base sm:text-lg font-semibold">
                            Attendance Window Currently Closed
                          </h2>
                          <p className="text-sm text-muted-foreground max-w-md mx-auto">
                            {windowStatus?.window_open
                              ? `${activeSessionName} session opens at ${formatTime12h(windowStatus.window_open)}${nextOpenCountdown ? ` (in ${nextOpenCountdown})` : ''}.`
                              : 'Self-service check-in is currently closed for today. Review the schedule below for open hours.'}
                          </p>
                        </div>
                        <div className="pt-2">
                          <Button
                            variant="outline"
                            onClick={() => navigate('/trainee/attendance')}
                            className="py-2.5 px-4"
                          >
                            Back to Calendar
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* ── Attendance Schedule & Rules Card ── */}
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <Info className="size-4 text-primary shrink-0" />
                      <h3 className="text-sm font-semibold">Attendance Schedule &amp; Rules</h3>
                    </div>

                    {hasSchedule && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {windowStatus?.morning_open && windowStatus?.morning_close && (
                          <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                              <Sun className="size-3.5 text-amber-500" />
                              <span>Morning Session</span>
                            </div>
                            <p className="text-sm font-semibold tabular-nums">
                              {formatTime12h(windowStatus.morning_open)} – {formatTime12h(windowStatus.morning_close)}
                            </p>
                            {morningCutoff12h && (
                              <p className="text-xs text-muted-foreground">
                                Present until {morningCutoff12h} · Late after {morningCutoff12h}
                              </p>
                            )}
                          </div>
                        )}

                        {windowStatus?.afternoon_open && windowStatus?.afternoon_close && (
                          <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                              <Moon className="size-3.5 text-blue-500" />
                              <span>Afternoon Session</span>
                            </div>
                            <p className="text-sm font-semibold tabular-nums">
                              {formatTime12h(windowStatus.afternoon_open)} – {formatTime12h(windowStatus.afternoon_close)}
                            </p>
                            {afternoonCutoff12h && (
                              <p className="text-xs text-muted-foreground">
                                Present until {afternoonCutoff12h} · Late after {afternoonCutoff12h}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <ul className="space-y-2 border-t pt-4 text-xs text-muted-foreground list-disc pl-4">
                      <li>
                        <span className="font-medium text-foreground">On-Time vs. Late:</span>{' '}
                        {windowStatus?.morning_late_threshold != null
                          ? `Check in within ${windowStatus.morning_late_threshold} min of opening to be marked Present. Check-ins after the cutoff up until closing time are still accepted and marked Late.`
                          : 'Check in within the grace period after opening to be marked Present; check-ins after the cutoff up until closing time are marked Late.'}
                      </li>
                      <li>
                        <span className="font-medium text-foreground">Independent Half-Day Sessions:</span>{' '}
                        Morning and Afternoon are tracked separately — missing Morning still lets you check in for Afternoon.
                      </li>
                      <li>
                        <span className="font-medium text-foreground">Verification &amp; Window Cutoff:</span>{' '}
                        A live selfie and GPS location are required while a window is open. Self-service check-in locks automatically once the closing time passes.
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            )}

            {!record && !isToday && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
                  <AlertCircle className="size-10 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No attendance record for this date.</p>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/trainee/attendance')}
                    className="py-2 px-3.5"
                  >
                    Back to Calendar
                  </Button>
                </CardContent>
              </Card>
            )}

        {/* ── Accordion sections ── */}
        {record && (
          <Accordion type="multiple" defaultValue={['summary', 'session', 'selfie']} className="space-y-2">

            {/* 1. Attendance Summary */}
            <AccordionItem value="summary" className="border rounded-lg px-4">
              <AccordionTrigger className="text-sm font-semibold">
                <span className="flex items-center gap-2"><FileText className="size-4" /> Attendance Summary</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm pb-3">
                  {[
                    ['Date',             date ? formatDate(date) : '—'],
                    ['Status',           record.status],
                    ['Morning Time In',  formatTime(record.morning_time_in  ?? record.check_in_time)],
                    ['Afternoon Out',    formatTime(record.afternoon_time_out ?? record.check_out_time)],
                    ['Total Duration',   formatDuration(
                                          record.morning_time_in  ?? record.check_in_time,
                                          record.afternoon_time_out ?? record.check_out_time
                                        )],
                    ['Late Duration',    record.late_duration_minutes && record.late_duration_minutes > 0
                                          ? `${record.late_duration_minutes} min` : '—'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="font-medium capitalize">{value}</p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 1.5. Session Window Information */}
            {windowStatus && (
              <AccordionItem value="session" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-semibold">
                  <span className="flex items-center gap-2"><Clock className="size-4" /> Session Window</span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pb-3">
                    {/* Morning Session */}
                    {windowStatus.morning_open && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase">Morning Session</h4>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Opens</p>
                            <p className="font-medium">{formatTimeHM(windowStatus.morning_open)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Closes</p>
                            <p className="font-medium">{formatTimeHM(windowStatus.morning_close)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Late Threshold</p>
                            <p className="font-medium">{windowStatus.morning_late_threshold} min after open</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Late Mark At</p>
                            <p className="font-medium">
                              {(() => {
                                const [h, m] = windowStatus.morning_open.split(':').map(Number);
                                const lateMin = h * 60 + m + windowStatus.morning_late_threshold;
                                const lateH = Math.floor(lateMin / 60) % 24;
                                const lateM = lateMin % 60;
                                return `${String(lateH).padStart(2, '0')}:${String(lateM).padStart(2, '0')}`;
                              })()}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Afternoon Session */}
                    {windowStatus.afternoon_open && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase">Afternoon Session</h4>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Opens</p>
                            <p className="font-medium">{formatTimeHM(windowStatus.afternoon_open)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Closes</p>
                            <p className="font-medium">{formatTimeHM(windowStatus.afternoon_close)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Late Threshold</p>
                            <p className="font-medium">{windowStatus.afternoon_late_threshold} min after open</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Late Mark At</p>
                            <p className="font-medium">
                              {(() => {
                                const [h, m] = windowStatus.afternoon_open.split(':').map(Number);
                                const lateMin = h * 60 + m + windowStatus.afternoon_late_threshold;
                                const lateH = Math.floor(lateMin / 60) % 24;
                                const lateM = lateMin % 60;
                                return `${String(lateH).padStart(2, '0')}:${String(lateM).padStart(2, '0')}`;
                              })()}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* 2. Selfie Verification */}
            <AccordionItem value="selfie" className="border rounded-lg px-4">
              <AccordionTrigger className="text-sm font-semibold">
                <span className="flex items-center gap-2"><Camera className="size-4" /> Selfie Verification</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-4 pb-3">
                  <SelfiePanel path={record.selfie_morning_path}   label="Morning" />
                  <SelfiePanel path={record.selfie_afternoon_path} label="Afternoon" />
                </div>
                <p className="text-xs text-muted-foreground pb-2">
                  📋 Pending admin review — selfies are verified manually by staff.
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* 3. GPS Information */}
            <AccordionItem value="gps" className="border rounded-lg px-4">
              <AccordionTrigger className="text-sm font-semibold">
                <span className="flex items-center gap-2"><MapPin className="size-4" /> GPS Information</span>
              </AccordionTrigger>
              <AccordionContent>
                {hasGps ? (() => {
                  const accInfo = getGpsAccuracyInfo(record.gps_accuracy);
                  return (
                    <div className="space-y-3 pb-3">
                      {/* Google Maps embed */}
                      <iframe
                        title="Attendance location"
                        src={`https://maps.google.com/maps?q=${record.gps_lat},${record.gps_lng}&z=${accInfo?.mapZoom ?? 16}&output=embed`}
                        className="w-full h-48 rounded-lg border"
                        loading="lazy"
                      />
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Latitude</p>
                          <p className="font-mono">{record.gps_lat?.toFixed(6)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Longitude</p>
                          <p className="font-mono">{record.gps_lng?.toFixed(6)}</p>
                        </div>
                        {record.gps_address && (
                          <div className="col-span-2">
                            <p className="text-xs text-muted-foreground">Address</p>
                            <p>{record.gps_address}</p>
                          </div>
                        )}
                        {accInfo && (
                          <div className="col-span-2">
                            <p className="text-xs text-muted-foreground">Accuracy</p>
                            <p className={`font-medium ${accInfo.textClass}`}>
                              {accInfo.formatted} · {accInfo.quality}
                            </p>
                          </div>
                        )}
                      </div>
                      <a
                        href={`https://maps.google.com/maps?q=${record.gps_lat},${record.gps_lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary underline underline-offset-2"
                      >
                        View on Google Maps ↗
                      </a>
                    </div>
                  );
                })() : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground pb-3">
                    <MapPin className="size-4" />
                    GPS data was not captured for this submission.
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* 4. Device Information */}
            <AccordionItem value="device" className="border rounded-lg px-4">
              <AccordionTrigger className="text-sm font-semibold">
                <span className="flex items-center gap-2"><Smartphone className="size-4" /> Device Information</span>
              </AccordionTrigger>
              <AccordionContent>
                {record.device_info ? (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm pb-3">
                    {([
                      ['Device / Browser', ((record.device_info as any).device_model || record.device_info.browser) as string],
                      ['OS / Platform',    ((record.device_info as any).os_version || (record.device_info as any).os) as string],
                      ['Network',          record.device_info.networkType as string],
                      ['IP Address',       record.device_info.ip as string],
                      ['Timezone',         record.device_info.timezone as string],
                      ['Battery',          record.device_info.batteryLevel != null
                                              ? `${record.device_info.batteryLevel}%` : ''],
                      ['App Version',      ((record.device_info as any).app_version || record.device_info.appVersion) as string],
                    ] as [string, string][])
                      .filter(([, v]) => v && v !== 'undefined')
                      .map(([label, value]) => (
                        <div key={label}>
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="font-medium truncate text-xs sm:text-sm">{value || '—'}</p>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground pb-3">No device information recorded.</p>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* 5. Additional Metadata */}
            <AccordionItem value="meta" className="border rounded-lg px-4">
              <AccordionTrigger className="text-sm font-semibold">
                Additional Metadata
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm pb-3">
                  {([
                    ['Attempt #',         String(record.attempt_number ?? 1)],
                    ['Submission Method', record.submission_method?.replace('_', ' ') ?? '—'],
                    ['Session ID',        record.session_id?.slice(0, 8) + '…'],
                    ['Timezone',          record.device_info?.timezone as string ?? '—'],
                  ] as [string, string][]).map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="font-medium">{value}</p>
                    </div>
                  ))}
                </div>
                {record.attempt_number && record.attempt_number > 1 && (
                  <Badge variant="outline" className="text-xs">
                    Multiple attempts — latest record shown
                  </Badge>
                )}
              </AccordionContent>
            </AccordionItem>

          </Accordion>
        )}
          </div>
        )}
      </AttendanceSubmitFlow>
    </DashboardLayout>
  );
}


