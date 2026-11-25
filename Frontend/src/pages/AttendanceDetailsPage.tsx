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
import { useState, useEffect } from 'react';
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
  ChevronLeft, Camera, MapPin, Smartphone, FileText, AlertCircle, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import attendanceService from '../services/attendanceService';
import type { AttendanceRecord, AttendanceWindowStatus } from '../services/attendanceService';
import { getFileUrl, apiClient } from '../services/api';

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

function gpsAccuracyColor(acc?: number): string {
  if (!acc) return 'text-muted-foreground';
  if (acc < 50)  return 'text-green-600 dark:text-green-400';
  if (acc < 200) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

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
    if (!path) return;

    const loadImage = async () => {
      setLoading(true);
      setError(false);
      try {
        const fileUrl = getFileUrl(path);
        // Fetch the image with authentication headers
        const response = await apiClient.get(fileUrl, {
          responseType: 'blob',
        });
        const blob = response.data as Blob;
        const url = URL.createObjectURL(blob);
        setImageUrl(url);
      } catch (err) {
        console.error(`[SelfiePanel] Failed to load ${label} image:`, err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadImage();

    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [path]);

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

  const fileUrl = getFileUrl(path);
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
        href={fileUrl}
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

  useEffect(() => {
    console.log('[AttendanceDetailsPage] Mounted with date:', date);
    if (!date) {
      console.log('[AttendanceDetailsPage] No date parameter, returning');
      return;
    }
    
    setLoading(true);
    console.log('[AttendanceDetailsPage] Starting data fetch for:', date);
    
    // Fetch attendance record (required)
    attendanceService.getMyAttendanceByDate(date)
      .then((res) => {
        console.log('[AttendanceDetailsPage] Attendance data loaded:', res.data);
        const records = res.data ?? [];
        setRecord(records[0] ?? null);
        if (!records[0]) {
          console.log('[AttendanceDetailsPage] No attendance record found for date:', date);
        } else {
          console.log('[AttendanceDetailsPage] Attendance record found:', records[0]);
        }
      })
      .catch((error) => {
        console.error('[AttendanceDetailsPage] Failed to load attendance:', error);
        console.error('[AttendanceDetailsPage] Error details:', {
          message: error?.message,
          response: error?.response?.status,
          responseData: error?.response?.data,
        });
        toast.error('Failed to load attendance details');
        setRecord(null);
      })
      .finally(() => {
        console.log('[AttendanceDetailsPage] Setting loading to false');
        setLoading(false);
      });
    
    // Fetch window status separately (optional, don't block if it fails)
    attendanceService.getWindowStatus()
      .then((res) => {
        console.log('[AttendanceDetailsPage] Window status loaded:', res.data);
        setWindowStatus(res.data ?? null);
      })
      .catch((error) => {
        // Window status is optional - if it fails, just don't show it
        console.debug('[AttendanceDetailsPage] Window status fetch failed (optional):', error?.message);
        setWindowStatus(null);
      });
  }, [date]);

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
      <div className="max-w-2xl mx-auto space-y-4">

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
        {!record && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
              {windowStatus?.isOpen ? (
                <>
                  <Camera className="size-10 text-blue-500" />
                  <p className="text-muted-foreground">Attendance window is open!</p>
                  <p className="text-xs text-muted-foreground">Go back to the calendar to take attendance.</p>
                  <Button 
                    variant="default" 
                    onClick={() => navigate('/trainee/attendance')}
                    className="mt-2"
                  >
                    Back to Calendar
                  </Button>
                </>
              ) : (
                <>
                  <AlertCircle className="size-10 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No attendance record for this date.</p>
                  <Button variant="outline" onClick={() => navigate('/trainee/attendance')}>
                    Back to Calendar
                  </Button>
                </>
              )}
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
                {hasGps ? (
                  <div className="space-y-3 pb-3">
                    {/* Google Maps embed */}
                    <iframe
                      title="Attendance location"
                      src={`https://maps.google.com/maps?q=${record.gps_lat},${record.gps_lng}&z=16&output=embed`}
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
                      {record.gps_accuracy != null && (
                        <div>
                          <p className="text-xs text-muted-foreground">Accuracy</p>
                          <p className={gpsAccuracyColor(record.gps_accuracy)}>
                            ±{record.gps_accuracy.toFixed(0)} m
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
                ) : (
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
    </DashboardLayout>
  );
}


