/**
 * ScheduleFormModal — improved UX
 *
 * Features:
 *  - Quick-pick presets (Half-day, Full-day, Flexible, Custom)
 *  - Visual 24-hour timeline showing both windows as colored bars
 *  - Live preview summary ("Trainees can check in between X and Y")
 *  - Inline contextual help text
 *  - Clear section headers with icons
 *  - Late threshold shown as a friendly slider + label
 */
import { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { Loader2, Sun, Moon, CalendarRange, Clock, Info, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import attendanceService from '../../services/attendanceService';
import type { AttendanceSchedule, CreateScheduleData } from '../../services/attendanceService';
import { toDateString, toTimeString } from '../../utils/dateUtils';

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

interface ScheduleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  programId: string;
  schedule?: AttendanceSchedule;
  /** Pre-fill dates from the program */
  programStartDate?: string;
  programEndDate?: string;
}

interface Preset {
  id: string;
  label: string;
  description: string;
  morning_open: string;
  morning_close: string;
  morning_late_threshold: number;
  afternoon_open: string;
  afternoon_close: string;
  afternoon_late_threshold: number;
}

const PRESETS: Preset[] = [
  {
    id: 'standard',
    label: 'Standard',
    description: '7:30–8:30 AM · 12:00–1:00 PM',
    morning_open:  '07:30', morning_close:  '08:30', morning_late_threshold:   15,
    afternoon_open:'12:00', afternoon_close:'13:00', afternoon_late_threshold: 15,
  },
  {
    id: 'flexible',
    label: 'Flexible',
    description: '7:00–9:00 AM · 12:00–2:00 PM',
    morning_open:  '07:00', morning_close:  '09:00', morning_late_threshold:   30,
    afternoon_open:'12:00', afternoon_close:'14:00', afternoon_late_threshold: 30,
  },
  {
    id: 'government',
    label: 'Gov Hours',
    description: '7:30–8:00 AM · 5:00–5:30 PM',
    morning_open:  '07:30', morning_close:  '08:00', morning_late_threshold:   10,
    afternoon_open:'17:00', afternoon_close:'17:30', afternoon_late_threshold: 10,
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Set your own times',
    morning_open:  '08:00', morning_close:  '09:00', morning_late_threshold:   15,
    afternoon_open:'13:00', afternoon_close:'14:00', afternoon_late_threshold: 15,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** "08:30" → 8.5 (hours as decimal for timeline positioning) */
function toDecimalHours(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h + m / 60;
}

/** "08:30" → "8:30 AM" */
function fmt12(hhmm: string): string {
  if (!hhmm) return '—';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Clamp a value between min and max */
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// ---------------------------------------------------------------------------
// Visual timeline sub-component
// ---------------------------------------------------------------------------

interface TimelineProps {
  morningOpen:    string;
  morningClose:   string;
  afternoonOpen:  string;
  afternoonClose: string;
}

function Timeline({ morningOpen, morningClose, afternoonOpen, afternoonClose }: TimelineProps) {
  const SPAN = 24; // 0–24 hours shown

  function bar(open: string, close: string, color: string, label: string) {
    const start = clamp(toDecimalHours(open  || '00:00'), 0, SPAN);
    const end   = clamp(toDecimalHours(close || '00:00'), 0, SPAN);
    if (end <= start) return null;
    const left  = (start / SPAN) * 100;
    const width = ((end - start) / SPAN) * 100;
    return (
      <div
        key={label}
        className={`absolute top-0 h-full rounded-sm flex items-center justify-center ${color}`}
        style={{ left: `${left}%`, width: `${width}%`, minWidth: 2 }}
        title={`${label}: ${fmt12(open)} – ${fmt12(close)}`}
      >
        {width > 6 && (
          <span className="text-[9px] font-bold text-white truncate px-1 leading-none">
            {label}
          </span>
        )}
      </div>
    );
  }

  // Hour tick marks at 6, 12, 18
  const ticks = [0, 6, 12, 18, 24];

  return (
    <div className="space-y-1.5" aria-label="Attendance window timeline">
      <div className="relative h-7 rounded-lg bg-muted/40 border overflow-hidden">
        {bar(morningOpen,   morningClose,   'bg-amber-400/80',  '☀ AM')}
        {bar(afternoonOpen, afternoonClose, 'bg-blue-500/80',   '🌙 PM')}
      </div>
      {/* Tick labels */}
      <div className="relative h-4">
        {ticks.map((h) => (
          <span
            key={h}
            className="absolute text-[9px] text-muted-foreground -translate-x-1/2"
            style={{ left: `${(h / SPAN) * 100}%` }}
          >
            {h === 0 ? '12am' : h === 12 ? '12pm' : h === 24 ? '' : h > 12 ? `${h - 12}pm` : `${h}am`}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Window time editor sub-component (reused for morning + afternoon)
// ---------------------------------------------------------------------------

interface WindowEditorProps {
  label: string;
  icon: React.ReactNode;
  openId: string;
  closeId: string;
  lateId: string;
  openVal: string;
  closeVal: string;
  lateVal: number;
  onOpen:  (v: string) => void;
  onClose: (v: string) => void;
  onLate:  (v: number) => void;
  openError?:  string;
  closeError?: string;
  colorClass: string; // Tailwind bg for the label accent
}

function WindowEditor({
  label, icon,
  openId, closeId, lateId,
  openVal, closeVal, lateVal,
  onOpen, onClose, onLate,
  openError, closeError,
  colorClass,
}: WindowEditorProps) {
  const duration = useMemo(() => {
    if (!openVal || !closeVal) return null;
    const diff = toDecimalHours(closeVal) - toDecimalHours(openVal);
    if (diff <= 0) return null;
    const h = Math.floor(diff);
    const m = Math.round((diff - h) * 60);
    return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}`.trim() : `${m}m`;
  }, [openVal, closeVal]);

  return (
    <div className={`rounded-xl border-2 ${colorClass} p-4 space-y-3`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-sm font-semibold">{label} Window</span>
        {duration && (
          <Badge variant="secondary" className="ml-auto text-xs">
            {duration} window
          </Badge>
        )}
      </div>

      {/* Open / Close times */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={openId} className="text-xs text-muted-foreground">
            Opens at
          </Label>
          <Input
            id={openId}
            type="time"
            value={openVal}
            onChange={(e) => onOpen(e.target.value)}
            className={openError ? 'border-destructive' : ''}
          />
          {openError
            ? <p className="text-xs text-destructive">{openError}</p>
            : <p className="text-xs text-muted-foreground">
                {openVal ? fmt12(openVal) : '—'}
              </p>
          }
        </div>
        <div className="space-y-1">
          <Label htmlFor={closeId} className="text-xs text-muted-foreground">
            Closes at
          </Label>
          <Input
            id={closeId}
            type="time"
            value={closeVal}
            onChange={(e) => onClose(e.target.value)}
            className={closeError ? 'border-destructive' : ''}
          />
          {closeError
            ? <p className="text-xs text-destructive">{closeError}</p>
            : <p className="text-xs text-muted-foreground">
                {closeVal ? fmt12(closeVal) : '—'}
              </p>
          }
        </div>
      </div>

      {/* Late threshold */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor={lateId} className="text-xs text-muted-foreground">
            Mark as <span className="text-orange-600 font-semibold">Late</span> after
          </Label>
          <span className="text-sm font-semibold tabular-nums">
            {lateVal} min
          </span>
        </div>
        <input
          id={lateId}
          type="range"
          min={5} max={60} step={5}
          value={lateVal}
          onChange={(e) => onLate(Number(e.target.value))}
          className="w-full accent-orange-500 cursor-pointer"
          aria-label={`Late threshold for ${label} window`}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>5 min</span>
          <span className="text-orange-600">
            Late if arrives after {openVal
              ? fmt12(
                  (() => {
                    const [h, m] = openVal.split(':').map(Number);
                    const total = h * 60 + m + lateVal;
                    return `${String(Math.floor(total / 60)).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`;
                  })()
                )
              : '—'}
          </span>
          <span>60 min</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ScheduleFormModal({
  isOpen, onClose, onSaved, programId, schedule,
  programStartDate, programEndDate,
}: ScheduleFormModalProps) {
  const isEdit = !!schedule;

  const [form,        setForm]        = useState<CreateScheduleData>({
    program_id: programId, name: '',
    effective_date_start: '', effective_date_end: '',
    morning_open:  '07:30', morning_close:  '08:30', morning_late_threshold:   15,
    afternoon_open:'12:00', afternoon_close:'13:00', afternoon_late_threshold: 15,
  });
  const [selectedPreset, setSelectedPreset] = useState<string>('standard');
  const [errors,  setErrors]  = useState<Record<string, string>>({});
  const [saving,  setSaving]  = useState(false);

  // Seed form on open
  useEffect(() => {
    if (!isOpen) return;
    if (schedule) {
      setForm({
        program_id:               schedule.program_id,
        name:                     schedule.name,
        effective_date_start:     toDateString(schedule.effective_date_start),
        effective_date_end:       toDateString(schedule.effective_date_end),
        morning_open:             toTimeString(schedule.morning_open),
        morning_close:            toTimeString(schedule.morning_close),
        morning_late_threshold:   schedule.morning_late_threshold,
        afternoon_open:           toTimeString(schedule.afternoon_open),
        afternoon_close:          toTimeString(schedule.afternoon_close),
        afternoon_late_threshold: schedule.afternoon_late_threshold,
      });
      setSelectedPreset('custom');
    } else {
      // Default to Standard preset + program dates
      const preset = PRESETS[0];
      setForm({
        program_id:               programId,
        name:                     'Standard Daily Schedule',
        effective_date_start:     toDateString(programStartDate),
        effective_date_end:       toDateString(programEndDate),
        morning_open:             preset.morning_open,
        morning_close:            preset.morning_close,
        morning_late_threshold:   preset.morning_late_threshold,
        afternoon_open:           preset.afternoon_open,
        afternoon_close:          preset.afternoon_close,
        afternoon_late_threshold: preset.afternoon_late_threshold,
      });
      setSelectedPreset('standard');
    }
    setErrors({});
  }, [isOpen, schedule, programId, programStartDate, programEndDate]);

  function applyPreset(presetId: string) {
    const p = PRESETS.find(x => x.id === presetId);
    if (!p) return;
    setSelectedPreset(presetId);
    if (presetId === 'custom') return; // don't overwrite times
    setForm(prev => ({
      ...prev,
      morning_open:             p.morning_open,
      morning_close:            p.morning_close,
      morning_late_threshold:   p.morning_late_threshold,
      afternoon_open:           p.afternoon_open,
      afternoon_close:          p.afternoon_close,
      afternoon_late_threshold: p.afternoon_late_threshold,
      name: prev.name || `${p.label} Schedule`,
    }));
    setErrors({});
  }

  function set(field: keyof CreateScheduleData, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    setSelectedPreset('custom');
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim())          e.name = 'Give this schedule a name';
    if (!form.effective_date_start) e.effective_date_start = 'Required';
    if (!form.effective_date_end)   e.effective_date_end   = 'Required';
    if (form.effective_date_end && form.effective_date_start &&
        form.effective_date_end < form.effective_date_start)
      e.effective_date_end = 'Must be on or after start date';
    if (!form.morning_open)  e.morning_open  = 'Required';
    if (!form.morning_close) e.morning_close = 'Required';
    if (form.morning_open && form.morning_close &&
        form.morning_close <= form.morning_open)
      e.morning_close = 'Must be after open time';
    if (!form.afternoon_open)  e.afternoon_open  = 'Required';
    if (!form.afternoon_close) e.afternoon_close = 'Required';
    if (form.afternoon_open && form.afternoon_close &&
        form.afternoon_close <= form.afternoon_open)
      e.afternoon_close = 'Must be after open time';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEdit && schedule) {
        // Strip program_id (immutable) and empty-string date fields from
        // update payload — empty strings fail the backend date regex validation
        const { program_id: _omit, ...rest } = form;
        const updatePayload: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(rest)) {
          if (value !== '' && value !== undefined && value !== null) {
            updatePayload[key] = value;
          }
        }
        await attendanceService.updateSchedule(schedule.id, updatePayload as any);
        toast.success('Schedule updated');
      } else {
        await attendanceService.createSchedule(form);
        toast.success('Attendance schedule created — activate it from the Schedules tab to go live');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  }

  // Live summary sentence
  const summary = useMemo(() => {
    const parts: string[] = [];
    if (form.morning_open && form.morning_close)
      parts.push(`☀ Morning: ${fmt12(form.morning_open)} – ${fmt12(form.morning_close)}`);
    if (form.afternoon_open && form.afternoon_close)
      parts.push(`🌙 Afternoon: ${fmt12(form.afternoon_open)} – ${fmt12(form.afternoon_close)}`);
    return parts.join('  ·  ');
  }, [form.morning_open, form.morning_close, form.afternoon_open, form.afternoon_close]);

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto p-0 gap-0">

        {/* ── Header ── */}
        <div className="px-6 pt-6 pb-4 border-b">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Clock className="size-5 text-primary" />
              {isEdit ? 'Edit Attendance Schedule' : 'Create Attendance Schedule'}
            </DialogTitle>
            <DialogDescription className="text-xs mt-1">
              Define when trainees can check in and out each day. The window must be active before
              the <strong>Take Attendance</strong> button appears for trainees.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-6 space-y-6">

          {/* ── Presets ── */}
          {!isEdit && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Quick Start — choose a preset
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id)}
                    className={[
                      'rounded-lg border-2 px-3 py-2.5 text-left transition-all',
                      selectedPreset === p.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40 hover:bg-muted/50',
                    ].join(' ')}
                  >
                    <p className="text-sm font-semibold leading-tight">{p.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{p.description}</p>
                    {selectedPreset === p.id && (
                      <CheckCircle2 className="size-3.5 text-primary mt-1" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* ── Schedule name ── */}
          <div className="space-y-1.5">
            <Label htmlFor="sched-name" className="flex items-center gap-1.5">
              <CalendarRange className="size-3.5 text-muted-foreground" />
              Schedule Name *
            </Label>
            <Input
              id="sched-name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Standard Daily Schedule"
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name
              ? <p className="text-xs text-destructive">{errors.name}</p>
              : <p className="text-xs text-muted-foreground">A short name to identify this schedule</p>
            }
          </div>

          {/* ── Effective dates ── */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <CalendarRange className="size-3.5 text-muted-foreground" />
              Active Date Range *
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="sched-start" className="text-xs text-muted-foreground">From</Label>
                <Input id="sched-start" type="date" value={form.effective_date_start}
                  onChange={(e) => set('effective_date_start', e.target.value)}
                  className={errors.effective_date_start ? 'border-destructive' : ''} />
                {errors.effective_date_start && (
                  <p className="text-xs text-destructive">{errors.effective_date_start}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="sched-end" className="text-xs text-muted-foreground">To</Label>
                <Input id="sched-end" type="date" value={form.effective_date_end}
                  onChange={(e) => set('effective_date_end', e.target.value)}
                  className={errors.effective_date_end ? 'border-destructive' : ''} />
                {errors.effective_date_end && (
                  <p className="text-xs text-destructive">{errors.effective_date_end}</p>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="size-3 shrink-0" />
              This schedule only applies to sessions within these dates. Typically matches the program start and end dates.
            </p>
          </div>

          <Separator />

          {/* ── Timeline preview ── */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Window Preview
            </Label>
            <Timeline
              morningOpen={form.morning_open}
              morningClose={form.morning_close}
              afternoonOpen={form.afternoon_open}
              afternoonClose={form.afternoon_close}
            />
            {summary && (
              <p className="text-xs text-muted-foreground text-center">{summary}</p>
            )}
          </div>

          <Separator />

          {/* ── Morning window editor ── */}
          <WindowEditor
            label="Morning" icon={<Sun className="size-4 text-amber-500" />}
            openId="m-open" closeId="m-close" lateId="m-late"
            openVal={form.morning_open}   closeVal={form.morning_close}   lateVal={form.morning_late_threshold ?? 15}
            onOpen={(v)  => set('morning_open',             v)}
            onClose={(v) => set('morning_close',            v)}
            onLate={(v)  => set('morning_late_threshold',   v)}
            openError={errors.morning_open} closeError={errors.morning_close}
            colorClass="border-amber-200 dark:border-amber-800"
          />

          {/* ── Afternoon window editor ── */}
          <WindowEditor
            label="Afternoon" icon={<Moon className="size-4 text-blue-500" />}
            openId="a-open" closeId="a-close" lateId="a-late"
            openVal={form.afternoon_open}   closeVal={form.afternoon_close}   lateVal={form.afternoon_late_threshold ?? 15}
            onOpen={(v)  => set('afternoon_open',             v)}
            onClose={(v) => set('afternoon_close',            v)}
            onLate={(v)  => set('afternoon_late_threshold',   v)}
            openError={errors.afternoon_open} closeError={errors.afternoon_close}
            colorClass="border-blue-200 dark:border-blue-800"
          />

          {/* ── How it works callout ── */}
          <div className="flex items-start gap-3 rounded-xl bg-muted/40 border p-3 text-xs text-muted-foreground">
            <Info className="size-4 shrink-0 mt-0.5 text-primary" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">How attendance windows work</p>
              <p>
                Trainees see a <strong>Take Attendance</strong> button only while the window is open.
                Submitting before the late threshold marks them <span className="text-green-600 font-medium">Present</span>;
                after it marks them <span className="text-orange-600 font-medium">Late</span>.
                Admins can always override the status manually.
              </p>
              <p className="mt-1 text-[10px]">
                After saving, go to the <strong>Schedules</strong> tab and click <strong>Activate</strong> to make this schedule live.
                Only one schedule can be active per program at a time.
              </p>
            </div>
          </div>

        </div>

        {/* ── Footer ── */}
        <div className="border-t px-6 py-4 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {hasErrors && (
              <span className="text-destructive flex items-center gap-1">
                <Info className="size-3" /> Fix the errors above before saving
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving} className="gap-2 min-w-[100px]">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? 'Update Schedule' : 'Create Schedule'}
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
