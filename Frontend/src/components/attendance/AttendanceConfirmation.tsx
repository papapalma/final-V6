/**
 * AttendanceConfirmation
 *
 * Post-submission receipt screen:
 *   - Critically settled entrance (att-modal-panel, respects prefers-reduced-motion)
 *   - Authenticated selfie preview via AuthenticatedImage (attaches Bearer JWT)
 *   - Session-specific status + late duration pill
 *   - GPS coordinates + Map link
 *   - "Back to Calendar" CTA with Golden Ratio padding
 */
import { CheckCircle2, MapPin, Clock, Calendar } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import AuthenticatedImage from './AuthenticatedImage';
import type { AttendanceRecord } from '../../services/attendanceService';

interface AttendanceConfirmationProps {
  record: AttendanceRecord;
  sessionLabel: 'morning' | 'afternoon';
  onComplete: () => void;
}

const STATUS_BADGE: Record<string, { bg: string; label: string }> = {
  present: { bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', label: 'Present' },
  late:    { bg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', label: 'Late' },
  pending: { bg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', label: 'Pending' },
  absent:  { bg: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', label: 'Absent' },
};

function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString([], {
    weekday: 'short',
    month:   'short',
    day:     'numeric',
    year:    'numeric',
    hour:    '2-digit',
    minute:  '2-digit',
  });
}

export default function AttendanceConfirmation({
  record,
  sessionLabel,
  onComplete,
}: AttendanceConfirmationProps) {
  const selfiePath =
    sessionLabel === 'morning'
      ? record.selfie_morning_path
      : record.selfie_afternoon_path;

  const submittedAt =
    sessionLabel === 'morning'
      ? record.morning_time_in
      : record.afternoon_time_out;

  const sessionStatus =
    sessionLabel === 'morning'
      ? (record.morning_status ?? record.status)
      : (record.afternoon_status ?? record.status);

  const statusKey = sessionStatus ?? 'present';
  const statusCfg = STATUS_BADGE[statusKey] ?? STATUS_BADGE.present;
  const isLate    = statusKey === 'late' && (record.late_duration_minutes ?? 0) > 0;
  const hasGps    = record.gps_lat != null && record.gps_lng != null;

  return (
    <div className="att-modal-panel flex flex-col items-center gap-6 px-4 py-8 text-center max-w-sm mx-auto">
      <div className="flex items-center justify-center size-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
        <CheckCircle2 className="size-10 text-emerald-600 dark:text-emerald-400" />
      </div>

      <div className="space-y-1">
        <h2 className="text-xl font-bold leading-snug">Attendance Recorded</h2>
        <p className="text-sm text-muted-foreground">
          {sessionLabel === 'morning' ? '☀ Morning Time In' : '🌙 Afternoon Time Out'} submitted successfully
        </p>
      </div>

      {selfiePath && (
        <div className="size-36 rounded-xl overflow-hidden border-2 border-border shadow-sm">
          <AuthenticatedImage
            path={selfiePath}
            alt="Attendance selfie"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap justify-center">
        <span className={`inline-flex items-center gap-1 rounded-full py-1 px-3 text-sm font-semibold ${statusCfg.bg}`}>
          {statusCfg.label}
        </span>
        {isLate && (
          <Badge className="py-1 px-2.5 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-0">
            Late by {record.late_duration_minutes} min
          </Badge>
        )}
      </div>

      <div className="flex flex-col gap-2 text-sm text-muted-foreground w-full rounded-xl border bg-muted/30 p-4 text-left">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 shrink-0 text-primary" />
          <span>{formatDateTime(submittedAt)}</span>
        </div>

        {hasGps && (
          <div className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0 text-primary" />
            <span className="truncate flex-1">
              {record.gps_address
                ? record.gps_address
                : `${record.gps_lat?.toFixed(5)}, ${record.gps_lng?.toFixed(5)}`}
            </span>
            <a
              href={`https://maps.google.com/maps?q=${record.gps_lat},${record.gps_lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-primary underline underline-offset-2 text-xs"
            >
              Map
            </a>
          </div>
        )}

        {record.attempt_number && record.attempt_number > 1 && (
          <div className="flex items-center gap-2">
            <Clock className="size-4 shrink-0 text-primary" />
            <span>Attempt #{record.attempt_number}</span>
          </div>
        )}
      </div>

      <Button onClick={onComplete} className="w-full py-3 px-5 mt-2" size="lg">
        Back to Calendar
      </Button>
    </div>
  );
}
