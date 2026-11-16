import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from './ui/dialog';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import {
  GraduationCap, Calendar, Clock, Award, User, BarChart3, Share2, Check, Copy, Loader,
  CalendarDays, ExternalLink, Trash2, X, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Program } from '../utils/programHelpers';
import sessionService, { ProgramSession } from '../services/sessionService';
import attendanceService, { AttendanceStats } from '../services/attendanceService';
import enrollmentService, { type Enrollment } from '../services/enrollmentService';
import programSharingService from '../services/programSharingService';
import api from '../services/api';

interface ProgramDetailsModalProps {
  program: Program | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (program: Program) => void;
  canManage?: boolean;
}

export default function ProgramDetailsModal({
  program, open, onOpenChange, onEdit, canManage,
}: ProgramDetailsModalProps) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ProgramSession[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  
  // Share state
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareLinkLoading, setShareLinkLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sub-modal visibility
  const [sessionsModalOpen, setSessionsModalOpen] = useState(false);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [registrationsModalOpen, setRegistrationsModalOpen] = useState(false);
  const [enrollmentsModalOpen, setEnrollmentsModalOpen] = useState(false);

  // Delete state
  const [sessionToDelete, setSessionToDelete] = useState<ProgramSession | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [clearAllLoading, setClearAllLoading] = useState(false);

  const handleGenerateShareLink = async () => {
    if (!program) return;
    
    setShareLinkLoading(true);
    try {
      const response = await programSharingService.getShareableLink(program.id);
      setShareLink(response.url);
      toast.success("Share link generated!");
    } catch (err: any) {
      console.error("Error generating share link:", err);
      toast.error("Failed to generate share link");
    } finally {
      setShareLinkLoading(false);
    }
  };

  const handleCopyToClipboard = async () => {
    if (!shareLink) return;
    
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Error copying to clipboard:", err);
      toast.error("Failed to copy link");
    }
  };

  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;
    setDeleteLoading(true);
    try {
      await sessionService.deleteSession(sessionToDelete.id);
      setSessions(prev => prev.filter(s => s.id !== sessionToDelete.id));
      toast.success('Session deleted');
      setSessionToDelete(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? err?.message ?? 'Failed to delete session');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleClearAllSessions = async () => {
    if (!program) return;
    setClearAllLoading(true);
    try {
      await Promise.all(sessions.map(s => sessionService.deleteSession(s.id)));
      setSessions([]);
      toast.success('All sessions cleared');
      setClearAllOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? err?.message ?? 'Failed to clear sessions');
    } finally {
      setClearAllLoading(false);
    }
  };

  const handleApproveRegistration = async (registrationId: string) => {
    try {
      await api.patch(`/registrations/${registrationId}`, { action: 'approve' });
      setRegistrations(prev => 
        prev.map(r => r.id === registrationId ? { ...r, registration_status: 'approved' } : r)
      );
      toast.success('Registration approved');
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to approve registration');
    }
  };

  const handleRejectRegistration = async (registrationId: string) => {
    try {
      await api.patch(`/registrations/${registrationId}`, { action: 'reject' });
      setRegistrations(prev => 
        prev.map(r => r.id === registrationId ? { ...r, registration_status: 'rejected' } : r)
      );
      toast.success('Registration rejected');
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to reject registration');
    }
  };

  useEffect(() => {
    if (open && program) {
      if (!canManage) {
        setSessions([]);
        setStats(null);
        setEnrollments([]);
        setDataLoading(false);
        return;
      }

      setDataLoading(true);
      Promise.all([
        sessionService.getSessionsByProgram(program.id),
        attendanceService.getAttendanceStats(program.id),
        enrollmentService.fetchEnrollments('').then(() => 
          // Fetch enrollments by program - only enrolled status
          api.get(`/enrollments?program_id=${program.id}`).then(res => {
            const allEnrollments = res.data.data || res.data || [];
            // Filter to only 'enrolled' status
            return allEnrollments.filter((e: any) => e.status === 'enrolled');
          })
        ),
        // Fetch registrations for this program
        api.get(`/registrations`).then(res => {
          const allRegistrations = res.data || [];
          // Filter to only registrations for this program
          return allRegistrations.filter((r: any) => 
            r.enrollments && r.enrollments.some((e: any) => e.program_id === program.id)
          );
        }),
      ])
        .then(([sessRes, statsRes, enrollRes, registrationsRes]) => {
          setSessions(
            (sessRes.data ?? []).sort((a, b) =>
              b.session_date.localeCompare(a.session_date) || a.start_time.localeCompare(b.start_time)
            )
          );
          setStats(statsRes.data ?? null);
          setEnrollments(enrollRes ?? []);
          setRegistrations(registrationsRes ?? []);
        })
        .catch(() => {
          setSessions([]);
          setStats(null);
          setEnrollments([]);
          setRegistrations([]);
        })
        .finally(() => setDataLoading(false));
    } else if (!open) {
      setSessions([]);
      setStats(null);
      setEnrollments([]);
      setRegistrations([]);
      setImageLoadFailed(false);
      setSessionsModalOpen(false);
      setAttendanceModalOpen(false);
      setRegistrationsModalOpen(false);
      setEnrollmentsModalOpen(false);
      setShareLink(null);
      setCopied(false);
    }
  }, [open, program, canManage]);

  if (!program) return null;

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  const getStatusColor = (status: string) =>
    status === 'active' ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground';

  return (
    <>
      {/* ── Main Program Details Modal ── */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Program Details</DialogTitle>
            <DialogDescription>
              Review the program overview, schedule, and details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Program Image */}
            {program.photoUrl && !imageLoadFailed && (
              <div className="flex justify-center">
                <img
                  src={program.photoUrl}
                  alt={program.name}
                  className="h-48 w-auto rounded-md object-cover shadow"
                  onError={() => setImageLoadFailed(true)}
                />
              </div>
            )}

            {/* Header Info */}
            <div className="flex items-start gap-4">
              {(!program.photoUrl || imageLoadFailed) && (
                <div className="flex size-16 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <GraduationCap className="size-8 text-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="mb-2">{program.name}</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge className={getStatusColor(program.status)}>{program.status}</Badge>
                  <Badge variant="outline" className="border-primary text-primary">{program.duration}</Badge>
                  {(program as any).level && (
                    <Badge variant="outline" className="border-secondary text-secondary">{(program as any).level}</Badge>
                  )}
                  {program.type_of_funding && (
                    <Badge variant="outline" className="border-secondary text-secondary">{program.type_of_funding}</Badge>
                  )}
                </div></div>
            </div>

            {/* Share Link Section */}
            {canManage && program.status === 'active' && (
              <div className="rounded-lg border bg-blue-50/50 dark:bg-blue-900/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1 flex items-center gap-2">
                      <Share2 className="size-4 text-blue-600 dark:text-blue-400" />
                      Share This Program
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      Generate a shareable link to invite others to enroll in this program.
                    </p>
                  </div>
                </div>
                
                {!shareLink ? (
                  <Button
                    onClick={handleGenerateShareLink}
                    disabled={shareLinkLoading}
                    className="w-full gap-2"
                    size="sm"
                  >
                    {shareLinkLoading ? (
                      <>
                        <Loader className="size-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Share2 className="size-4" />
                        Generate Share Link
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-3 bg-white dark:bg-slate-950 rounded-lg border">
                      <input
                        type="text"
                        value={shareLink}
                        readOnly
                        className="flex-1 bg-transparent text-sm text-gray-600 dark:text-gray-400 outline-none"
                      />
                      <Button
                        onClick={handleCopyToClipboard}
                        variant="ghost"
                        size="sm"
                        className="gap-2"
                      >
                        {copied ? (
                          <>
                            <Check className="size-4 text-green-600" />
                            <span className="text-xs">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-4" />
                            <span className="text-xs">Copy</span>
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      Share this link on social media or send directly to invite trainees
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            {program.description && (
              <div>
                <h4 className="mb-2 text-sm font-medium">Description</h4>
                <p className="text-muted-foreground">{program.description}</p>
              </div>
            )}

            {/* Instructor */}
            {program.instructor && (
              <div>
                <h4 className="mb-2 text-sm font-medium">Instructor</h4>
                <div className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                    <User className="size-5 text-primary" />
                  </div>
                  <p className="font-semibold">{program.instructor}</p>
                </div>
              </div>
            )}

            {/* Details Grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <Clock className="size-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-semibold">{program.duration}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="flex size-10 items-center justify-center rounded-lg bg-secondary/10">
                  <Award className="size-5 text-secondary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Level</p>
                  <p className="font-semibold">{(program as any).level || 'All Levels'}</p>
                </div>
              </div>

              {program.type_of_funding && (
                <div className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-secondary/10">
                    <Award className="size-5 text-secondary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Type of Funding</p>
                    <p className="font-semibold">{program.type_of_funding}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="flex size-10 items-center justify-center rounded-lg bg-accent/10">
                  <Calendar className="size-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Start Date</p>
                  <p className="font-semibold">{formatDate(program.startDate)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="flex size-10 items-center justify-center rounded-lg bg-secondary/10">
                  <Calendar className="size-5 text-secondary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">End Date</p>
                  <p className="font-semibold">{formatDate(program.endDate)}</p>
                </div>
              </div>
            </div>

            {/* Capacity Section */}
            {program.enrollment_limit !== undefined && program.enrollment_limit !== null && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium">Enrollment Capacity</span>
                  <span className="text-muted-foreground">
                    {enrollments.length} of {program.enrollment_limit} trainees enrolled
                  </span>
                </div>
                <div className="w-full bg-secondary/20 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.round((enrollments.length / program.enrollment_limit) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Sessions & Attendance hover-reveal stat cards */}
            {canManage && (
              <div className="grid grid-cols-2 gap-3">
                {/* Enrollments card */}
                <div className="group relative rounded-xl border bg-muted/30 p-4 transition-colors hover:bg-blue-50/50 hover:border-blue-300 dark:hover:bg-blue-900/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="size-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium">Enrolled</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {dataLoading ? <Skeleton className="h-8 w-10 rounded" /> : `${enrollments.length} / ${program.enrollment_limit || program.max_trainees}`}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">trainees enrolled</p>

                  {/* Hover pill */}
                  <button
                    onClick={() => setEnrollmentsModalOpen(true)}
                    className="absolute inset-0 flex items-end justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="View enrollments"
                  >
                    <span className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-900/30 hover:bg-blue-200/50 dark:hover:bg-blue-900/50 px-2.5 py-1 rounded-full transition-colors">
                      <Users className="size-3" />
                      View Trainees
                    </span>
                  </button>
                </div>

                {/* Registrations card */}
                <div className="group relative rounded-xl border bg-muted/30 p-4 transition-colors hover:bg-orange-50/50 hover:border-orange-300 dark:hover:bg-orange-900/20">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="size-4 text-orange-600 dark:text-orange-400" />
                    <span className="text-sm font-medium">Registrations</span>
                  </div>
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {dataLoading ? <Skeleton className="h-8 w-10 rounded" /> : (stats as any)?.total_registrations || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">pending & approved</p>

                  {/* Hover pill */}
                  <button
                    onClick={() => setRegistrationsModalOpen(true)}
                    className="absolute inset-0 flex items-end justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="View registrations"
                  >
                    <span className="flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-100/50 dark:bg-orange-900/30 hover:bg-orange-200/50 dark:hover:bg-orange-900/50 px-2.5 py-1 rounded-full transition-colors">
                      <BarChart3 className="size-3" />
                      View Registrations
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Bottom action row */}
            {canManage && onEdit && (
              <div className="border-t pt-4">
                <Button
                  variant="default"
                  className="w-full gap-2"
                  onClick={() => { onEdit(program); onOpenChange(false); }}
                >
                  <GraduationCap className="size-4" />
                  Edit Program
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Sessions Sub-Modal ── */}
      <Dialog open={sessionsModalOpen} onOpenChange={setSessionsModalOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="size-5 text-primary" />
              Sessions
            </DialogTitle>
            <DialogDescription>
              {program.name} — {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 space-y-4 py-2">
            {dataLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center py-14 text-muted-foreground">
                <CalendarDays className="size-10 mb-3 opacity-40" />
                <p className="text-sm">No sessions have been created for this program.</p>
              </div>
            ) : (
              <>
                {Object.entries(
                  sessions.reduce((acc, s) => {
                    const key = s.session_date.slice(0, 7);
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(s);
                    return acc;
                  }, {} as Record<string, ProgramSession[]>)
                ).sort(([a], [b]) => a.localeCompare(b)).map(([monthKey, monthSessions]) => {
                  const [yr, mo] = monthKey.split('-');
                  const monthLabel = new Date(Number(yr), Number(mo) - 1, 1).toLocaleDateString('en-US', {
                    month: 'long', year: 'numeric',
                  });
                  return (
                    <div key={monthKey}>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-2">
                          {monthLabel}{' '}
                          <span className="font-normal opacity-70">({monthSessions.length})</span>
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {monthSessions
                          .sort((a, b) => a.session_date.localeCompare(b.session_date))
                          .map(s => {
                            const d = new Date(s.session_date + 'T00:00:00');
                            const dayNum = d.getDate();
                            const dow = d.toLocaleDateString('en-US', { weekday: 'short' });
                            const statusCls =
                              s.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : s.status === 'cancelled'
                                ? 'bg-red-100 text-red-700 border-red-200 opacity-60 line-through dark:bg-red-900/30'
                                : 'bg-primary/10 text-primary border-primary/20';
                            return (
                              <span
                                key={s.id}
                                title={`${s.title} · ${s.session_date} · ${s.start_time}–${s.end_time}`}
                                className={`relative inline-flex flex-col items-center w-10 py-1 rounded-lg border text-xs font-medium select-none group/chip ${statusCls}`}
                              >
                                <span className="text-[9px] opacity-60 leading-none">{dow}</span>
                                <span className="text-sm font-bold leading-tight">{dayNum}</span>
                                <button
                                  onClick={() => setSessionToDelete(s)}
                                  title="Delete session"
                                  className="absolute -top-1.5 -right-1.5 hidden group-hover/chip:flex items-center justify-center size-4 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/80 transition-colors"
                                >
                                  <X className="size-2.5" />
                                </button>
                              </span>
                            );
                          })}
                      </div>
                    </div>
                  );
                })}

                <div className="flex gap-3 pt-2 border-t flex-wrap text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-primary/50 inline-block" />Scheduled
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-emerald-500 inline-block" />Completed
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-red-400 inline-block" />Cancelled
                  </span>
                  <span className="ml-auto">{sessions.length} total</span>
                </div>
              </>
            )}
          </div>

          {canManage && sessions.length > 0 && (
            <div className="border-t pt-3 mt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setClearAllOpen(true)}
              >
                <Trash2 className="size-3.5" />
                Clear All Sessions
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Attendance Sub-Modal ── */}
      <Dialog open={attendanceModalOpen} onOpenChange={setAttendanceModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="size-5 text-secondary" />
              Attendance Overview
            </DialogTitle>
            <DialogDescription>
              {program.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {dataLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
              </div>
            ) : !stats || stats.total === 0 ? (
              <div className="flex flex-col items-center py-14 text-muted-foreground">
                <BarChart3 className="size-10 mb-3 opacity-40" />
                <p className="text-sm">No attendance records yet.</p>
                <p className="text-xs mt-1">Scan trainee QR codes during sessions to start recording.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Present',  value: stats.present,  color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/10'  },
                    { label: 'Absent',   value: stats.absent,   color: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-900/10'    },
                    { label: 'Late',     value: stats.late,     color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/10' },
                    { label: 'Excused',  value: stats.excused,  color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/10'  },
                  ].map(s => (
                    <div key={s.label} className={`flex items-center gap-3 p-4 rounded-xl ${s.bg}`}>
                      <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                      <div>
                        <p className="text-sm font-medium">{s.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {Math.round((s.value / stats.total) * 100)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center">Total records: {stats.total}</p>
              </>
            )}
          </div>

          <div className="border-t pt-3 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setAttendanceModalOpen(false)}>
              Close
            </Button>
            <Button
              variant="default"
              className="flex-1 gap-2"
              onClick={() => {
                setAttendanceModalOpen(false);
                onOpenChange(false);
                navigate(`/programs/${program.id}/attendance`);
              }}
            >
              <ExternalLink className="size-4" />
              Full Report
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete single session confirmation ── */}
      <Dialog open={!!sessionToDelete} onOpenChange={v => { if (!v) setSessionToDelete(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Session?</DialogTitle>
            <DialogDescription>
              <strong>{sessionToDelete?.session_date}</strong> ({sessionToDelete?.title}) will be permanently
              deleted along with all its attendance records. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={deleteLoading} onClick={() => setSessionToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleteLoading} onClick={handleDeleteSession}>
              {deleteLoading ? 'Deleting…' : 'Delete Session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Clear all sessions confirmation ── */}
      <Dialog open={clearAllOpen} onOpenChange={v => { if (!v) setClearAllOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Clear All Sessions?</DialogTitle>
            <DialogDescription>
              All <strong>{sessions.length}</strong> sessions for this program will be permanently deleted,
              including every attendance record tied to them. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={clearAllLoading} onClick={() => setClearAllOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={clearAllLoading} onClick={handleClearAllSessions}>
              {clearAllLoading ? 'Clearing…' : 'Clear All Sessions'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Enrollments Sub-Modal ── */}
      <Dialog open={enrollmentsModalOpen} onOpenChange={setEnrollmentsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="size-5 text-blue-600 dark:text-blue-400" />
              Enrolled Trainees
            </DialogTitle>
            <DialogDescription>
              {program.name} — {enrollments.length} trainee{enrollments.length !== 1 ? 's' : ''} enrolled
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 space-y-2 py-2">
            {dataLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
              </div>
            ) : enrollments.length === 0 ? (
              <div className="flex flex-col items-center py-14 text-muted-foreground">
                <Users className="size-10 mb-3 opacity-40" />
                <p className="text-sm">No trainees are enrolled in this program yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {enrollments.map((enrollment) => {
                  const trainee = enrollment.trainee;
                  const fullName = trainee
                    ? `${trainee.first_name} ${trainee.middle_name ? trainee.middle_name + ' ' : ''}${trainee.last_name}`.trim()
                    : 'Unknown Trainee';
                  
                  const statusColors: Record<string, string> = {
                    enrolled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
                    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
                    completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
                    dropped: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
                    failed: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
                  };

                  return (
                    <div
                      key={enrollment.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                          <User className="size-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{fullName}</p>
                          <p className="text-xs text-muted-foreground truncate">{trainee?.email || 'No email'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right text-xs">
                          <p className="text-muted-foreground">Enrolled</p>
                          <p className="font-medium">
                            {new Date(enrollment.enrollment_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                        <Badge className={statusColors[enrollment.status] || 'bg-gray-100 text-gray-800'}>
                          {enrollment.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t pt-3 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setEnrollmentsModalOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Registrations Sub-Modal ── */}
      <Dialog open={registrationsModalOpen} onOpenChange={setRegistrationsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="size-5 text-orange-600 dark:text-orange-400" />
              Program Registrations
            </DialogTitle>
            <DialogDescription>
              {program.name} — {registrations.length} registration{registrations.length !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 space-y-3 py-2">
            {dataLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
              </div>
            ) : registrations.length === 0 ? (
              <div className="flex flex-col items-center py-14 text-muted-foreground">
                <Users className="size-10 mb-3 opacity-40" />
                <p className="text-sm">No registrations for this program.</p>
              </div>
            ) : (
              registrations.map(reg => (
                <div key={reg.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{reg.first_name} {reg.last_name}</p>
                    <p className="text-xs text-muted-foreground">{reg.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge 
                        variant={
                          reg.registration_status === 'pending' ? 'outline' :
                          reg.registration_status === 'approved' ? 'default' :
                          'secondary'
                        }
                        className="text-xs"
                      >
                        {reg.registration_status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {reg.registration_status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          className="h-8 px-3 gap-2 bg-green-600 hover:bg-green-700"
                          onClick={() => handleApproveRegistration(reg.id)}
                        >
                          <Check className="size-3" />
                          <span className="hidden sm:inline">Approve</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8 px-3 gap-2"
                          onClick={() => handleRejectRegistration(reg.id)}
                        >
                          <X className="size-3" />
                          <span className="hidden sm:inline">Reject</span>
                        </Button>
                      </>
                    )}
                    {reg.registration_status === 'approved' && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8 px-3 gap-2"
                        onClick={() => handleRejectRegistration(reg.id)}
                      >
                        <X className="size-3" />
                        <span className="hidden sm:inline">Reject</span>
                      </Button>
                    )}
                    {reg.registration_status === 'rejected' && (
                      <Badge variant="secondary" className="text-xs">Rejected</Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t pt-3">
            <Button variant="outline" className="w-full" onClick={() => setRegistrationsModalOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
