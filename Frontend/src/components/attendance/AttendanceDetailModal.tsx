/**
 * AttendanceDetailModal — Admin record inspection & manual override
 *
 * - Renders authenticated morning & afternoon selfies via AuthenticatedImage
 * - High-contrast semantic status badges (emerald / amber / red / purple)
 * - Supports manual override for BOTH existing records AND "No Record" trainees
 *   whenever a sessionId exists for the selected date
 * - Translucent scrim + 220ms sheet entrance (att-modal-scrim / att-modal-panel)
 */
import { useState } from 'react';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { MapPin, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getFileUrl } from '../../services/api';
import attendanceService from '../../services/attendanceService';
import AuthenticatedImage from './AuthenticatedImage';
import type { AttendanceRecord } from '../../services/attendanceService';

interface TraineeSummary {
  id: string;
  first_name: string;
  last_name: string;
  photo_path?: string;
}

interface Props {
  record: AttendanceRecord | null;
  trainee: TraineeSummary | null;
  sessionId?: string | null;
  canOverride?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdated: () => void;
}

const STATUS_BADGE: Record<string, string> = {
  present: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  late: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  absent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  excused: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  pending: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};

export default function AttendanceDetailModal({
  record,
  trainee,
  sessionId,
  canOverride = true,
  isOpen,
  onClose,
  onStatusUpdated,
}: Props) {
  const [savingStatus, setSavingStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const effectiveTrainee = trainee || (record?.trainee as any);
  const traineeName = effectiveTrainee
    ? `${effectiveTrainee.first_name} ${effectiveTrainee.last_name}`
    : 'Unknown Trainee';
  const effectiveSessionId = record?.session_id ?? sessionId ?? null;
  const effectiveTraineeId = record?.trainee_id ?? effectiveTrainee?.id ?? null;
  const hasGps = record?.gps_lat != null && record?.gps_lng != null;

  function formatTime(iso?: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  async function handleManualStatus(status: 'present' | 'late' | 'absent' | 'excused') {
    if (!effectiveSessionId || !effectiveTraineeId) return;
    setSavingStatus(status);
    try {
      await attendanceService.markAttendance({
        session_id: effectiveSessionId,
        trainee_id: effectiveTraineeId,
        status,
        notes: 'Manual override by staff',
      });
      toast.success(`Marked ${status}`);
      onStatusUpdated();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update attendance');
    } finally {
      setSavingStatus(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Attendance details for ${traineeName}`}
      className="att-modal-scrim fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="att-modal-panel bg-card border shadow-xl rounded-xl overflow-hidden flex flex-col w-full max-w-[min(92vw,460px)] max-h-[min(90vh,85vh)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b flex items-center gap-3 shrink-0">
          <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
            {effectiveTrainee?.photo_path ? (
              <img
                src={getFileUrl(effectiveTrainee.photo_path)}
                alt=""
                className="size-12 rounded-full object-cover"
              />
            ) : (
              <span className="text-base font-bold text-primary">
                {effectiveTrainee?.first_name?.[0]}
                {effectiveTrainee?.last_name?.[0]}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold truncate">{traineeName}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {record ? (
                <span className={`text-xs font-medium py-0.5 px-2.5 rounded-full capitalize ${STATUS_BADGE[record.status] ?? 'bg-muted text-muted-foreground'}`}>
                  {record.status}
                </span>
              ) : (
                <span className="text-xs font-medium py-0.5 px-2.5 rounded-full bg-muted text-muted-foreground">
                  No record
                </span>
              )}
              {record?.late_duration_minutes ? (
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  Late {record.late_duration_minutes}m
                </span>
              ) : null}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close modal"
            className="size-9 rounded-full shrink-0"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-4 space-y-4 min-h-0">
          {!record ? (
            <div className="rounded-lg border border-dashed bg-muted/20 py-6 px-4 text-center">
              <p className="text-sm font-medium text-foreground">No attendance submitted yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                {effectiveSessionId
                  ? 'You can record a manual attendance status below.'
                  : 'No session is scheduled on this date yet.'}
              </p>
            </div>
          ) : (
            <>
              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 rounded-lg p-3 text-center border border-border/60">
                  <p className="text-xs text-muted-foreground">🌅 Morning</p>
                  <p className="text-sm font-semibold mt-0.5">
                    {formatTime(record.morning_time_in ?? record.check_in_time)}
                  </p>
                  {record.morning_status && (
                    <p className="text-[11px] text-muted-foreground capitalize mt-0.5">
                      {record.morning_status}
                    </p>
                  )}
                </div>
                <div className="bg-muted/30 rounded-lg p-3 text-center border border-border/60">
                  <p className="text-xs text-muted-foreground">🌆 Afternoon</p>
                  <p className="text-sm font-semibold mt-0.5">
                    {formatTime(record.afternoon_time_out ?? record.check_out_time)}
                  </p>
                  {record.afternoon_status && (
                    <p className="text-[11px] text-muted-foreground capitalize mt-0.5">
                      {record.afternoon_status}
                    </p>
                  )}
                </div>
              </div>

              {/* Authenticated Selfies */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Morning Selfie</p>
                  <div className="aspect-square rounded-lg border bg-muted/20 flex items-center justify-center overflow-hidden">
                    <AuthenticatedImage
                      path={record.selfie_morning_path}
                      alt="Morning selfie"
                      emptyLabel="No morning selfie"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Afternoon Selfie</p>
                  <div className="aspect-square rounded-lg border bg-muted/20 flex items-center justify-center overflow-hidden">
                    <AuthenticatedImage
                      path={record.selfie_afternoon_path}
                      alt="Afternoon selfie"
                      emptyLabel="No afternoon selfie"
                    />
                  </div>
                </div>
              </div>

              {/* GPS Info */}
              {hasGps && (
                <div className="bg-muted/30 rounded-lg p-3 flex items-center gap-2 border border-border/60">
                  <MapPin className="size-4 text-primary shrink-0" />
                  <span className="text-xs truncate">
                    {record.gps_lat?.toFixed(4)}, {record.gps_lng?.toFixed(4)}
                    {record.gps_accuracy ? ` (±${record.gps_accuracy.toFixed(0)}m)` : ''}
                  </span>
                </div>
              )}

              {/* Device Info Row */}
              {record.device_info && (
                <div className="flex gap-2 flex-wrap">
                  {(record.device_info as any).os_version && (
                    <span className="text-[11px] py-0.5 px-2 bg-muted rounded">
                      {(record.device_info as any).os_version}
                    </span>
                  )}
                  {record.device_info.timezone && (
                    <span className="text-[11px] py-0.5 px-2 bg-muted rounded">
                      {record.device_info.timezone}
                    </span>
                  )}
                  {record.device_info.ip && (
                    <span className="text-[11px] py-0.5 px-2 bg-muted rounded truncate max-w-[140px]">
                      {record.device_info.ip}
                    </span>
                  )}
                  {record.attempt_number && (
                    <span className="text-[11px] py-0.5 px-2 bg-muted rounded">
                      Attempt #{record.attempt_number}
                    </span>
                  )}
                </div>
              )}
            </>
          )}

          {/* Manual Override Section — works for both recorded and unrecorded trainees */}
          {canOverride && effectiveSessionId && effectiveTraineeId && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Manual Status Override
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['present', 'late', 'absent', 'excused'] as const).map((st) => (
                    <Button
                      key={st}
                      size="sm"
                      variant={record?.status === st ? 'default' : 'outline'}
                      className="py-2 px-3 capitalize text-xs"
                      disabled={savingStatus !== null}
                      onClick={() => handleManualStatus(st)}
                    >
                      {savingStatus === st ? <Loader2 className="size-3.5 animate-spin" /> : st}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
