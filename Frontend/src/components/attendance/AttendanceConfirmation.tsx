/**
 * AttendanceConfirmation
 *
 * Post-submission success screen showing:
 *   - Animated checkmark
 *   - Captured selfie (via getFileUrl)
 *   - Status badge, session label, date/time
 *   - Late duration pill (orange) if late
 *   - GPS coordinates + View on Map link
 *   - "Back to Calendar" button
 */
import { CheckCircle2, MapPin, Clock, Calendar } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { getFileUrl } from '../../services/api';
import type { AttendanceRecord } from '../../services/attendanceService';

interface AttendanceConfirmationProps {
  record: AttendanceRecord;
  sessionLabel: 'morning' | 'afternoon';
  onComplete: () => void;
}

const STATUS_BADGE: Record<string, { bg: string; label: string }> = {
  present: { bg: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', label: 'Present' },
  late:    { bg: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', label: 'Late' },
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

  const statusKey = record.status ?? 'pending';
  const statusCfg = STATUS_BADGE[statusKey] ?? STATUS_BADGE.pending;
  const isLate    = (record.late_duration_minutes ?? 0) > 0;
  const hasGps    = record.gps_lat != null && record.gps_lng != null;

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-8 text-center max-w-sm mx-auto">

      {/* Animated success checkmark */}
      <div
        className="flex items-center justify-center size-20 rounded-full bg-green-100 dark:bg-green-900/30"
        style={{ animation: 'scaleIn 0.3s ease-out' }}
      >
        <CheckCircle2 className="size-10 text-green-600 dark:text-green-400" />
      </div>

      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.5); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
      `}</style>

      <div className="space-y-1">
        <h2 className="text-xl font-bold">Attendance Recorded</h2>
        <p className="text-sm text-muted-foreground">
          {sessionLabel === 'morning' ? '☀ Morning Time In' : '🌙 Afternoon Time Out'} submitted successfully
        </p>
      </div>

      {/* Selfie */}
      {selfiePath && (
        <div className="w-32 h-32 rounded-xl overflow-hidden border-2 border-border shadow">
          <img
            src={getFileUrl(selfiePath)}
            alt="Attendance selfie"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Status + late pill */}
      <div className="flex items-center gap-2 flex-wrap justify-center">
        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${statusCfg.bg}`}>
          {statusCfg.label}
        </span>
        {isLate && (
          <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-0">
            Late by {record.late_duration_minutes} min
          </Badge>
        )}
      </div>

      {/* Date / time */}
      <div className="flex flex-col gap-1.5 text-sm text-muted-foreground w-full">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 shrink-0" />
          <span>{formatDateTime(submittedAt)}</span>
        </div>

        {/* GPS */}
        {hasGps && (
          <div className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0" />
            <span className="truncate">
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

        {/* Attempt info */}
        {record.attempt_number && record.attempt_number > 1 && (
          <div className="flex items-center gap-2">
            <Clock className="size-4 shrink-0" />
            <span>Attempt #{record.attempt_number}</span>
          </div>
        )}
      </div>

      <Button onClick={onComplete} className="w-full mt-2" size="lg">
        Back to Calendar
      </Button>
    </div>
  );
}
