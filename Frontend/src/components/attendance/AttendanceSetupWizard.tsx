/**
 * AttendanceSetupWizard
 *
 * A single 3-step wizard modal for setting up attendance for a program.
 * Follows the same visual pattern as the program creation wizard.
 *
 * Step 1 — Generate Sessions   (date range + days-of-week + bulk create)
 * Step 2 — Time Windows        (presets + timeline + morning/afternoon editors)
 * Step 3 — Activate            (summary + one-click activate)
 */
import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import {
  CalendarDays, Clock, Zap, Loader2, ChevronRight, ChevronLeft,
  CheckCircle2, Sun, Moon, Info, Sparkles, CalendarRange,
} from 'lucide-react';
import { toast } from 'sonner';
import sessionService, { CreateSessionData } from '../../services/sessionService';
import attendanceService from '../../services/attendanceService';
import type { AttendanceSchedule, CreateScheduleData } from '../../services/attendanceService';
import { toDateString, toTimeString } from '../../utils/dateUtils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AttendanceSetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  programId: string;
  programName?: string;
  programStartDate?: string;
  programEndDate?: string;
  existingSessionCount?: number;
  existingSchedule?: AttendanceSchedule | null;
}

// ---------------------------------------------------------------------------
// Shared helpers (copied from ScheduleFormModal — standalone, no import)
// ---------------------------------------------------------------------------

function toDecimalHours(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h + m / 60;
}

function fmt12(hhmm: string): string {
  if (!hhmm) return '—';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------------------
// Schedule presets
// ---------------------------------------------------------------------------

interface Preset {
  id: string; label: string; description: string;
  morning_open: string; morning_close: string; morning_late_threshold: number;
  afternoon_open: string; afternoon_close: string; afternoon_late_threshold: number;
}

const PRESETS: Preset[] = [
  { id: 'standard', label: 'Standard', description: '7:30–8:30 AM · 12:00–1:00 PM',
    morning_open: '07:30', morning_close: '08:30', morning_late_threshold: 15,
    afternoon_open: '12:00', afternoon_close: '13:00', afternoon_late_threshold: 15 },
  { id: 'flexible', label: 'Flexible', description: '7:00–9:00 AM · 12:00–2:00 PM',
    morning_open: '07:00', morning_close: '09:00', morning_late_threshold: 30,
    afternoon_open: '12:00', afternoon_close: '14:00', afternoon_late_threshold: 30 },
  { id: 'government', label: 'Gov Hours', description: '7:30–8:00 AM · 5:00–5:30 PM',
    morning_open: '07:30', morning_close: '08:00', morning_late_threshold: 10,
    afternoon_open: '17:00', afternoon_close: '17:30', afternoon_late_threshold: 10 },
  { id: 'custom', label: 'Custom', description: 'Set your own times',
    morning_open: '08:00', morning_close: '09:00', morning_late_threshold: 15,
    afternoon_open: '13:00', afternoon_close: '14:00', afternoon_late_threshold: 15 },
];

// ---------------------------------------------------------------------------
// Timeline sub-component
// ---------------------------------------------------------------------------

function Timeline({ morningOpen, morningClose, afternoonOpen, afternoonClose }: {
  morningOpen: string; morningClose: string;
  afternoonOpen: string; afternoonClose: string;
}) {
  const SPAN = 24;
  function bar(open: string, close: string, color: string, label: string) {
    const start = clamp(toDecimalHours(open || '00:00'), 0, SPAN);
    const end   = clamp(toDecimalHours(close || '00:00'), 0, SPAN);
    if (end <= start) return null;
    const left  = (start / SPAN) * 100;
    const width = ((end - start) / SPAN) * 100;
    return (
      <div key={label}
        className={`absolute top-0 h-full rounded-sm flex items-center justify-center ${color}`}
        style={{ left: `${left}%`, width: `${width}%`, minWidth: 2 }}
        title={`${label}: ${fmt12(open)} – ${fmt12(close)}`}
      >
        {width > 6 && <span className="text-[9px] font-bold text-white truncate px-1 leading-none">{label}</span>}
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <div className="relative h-7 rounded-lg bg-muted/40 border overflow-hidden">
        {bar(morningOpen,   morningClose,   'bg-amber-400/80', '☀ AM')}
        {bar(afternoonOpen, afternoonClose, 'bg-blue-500/80',  '🌙 PM')}
      </div>
      <div className="relative h-4">
        {[0,6,12,18,24].map(h => (
          <span key={h} className="absolute text-[9px] text-muted-foreground -translate-x-1/2"
            style={{ left: `${(h/SPAN)*100}%` }}>
            {h===0?'12am':h===12?'12pm':h===24?'':h>12?`${h-12}pm`:`${h}am`}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WindowEditor sub-component
// ---------------------------------------------------------------------------

function WindowEditor({ label, icon, openId, closeId, lateId,
  openVal, closeVal, lateVal, onOpen, onClose, onLate,
  openError, closeError, colorClass }: {
  label: string; icon: React.ReactNode;
  openId: string; closeId: string; lateId: string;
  openVal: string; closeVal: string; lateVal: number;
  onOpen: (v: string) => void; onClose: (v: string) => void; onLate: (v: number) => void;
  openError?: string; closeError?: string; colorClass: string;
}) {
  const duration = useMemo(() => {
    if (!openVal || !closeVal) return null;
    const diff = toDecimalHours(closeVal) - toDecimalHours(openVal);
    if (diff <= 0) return null;
    const h = Math.floor(diff);
    const m = Math.round((diff - h) * 60);
    return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}`.trim() : `${m}m`;
  }, [openVal, closeVal]);

  const lateCutoff = useMemo(() => {
    if (!openVal) return '—';
    const [h, m] = openVal.split(':').map(Number);
    const total = h * 60 + m + lateVal;
    return fmt12(`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`);
  }, [openVal, lateVal]);

  return (
    <div className={`rounded-xl border-2 ${colorClass} p-4 space-y-3`}>
      <div className="flex items-center gap-2">
        <span>{icon}</span>
        <span className="text-sm font-semibold">{label} Window</span>
        {duration && <Badge variant="secondary" className="ml-auto text-xs">{duration} window</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={openId} className="text-xs text-muted-foreground">Opens at</Label>
          <Input id={openId} type="time" value={openVal}
            onChange={e => onOpen(e.target.value)}
            className={openError ? 'border-destructive' : ''} />
          {openError
            ? <p className="text-xs text-destructive">{openError}</p>
            : <p className="text-xs text-muted-foreground">{openVal ? fmt12(openVal) : '—'}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor={closeId} className="text-xs text-muted-foreground">Closes at</Label>
          <Input id={closeId} type="time" value={closeVal}
            onChange={e => onClose(e.target.value)}
            className={closeError ? 'border-destructive' : ''} />
          {closeError
            ? <p className="text-xs text-destructive">{closeError}</p>
            : <p className="text-xs text-muted-foreground">{closeVal ? fmt12(closeVal) : '—'}</p>}
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor={lateId} className="text-xs text-muted-foreground">
            Mark as <span className="text-orange-600 font-semibold">Late</span> after
          </Label>
          <span className="text-sm font-semibold tabular-nums">{lateVal} min</span>
        </div>
        <input id={lateId} type="range" min={5} max={60} step={5} value={lateVal}
          onChange={e => onLate(Number(e.target.value))}
          className="w-full accent-orange-500 cursor-pointer" />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>5 min</span>
          <span className="text-orange-600">Late if after {lateCutoff}</span>
          <span>60 min</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard component
// ---------------------------------------------------------------------------

const STEPS = [
  { id: 1, title: 'Schedule Sessions', description: 'Set the days class runs',        icon: CalendarDays },
  { id: 2, title: 'Time Windows',      description: 'When can trainees check in?',    icon: Clock        },
  { id: 3, title: 'Activate',          description: 'Go live for trainees',           icon: Zap          },
];

export default function AttendanceSetupWizard({
  isOpen, onClose, onComplete,
  programId, programName,
  programStartDate, programEndDate,
  existingSessionCount = 0,
  existingSchedule,
}: AttendanceSetupWizardProps) {
  const [step, setStep] = useState(1);

  // ── Step 1 state: generate sessions ──────────────────────────────────────
  const [genStartDate,  setGenStartDate]  = useState('');
  const [genEndDate,    setGenEndDate]    = useState('');
  const [genTitle,      setGenTitle]      = useState('Session');
  const [genStartTime,  setGenStartTime]  = useState('08:00');
  const [genEndTime,    setGenEndTime]    = useState('17:00');
  const [genDays,       setGenDays]       = useState<number[]>([1,2,3,4,5]);
  const [genExcluded,   setGenExcluded]   = useState<Set<string>>(new Set());
  const [genSaving,     setGenSaving]     = useState(false);
  const [sessionCount,  setSessionCount]  = useState(existingSessionCount);

  // ── Step 2 state: schedule form ───────────────────────────────────────────
  const [schedForm, setSchedForm] = useState<CreateScheduleData>({
    program_id: programId, name: 'Standard Daily Schedule',
    effective_date_start: '', effective_date_end: '',
    morning_open: '07:30', morning_close: '08:30', morning_late_threshold: 15,
    afternoon_open: '12:00', afternoon_close: '13:00', afternoon_late_threshold: 15,
  });
  const [selectedPreset, setSelectedPreset] = useState('standard');
  const [schedErrors,    setSchedErrors]    = useState<Record<string, string>>({});
  const [schedSaving,    setSchedSaving]    = useState(false);
  const [savedSchedule,  setSavedSchedule]  = useState<AttendanceSchedule | null>(existingSchedule ?? null);

  // ── Step 3 state: activate ────────────────────────────────────────────────
  const [activating,  setActivating]  = useState(false);
  const [activated,   setActivated]   = useState(existingSchedule?.status === 'active');

  // ── Seed on open ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setGenStartDate(toDateString(programStartDate));
    setGenEndDate(toDateString(programEndDate));
    setGenTitle('Session');
    setGenStartTime('08:00');
    setGenEndTime('17:00');
    setGenDays([1,2,3,4,5]);
    setGenExcluded(new Set());
    setSessionCount(existingSessionCount);

    const preset = PRESETS[0];
    if (existingSchedule) {
      setSchedForm({
        program_id:           existingSchedule.program_id,
        name:                 existingSchedule.name,
        effective_date_start: toDateString(existingSchedule.effective_date_start),
        effective_date_end:   toDateString(existingSchedule.effective_date_end),
        morning_open:         toTimeString(existingSchedule.morning_open),
        morning_close:        toTimeString(existingSchedule.morning_close),
        morning_late_threshold:   existingSchedule.morning_late_threshold,
        afternoon_open:       toTimeString(existingSchedule.afternoon_open),
        afternoon_close:      toTimeString(existingSchedule.afternoon_close),
        afternoon_late_threshold: existingSchedule.afternoon_late_threshold,
      });
      setSelectedPreset('custom');
      setSavedSchedule(existingSchedule);
      setActivated(existingSchedule.status === 'active');
    } else {
      setSchedForm({
        program_id: programId, name: 'Standard Daily Schedule',
        // Dates are taken from Step 1 / program dates — not entered separately in Step 2
        effective_date_start: toDateString(programStartDate),
        effective_date_end:   toDateString(programEndDate),
        morning_open:         preset.morning_open,
        morning_close:        preset.morning_close,
        morning_late_threshold:   preset.morning_late_threshold,
        afternoon_open:       preset.afternoon_open,
        afternoon_close:      preset.afternoon_close,
        afternoon_late_threshold: preset.afternoon_late_threshold,
      });
      setSelectedPreset('standard');
      setSavedSchedule(null);
      setActivated(false);
    }
    setSchedErrors({});
  }, [isOpen, programId, programStartDate, programEndDate, existingSessionCount, existingSchedule]);

  // Keep schedule effective dates in sync with Step 1 date range whenever it changes
  useEffect(() => {
    if (!existingSchedule) {
      setSchedForm(prev => ({
        ...prev,
        effective_date_start: genStartDate || prev.effective_date_start,
        effective_date_end:   genEndDate   || prev.effective_date_end,
      }));
    }
  }, [genStartDate, genEndDate, existingSchedule]);

  // ── Step 1: computed dates ────────────────────────────────────────────────
  const genPreviewDates = useMemo(() => {
    if (!genStartDate || !genEndDate) return [];
    const start = new Date(genStartDate + 'T00:00:00');
    const end   = new Date(genEndDate   + 'T00:00:00');
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];
    const result: string[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      if (genDays.includes(cur.getDay())) result.push(toLocalDateString(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }, [genStartDate, genEndDate, genDays]);

  const genActiveDates = genPreviewDates.filter(d => !genExcluded.has(d));

  // ── Step 1: save sessions ─────────────────────────────────────────────────
  async function handleSaveSessions() {
    if (genActiveDates.length === 0) { setStep(2); return; }
    setGenSaving(true);
    try {
      const payloads: CreateSessionData[] = genActiveDates.map(date => ({
        program_id: programId, title: genTitle.trim() || 'Session',
        session_date: date, start_time: genStartTime, end_time: genEndTime,
        session_type: 'lecture' as const,
      }));
      const res = await sessionService.createBulkSessions(payloads);
      const created = (res.data ?? []).length;
      const skipped = genActiveDates.length - created;
      setSessionCount(prev => prev + created);
      if (created === 0) {
        toast.info('All selected dates already have sessions.');
      } else if (skipped > 0) {
        toast.success(`Created ${created} session${created !== 1 ? 's' : ''}. ${skipped} skipped (already exist).`);
      } else {
        toast.success(`Created ${created} session${created !== 1 ? 's' : ''}`);
      }
      setStep(2);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to generate sessions');
    } finally {
      setGenSaving(false);
    }
  }

  // ── Step 2: helpers ───────────────────────────────────────────────────────
  function applyPreset(pid: string) {
    const p = PRESETS.find(x => x.id === pid);
    if (!p) return;
    setSelectedPreset(pid);
    if (pid === 'custom') return;
    setSchedForm(prev => ({
      ...prev,
      morning_open: p.morning_open, morning_close: p.morning_close,
      morning_late_threshold: p.morning_late_threshold,
      afternoon_open: p.afternoon_open, afternoon_close: p.afternoon_close,
      afternoon_late_threshold: p.afternoon_late_threshold,
      name: prev.name || `${p.label} Schedule`,
    }));
    setSchedErrors({});
  }

  function setSchedField(field: keyof CreateScheduleData, value: string | number) {
    setSchedForm(prev => ({ ...prev, [field]: value }));
    setSchedErrors(prev => { const n = { ...prev }; delete n[field as string]; return n; });
    setSelectedPreset('custom');
  }

  function validateSched(): boolean {
    const e: Record<string, string> = {};
    if (!schedForm.name.trim())          e.name = 'Give this schedule a name';
    // effective dates are auto-filled from Step 1 — validate they exist
    if (!schedForm.effective_date_start || !schedForm.effective_date_end) {
      e.name = (e.name ? e.name + '. ' : '') + 'Go back to Step 1 and set a date range first';
    }
    if (!schedForm.morning_open)   e.morning_open   = 'Required';
    if (!schedForm.morning_close)  e.morning_close  = 'Required';
    if (schedForm.morning_open && schedForm.morning_close &&
        schedForm.morning_close <= schedForm.morning_open)
      e.morning_close = 'Must be after open time';
    if (!schedForm.afternoon_open)  e.afternoon_open  = 'Required';
    if (!schedForm.afternoon_close) e.afternoon_close = 'Required';
    if (schedForm.afternoon_open && schedForm.afternoon_close &&
        schedForm.afternoon_close <= schedForm.afternoon_open)
      e.afternoon_close = 'Must be after open time';
    setSchedErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSaveSchedule() {
    if (!validateSched()) return;
    setSchedSaving(true);
    try {
      let result: AttendanceSchedule;
      if (savedSchedule) {
        // Strip program_id (immutable) and any empty-string date fields from
        // update payload — empty strings fail the backend date regex validation
        const { program_id: _omit, ...rest } = schedForm;
        const updatePayload: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(rest)) {
          // Only include fields that have a real value (skip empty strings and undefined)
          if (value !== '' && value !== undefined && value !== null) {
            updatePayload[key] = value;
          }
        }
        const res = await attendanceService.updateSchedule(savedSchedule.id, updatePayload as any);
        result = res.data!;
        toast.success('Schedule updated');
      } else {
        const res = await attendanceService.createSchedule(schedForm);
        result = res.data!;
        toast.success('Schedule saved');
      }
      setSavedSchedule(result);
      setActivated(result.status === 'active');
      setStep(3);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save schedule');
    } finally {
      setSchedSaving(false);
    }
  }

  // ── Step 3: activate ──────────────────────────────────────────────────────
  async function handleActivate() {
    if (!savedSchedule) return;
    setActivating(true);
    try {
      await attendanceService.activateSchedule(savedSchedule.id);
      setSavedSchedule(prev => prev ? { ...prev, status: 'active' } : prev);
      setActivated(true);
      toast.success('Schedule activated — trainees can now check in');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to activate schedule');
    } finally {
      setActivating(false);
    }
  }

  const schedSummary = useMemo(() => {
    const parts: string[] = [];
    if (schedForm.morning_open && schedForm.morning_close)
      parts.push(`☀ ${fmt12(schedForm.morning_open)} – ${fmt12(schedForm.morning_close)}`);
    if (schedForm.afternoon_open && schedForm.afternoon_close)
      parts.push(`🌙 ${fmt12(schedForm.afternoon_open)} – ${fmt12(schedForm.afternoon_close)}`);
    return parts.join('  ·  ');
  }, [schedForm]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={isOpen} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden">

        {/* ── Header ── */}
        <div className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Zap className="size-5 text-primary" />
            Attendance Setup
            {programName && <span className="text-muted-foreground font-normal text-base">— {programName}</span>}
          </DialogTitle>
          <DialogDescription className="text-xs mt-1">
            Complete these 3 steps to enable trainee self-service attendance for this program.
          </DialogDescription>
        </div>

        {/* ── Step cards ── */}
        <div className="grid grid-cols-3 gap-3 px-6 pt-6 pb-2">
          {STEPS.map(s => {
            const Icon = s.icon;
            const isActive    = step === s.id;
            const isCompleted = step > s.id;
            return (
              <div key={s.id} className={[
                'rounded-xl border p-3 transition-all',
                isActive    ? 'border-primary shadow-md bg-primary/5'                        : '',
                isCompleted ? 'border-green-500 bg-green-50 dark:bg-green-950/40'            : '',
                !isActive && !isCompleted ? 'opacity-40 border-border'                       : '',
              ].join(' ')}>
                <div className="flex items-center gap-2.5">
                  <div className={[
                    'flex size-9 shrink-0 items-center justify-center rounded-full',
                    isActive    ? 'bg-primary text-primary-foreground'       : '',
                    isCompleted ? 'bg-green-500 text-white'                  : '',
                    !isActive && !isCompleted ? 'bg-muted text-muted-foreground' : '',
                  ].join(' ')}>
                    {isCompleted ? <span className="text-sm font-bold">✓</span> : <Icon className="size-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{s.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{s.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Scrollable step content ── */}
        <div className="flex-1 overflow-y-auto px-6 py-6">

          {/* ════════════════════════════════════════════════
              STEP 1 — Generate Sessions
          ════════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Existing sessions note */}
              {sessionCount > 0 && (
                <div className="flex items-center gap-2.5 rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 px-4 py-2.5 text-sm">
                  <CheckCircle2 className="size-4 text-green-600 shrink-0" />
                  <span className="text-green-800 dark:text-green-300">
                    <strong>{sessionCount}</strong> session{sessionCount !== 1 ? 's' : ''} already scheduled.
                    You can add more below or skip to the next step.
                  </span>
                </div>
              )}

              {/* Date range — read-only, inherited from program dates */}
              <div className="flex items-center gap-2 rounded-lg bg-muted/40 border px-3 py-2.5 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5 shrink-0 text-primary" />
                <span>
                  Generating sessions for: <strong className="text-foreground">
                    {genStartDate || '—'}
                  </strong> → <strong className="text-foreground">
                    {genEndDate || '—'}
                  </strong>
                  {' '}(from program dates — edit in Program Details if needed)
                </span>
              </div>

              {/* Session details */}
              <div className="space-y-2">
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <Clock className="size-4 text-primary" /> Session Details
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Title</Label>
                    <Input value={genTitle} onChange={e => setGenTitle(e.target.value)} placeholder="Session" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Start Time</Label>
                    <Input type="time" value={genStartTime} onChange={e => setGenStartTime(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">End Time</Label>
                    <Input type="time" value={genEndTime} onChange={e => setGenEndTime(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Days of week */}
              <div className="space-y-2">
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <CalendarDays className="size-4 text-primary" /> Repeat on Days
                </p>
                <div className="flex gap-1.5">
                  {(['S','M','T','W','T','F','S'] as const).map((label, dow) => {
                    const active = genDays.includes(dow);
                    return (
                      <button key={dow} type="button"
                        onClick={() => {
                          setGenDays(prev => active ? prev.filter(d => d !== dow) : [...prev, dow].sort((a,b)=>a-b));
                          setGenExcluded(new Set());
                        }}
                        className={[
                          'flex size-9 items-center justify-center rounded-full text-xs font-semibold transition-all select-none',
                          active ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/40 text-muted-foreground hover:bg-muted',
                        ].join(' ')}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date preview grid */}
              {genPreviewDates.length > 0 && (() => {
                const months: Record<string, string[]> = {};
                for (const d of genPreviewDates) {
                  const key = d.slice(0, 7);
                  (months[key] ??= []).push(d);
                }
                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold flex items-center gap-1.5">
                        <Sparkles className="size-4 text-primary" /> Date Preview
                      </p>
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {genActiveDates.length} selected
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Click a date to skip it. Click a month to toggle all.</p>
                    <div className="space-y-2">
                      {Object.entries(months).map(([key, dates]) => {
                        const label = new Date(key + '-02').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                        const allEx = dates.every(d => genExcluded.has(d));
                        return (
                          <div key={key} className="rounded-lg border bg-muted/20 overflow-hidden">
                            <button type="button"
                              onClick={() => setGenExcluded(prev => {
                                const n = new Set(prev);
                                allEx ? dates.forEach(d => n.delete(d)) : dates.forEach(d => n.add(d));
                                return n;
                              })}
                              className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold hover:bg-muted/40 transition-colors">
                              <span>{label}</span>
                              <span className={allEx ? 'text-muted-foreground' : 'text-primary'}>
                                {allEx ? 'all skipped' : `${dates.filter(d => !genExcluded.has(d)).length}/${dates.length}`}
                              </span>
                            </button>
                            <div className="flex flex-wrap gap-1.5 px-3 pb-3 pt-1">
                              {dates.map(d => {
                                const dt  = new Date(d + 'T00:00:00');
                                const ex  = genExcluded.has(d);
                                const wd  = dt.toLocaleDateString('en-US', { weekday: 'short' });
                                return (
                                  <button key={d} type="button"
                                    onClick={() => setGenExcluded(prev => {
                                      const n = new Set(prev);
                                      ex ? n.delete(d) : n.add(d);
                                      return n;
                                    })}
                                    className={[
                                      'flex flex-col items-center rounded-md border px-2 py-1 text-center w-11 transition-all select-none',
                                      ex ? 'opacity-40 line-through border-border bg-muted/30' : 'border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary',
                                    ].join(' ')}>
                                    <span className="text-[10px] leading-none opacity-70">{wd}</span>
                                    <span className="text-sm font-semibold leading-tight">{dt.getDate()}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {genStartDate && genEndDate && genPreviewDates.length === 0 && (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-muted-foreground">
                  <CalendarDays className="size-8 opacity-30" />
                  <p className="text-sm">No dates match the selected days in this range.</p>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════
              STEP 2 — Time Windows
          ════════════════════════════════════════════════ */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Presets */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Quick Start — choose a preset</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PRESETS.map(p => (
                    <button key={p.id} type="button" onClick={() => applyPreset(p.id)}
                      className={[
                        'rounded-lg border-2 px-3 py-2.5 text-left transition-all',
                        selectedPreset === p.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/50',
                      ].join(' ')}>
                      <p className="text-sm font-semibold leading-tight">{p.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{p.description}</p>
                      {selectedPreset === p.id && <CheckCircle2 className="size-3.5 text-primary mt-1" />}
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Schedule name */}
              <div className="space-y-1.5">
                <Label htmlFor="wiz-sched-name" className="flex items-center gap-1.5">
                  <CalendarRange className="size-3.5 text-muted-foreground" /> Schedule Name *
                </Label>
                <Input id="wiz-sched-name" value={schedForm.name}
                  onChange={e => setSchedField('name', e.target.value)}
                  placeholder="e.g. Standard Daily Schedule"
                  className={schedErrors.name ? 'border-destructive' : ''} />
                {schedErrors.name ? <p className="text-xs text-destructive">{schedErrors.name}</p>
                  : <p className="text-xs text-muted-foreground">A short name to identify this schedule</p>}
              </div>

              {/* Effective dates — read-only, auto-filled from Step 1 date range */}
              <div className="flex items-center gap-2 rounded-lg bg-muted/40 border px-3 py-2.5 text-xs text-muted-foreground">
                <Info className="size-3.5 shrink-0 text-primary" />
                <span>
                  Active dates: <strong className="text-foreground">
                    {schedForm.effective_date_start || '—'}
                  </strong> → <strong className="text-foreground">
                    {schedForm.effective_date_end || '—'}
                  </strong>
                  {' '}(inherited from the date range you set in Step 1)
                </span>
              </div>

              <Separator />

              {/* Timeline */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Window Preview</Label>
                <Timeline
                  morningOpen={schedForm.morning_open}   morningClose={schedForm.morning_close}
                  afternoonOpen={schedForm.afternoon_open} afternoonClose={schedForm.afternoon_close}
                />
                {schedSummary && <p className="text-xs text-muted-foreground text-center">{schedSummary}</p>}
              </div>

              <Separator />

              {/* Morning + afternoon editors */}
              <WindowEditor
                label="Morning" icon={<Sun className="size-4 text-amber-500" />}
                openId="wiz-m-open" closeId="wiz-m-close" lateId="wiz-m-late"
                openVal={schedForm.morning_open}    closeVal={schedForm.morning_close}
                lateVal={schedForm.morning_late_threshold ?? 15}
                onOpen={v  => setSchedField('morning_open', v)}
                onClose={v => setSchedField('morning_close', v)}
                onLate={v  => setSchedField('morning_late_threshold', v)}
                openError={schedErrors.morning_open} closeError={schedErrors.morning_close}
                colorClass="border-amber-200 dark:border-amber-800"
              />
              <WindowEditor
                label="Afternoon" icon={<Moon className="size-4 text-blue-500" />}
                openId="wiz-a-open" closeId="wiz-a-close" lateId="wiz-a-late"
                openVal={schedForm.afternoon_open}   closeVal={schedForm.afternoon_close}
                lateVal={schedForm.afternoon_late_threshold ?? 15}
                onOpen={v  => setSchedField('afternoon_open', v)}
                onClose={v => setSchedField('afternoon_close', v)}
                onLate={v  => setSchedField('afternoon_late_threshold', v)}
                openError={schedErrors.afternoon_open} closeError={schedErrors.afternoon_close}
                colorClass="border-blue-200 dark:border-blue-800"
              />
            </div>
          )}

          {/* ════════════════════════════════════════════════
              STEP 3 — Activate
          ════════════════════════════════════════════════ */}
          {step === 3 && (
            <div className="space-y-6">
              {activated ? (
                /* Success state */
                <div className="flex flex-col items-center gap-6 py-8 text-center">
                  <div className="flex size-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30"
                    style={{ animation: 'scaleIn 0.3s ease-out' }}>
                    <CheckCircle2 className="size-10 text-green-600 dark:text-green-400" />
                  </div>
                  <style>{`@keyframes scaleIn{from{transform:scale(0.5);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
                  <div>
                    <h3 className="text-xl font-bold">Attendance is ready!</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Trainees will see the <strong>Take Attendance</strong> button on their calendar
                      during the active windows.
                    </p>
                  </div>

                  {/* Summary */}
                  <div className="w-full max-w-sm rounded-xl border bg-muted/30 p-4 text-sm space-y-2 text-left">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sessions</span>
                      <span className="font-medium">{sessionCount} scheduled</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Schedule</span>
                      <span className="font-medium">{savedSchedule?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Morning</span>
                      <span className="font-medium">{savedSchedule ? `${fmt12(savedSchedule.morning_open)} – ${fmt12(savedSchedule.morning_close)}` : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Afternoon</span>
                      <span className="font-medium">{savedSchedule ? `${fmt12(savedSchedule.afternoon_open)} – ${fmt12(savedSchedule.afternoon_close)}` : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <span className="font-medium text-green-600 dark:text-green-400">● Active</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Pre-activation state */
                <div className="space-y-4">
                  <div className="rounded-xl border bg-muted/30 p-6 space-y-3">
                    <p className="text-sm font-semibold">Ready to activate</p>
                    <div className="space-y-2 text-sm">
                      {[
                        ['Sessions',   `${sessionCount} scheduled`],
                        ['Schedule',   savedSchedule?.name ?? '—'],
                        ['Morning',    savedSchedule ? `${fmt12(savedSchedule.morning_open)} – ${fmt12(savedSchedule.morning_close)}` : '—'],
                        ['Afternoon',  savedSchedule ? `${fmt12(savedSchedule.afternoon_open)} – ${fmt12(savedSchedule.afternoon_close)}` : '—'],
                        ['Late after', `Morning ${savedSchedule?.morning_late_threshold ?? 15}min · Afternoon ${savedSchedule?.afternoon_late_threshold ?? 15}min`],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground">
                    <Info className="size-4 shrink-0 mt-0.5 text-primary" />
                    <p>
                      Activating makes this schedule live immediately. The <strong>Take Attendance</strong> button
                      will appear for trainees during the configured windows. Only one schedule can be active at a time.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="border-t px-6 py-4 flex items-center justify-between gap-3">
          {/* Left: Cancel / Back */}
          <div className="flex gap-2">
            {step === 1 && (
              <Button variant="outline" onClick={onClose}>Cancel</Button>
            )}
            {step > 1 && !activated && (
              <Button variant="outline" onClick={() => setStep(s => s - 1)} className="gap-1.5">
                <ChevronLeft className="size-4" /> Back
              </Button>
            )}
          </div>

          {/* Right: action button */}
          <div className="flex gap-2">
            {step === 1 && (
              <>
                <Button variant="ghost" onClick={() => setStep(2)} className="gap-1.5 text-muted-foreground">
                  Skip <ChevronRight className="size-4" />
                </Button>
                <Button onClick={handleSaveSessions} disabled={genSaving} className="gap-1.5">
                  {genSaving
                    ? <><Loader2 className="size-4 animate-spin" /> Saving…</>
                    : genActiveDates.length > 0
                    ? <><Sparkles className="size-4" /> Create {genActiveDates.length} Session{genActiveDates.length !== 1 ? 's' : ''} →</>
                    : <>Next: Time Windows <ChevronRight className="size-4" /></>
                  }
                </Button>
              </>
            )}

            {step === 2 && (
              <Button onClick={handleSaveSchedule} disabled={schedSaving} className="gap-1.5">
                {schedSaving
                  ? <><Loader2 className="size-4 animate-spin" /> Saving…</>
                  : <>Save & Continue <ChevronRight className="size-4" /></>
                }
              </Button>
            )}

            {step === 3 && !activated && (
              <Button onClick={handleActivate} disabled={activating} size="lg"
                className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                {activating
                  ? <><Loader2 className="size-4 animate-spin" /> Activating…</>
                  : <><Zap className="size-4" /> Activate Schedule</>
                }
              </Button>
            )}

            {step === 3 && activated && (
              <Button size="lg" onClick={() => { onComplete(); onClose(); }} className="gap-2">
                <CheckCircle2 className="size-4" /> Done
              </Button>
            )}
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
