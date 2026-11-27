import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import PaginationWrapper from '../PaginationWrapper';
import registrationService, { type PendingRegistration } from '../../services/registrationService';
import reportService, { type ProgramReport } from '../../services/reportService';
import api from '../../services/api';
import logger from '../../utils/logger';

interface RequirementAnalyticsItem {
  requirement_id: string;
  requirement_type: string;
  display_name: string;
  is_mandatory: boolean;
  completion_rate: number;
  rejection_count: number;
  rejection_rate: number;
  total_submissions: number;
  verified_count: number;
  pending_count: number;
  submitted_count: number;
  waived_count: number;
}

interface RequirementAnalyticsPayload {
  by_requirement: RequirementAnalyticsItem[];
  summary: {
    avg_completion_rate: number;
    avg_rejection_rate: number;
    total_requirements: number;
    total_submissions: number;
    total_verified: number;
    total_rejected: number;
    total_pending: number;
    total_submitted: number;
    total_waived: number;
  };
}

type ProgramStatRow = NonNullable<ProgramReport['programStats']>[number];

const REGISTRATIONS_PER_PAGE = 8;
const PROGRAMS_PER_PAGE = 5;

function formatShortDate(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function clampRatio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.max(0, Math.min(1, numerator / denominator));
}

export default function TrainingStaffWorkspace() {
  const navigate = useNavigate();

  // Card 1: Pending Registrations Queue
  const [registrations, setRegistrations] = useState<PendingRegistration[]>([]);
  const [regLoading, setRegLoading] = useState(true);
  const [regError, setRegError] = useState<string | null>(null);
  const [regPage, setRegPage] = useState(1);

  // Card 2: Active Programs Capacity
  const [programs, setPrograms] = useState<ProgramStatRow[]>([]);
  const [progLoading, setProgLoading] = useState(true);
  const [progError, setProgError] = useState<string | null>(null);
  const [progPage, setProgPage] = useState(1);

  // Card 3: Requirements Compliance Health
  const [reqAnalytics, setReqAnalytics] = useState<RequirementAnalyticsPayload | null>(null);
  const [reqLoading, setReqLoading] = useState(true);
  const [reqError, setReqError] = useState<string | null>(null);

  const fetchPendingRegistrations = useCallback(async () => {
    try {
      setRegLoading(true);
      setRegError(null);
      const rows = await registrationService.getRegistrations({ status: 'pending' });
      const pendingOnly = (Array.isArray(rows) ? rows : [])
        .filter((row) => (row.registration_status || row.status) === 'pending')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRegistrations(pendingOnly);
      setRegPage(1);
    } catch (error) {
      logger.error('Failed to load pending registrations widget', { error });
      setRegError('Unable to load pending registrations right now.');
    } finally {
      setRegLoading(false);
    }
  }, []);

  const fetchProgramsCapacity = useCallback(async () => {
    try {
      setProgLoading(true);
      setProgError(null);
      const report = await reportService.getProgramReport();
      const stats = Array.isArray(report?.programStats) ? report.programStats : [];
      const activeAndUpcoming = stats.filter(
        (program) => program.status === 'active' || program.status === 'upcoming'
      );
      const source = activeAndUpcoming.length > 0 ? activeAndUpcoming : stats;
      const sorted = [...source].sort((a, b) => {
        if (a.status !== b.status) {
          if (a.status === 'active') return -1;
          if (b.status === 'active') return 1;
        }
        return clampRatio(b.enrolledCount, b.capacity) - clampRatio(a.enrolledCount, a.capacity);
      });
      setPrograms(sorted);
      setProgPage(1);
    } catch (error) {
      logger.error('Failed to load program capacity widget', { error });
      setProgError('Unable to load program capacity data.');
    } finally {
      setProgLoading(false);
    }
  }, []);

  const fetchRequirementsCompliance = useCallback(async () => {
    try {
      setReqLoading(true);
      setReqError(null);
      const response = await api.get<RequirementAnalyticsPayload>('/requirements/analytics');
      setReqAnalytics(response.data ?? null);
    } catch (error) {
      logger.error('Failed to load requirements compliance widget', { error });
      setReqError('Unable to load requirements compliance data.');
    } finally {
      setReqLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPendingRegistrations();
    void fetchProgramsCapacity();
    void fetchRequirementsCompliance();
  }, [fetchPendingRegistrations, fetchProgramsCapacity, fetchRequirementsCompliance]);

  const regTotalPages = Math.ceil(registrations.length / REGISTRATIONS_PER_PAGE);
  const paginatedRegistrations = useMemo(() => {
    const start = (regPage - 1) * REGISTRATIONS_PER_PAGE;
    return registrations.slice(start, start + REGISTRATIONS_PER_PAGE);
  }, [registrations, regPage]);

  const progTotalPages = Math.ceil(programs.length / PROGRAMS_PER_PAGE);
  const paginatedPrograms = useMemo(() => {
    const start = (progPage - 1) * PROGRAMS_PER_PAGE;
    return programs.slice(start, start + PROGRAMS_PER_PAGE);
  }, [programs, progPage]);

  const attentionRequirements = useMemo(() => {
    const list = reqAnalytics?.by_requirement ?? [];
    return [...list]
      .sort((a, b) => a.completion_rate - b.completion_rate)
      .slice(0, 5);
  }, [reqAnalytics]);

  return (
    <section
      aria-label="Training Operations Workspace"
      className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)] items-start"
    >
      {/* 62% Primary Column: Pending Registrations Queue */}
      <Card data-testid="training-pending-registrations-card">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ClipboardList className="size-4 text-primary shrink-0" />
              <CardTitle className="text-base font-semibold">Pending Registrations</CardTitle>
              {!regLoading && !regError && (
                <Badge
                  variant={registrations.length > 0 ? 'secondary' : 'outline'}
                  className="py-0.5 px-2 text-xs tabular-nums"
                >
                  {registrations.length}
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs sm:text-sm">
              New trainee applications waiting for review
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm" className="w-fit py-2 px-3.5 text-xs">
            <Link to="/registrations">
              Manage All
              <ArrowRight className="ml-1.5 size-3.5" />
            </Link>
          </Button>
        </CardHeader>

        <CardContent>
          {regLoading ? (
            <div className="space-y-3" data-testid="pending-registrations-skeleton">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={`reg-skel-${idx}`} className="flex items-center justify-between gap-4 py-2">
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-52" />
                  </div>
                  <Skeleton className="h-6 w-28 rounded-full" />
                  <Skeleton className="h-4 w-20 hidden sm:block" />
                </div>
              ))}
            </div>
          ) : regError ? (
            <div
              role="alert"
              className="flex flex-col items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center"
            >
              <div className="flex items-start gap-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{regError}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void fetchPendingRegistrations()}
                className="shrink-0 py-2 px-3.5 text-xs"
              >
                <RefreshCw className="mr-1.5 size-3.5" />
                Retry
              </Button>
            </div>
          ) : registrations.length === 0 ? (
            <div className="req-surface-in flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-6" />
              </div>
              <p className="text-sm font-medium text-foreground">All caught up</p>
              <p className="mt-1 text-xs text-muted-foreground">
                There are no pending trainee registrations to review right now.
              </p>
            </div>
          ) : (
            <div className="req-surface-in">
              {/* Desktop Paginated Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Applicant</TableHead>
                      <TableHead>Program</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRegistrations.map((reg) => {
                      const fullName = `${reg.first_name || ''} ${reg.last_name || ''}`.trim() || reg.username;
                      return (
                        <TableRow
                          key={reg.id}
                          onClick={() => navigate('/registrations')}
                          className="req-row-interactive cursor-pointer"
                        >
                          <TableCell>
                            <Link
                              to="/registrations"
                              onClick={(e) => e.stopPropagation()}
                              className="block font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:underline"
                            >
                              {fullName}
                            </Link>
                            <span className="block text-xs text-muted-foreground truncate max-w-[240px]">
                              {reg.email}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="max-w-[200px] truncate py-0.5 px-2 text-xs">
                              {reg.program?.name || 'Unassigned Program'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground tabular-nums">
                            {formatShortDate(reg.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="inline-flex items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 py-0.5 px-2 text-xs"
                              >
                                Pending
                              </Badge>
                              <ChevronRight className="size-4 text-muted-foreground" />
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Compact Cards */}
              <div className="space-y-3 md:hidden">
                {paginatedRegistrations.map((reg) => {
                  const fullName = `${reg.first_name || ''} ${reg.last_name || ''}`.trim() || reg.username;
                  return (
                    <Link
                      key={reg.id}
                      to="/registrations"
                      className="req-row-interactive block rounded-lg border p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{fullName}</p>
                          <p className="truncate text-xs text-muted-foreground">{reg.email}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className="shrink-0 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 py-0.5 px-2 text-xs"
                        >
                          Pending
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{reg.program?.name || 'Unassigned Program'}</span>
                        <span className="shrink-0 tabular-nums">{formatShortDate(reg.created_at)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>

        {!regLoading && !regError && regTotalPages > 1 && (
          <div className="border-t bg-muted/30 px-6 py-3">
            <PaginationWrapper
              currentPage={regPage}
              totalPages={regTotalPages}
              onPageChange={setRegPage}
              itemsCount={registrations.length}
              itemsPerPage={REGISTRATIONS_PER_PAGE}
            />
          </div>
        )}
      </Card>

      {/* 38% Companion Column: Active Programs Capacity + Requirements Compliance */}
      <div className="space-y-6">
        {/* Card 2: Active Programs Capacity */}
        <Card data-testid="training-programs-capacity-card">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <GraduationCap className="size-4 text-primary shrink-0" />
                <CardTitle className="text-base font-semibold">Active Programs Capacity</CardTitle>
              </div>
              <CardDescription className="text-xs sm:text-sm">
                Enrollment fill and completion progress
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="shrink-0 py-2 px-3 text-xs">
              <Link to="/programs?status=active">
                View All
                <ArrowRight className="ml-1 size-3.5" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent>
            {progLoading ? (
              <div className="space-y-3" data-testid="programs-capacity-skeleton">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={`prog-skel-${idx}`} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-4 w-14" />
                    </div>
                    <Skeleton className="h-1.5 w-full rounded-full" />
                  </div>
                ))}
              </div>
            ) : progError ? (
              <div
                role="alert"
                className="flex flex-col items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center"
              >
                <div className="flex items-start gap-2 text-xs sm:text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{progError}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void fetchProgramsCapacity()}
                  className="shrink-0 py-2 px-3.5 text-xs"
                >
                  <RefreshCw className="mr-1.5 size-3.5" />
                  Retry
                </Button>
              </div>
            ) : programs.length === 0 ? (
              <div className="req-surface-in flex flex-col items-center justify-center py-8 text-center">
                <GraduationCap className="mb-2 size-8 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">No active programs yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Create or activate a training program to track enrollment fill.
                </p>
              </div>
            ) : (
              <div className="req-surface-in space-y-3">
                {paginatedPrograms.map((program) => {
                  const ratio = clampRatio(program.enrolledCount, program.capacity);
                  const fillPct = Math.round(ratio * 100);
                  const barColor =
                    fillPct >= 95
                      ? 'bg-emerald-500'
                      : fillPct >= 80
                        ? 'bg-amber-500'
                        : 'bg-primary';
                  return (
                    <Link
                      key={program.id}
                      to={`/programs/${program.id}`}
                      className="req-row-interactive block rounded-lg border p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {program.name}
                        </span>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
                          {program.enrolledCount}
                          {program.capacity > 0 ? `/${program.capacity}` : ''}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`req-progress-fill h-full w-full rounded-full ${barColor}`}
                          style={{ transform: `scaleX(${ratio})` }}
                        />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="capitalize">{program.status}</span>
                        <span className="tabular-nums">
                          {program.capacity > 0 ? `${fillPct}% filled · ` : ''}
                          {Math.round(program.completionRate || 0)}% completed
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>

          {!progLoading && !progError && progTotalPages > 1 && (
            <div className="border-t bg-muted/30 px-4 py-3">
              <PaginationWrapper
                currentPage={progPage}
                totalPages={progTotalPages}
                onPageChange={setProgPage}
                itemsCount={programs.length}
                itemsPerPage={PROGRAMS_PER_PAGE}
              />
            </div>
          )}
        </Card>

        {/* Card 3: Requirements Compliance Health */}
        <Card data-testid="training-requirements-compliance-card">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <BookOpen className="size-4 text-primary shrink-0" />
                <CardTitle className="text-base font-semibold">Requirements Compliance</CardTitle>
              </div>
              <CardDescription className="text-xs sm:text-sm">
                Lowest-completion documents needing follow-up
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="shrink-0 py-2 px-3 text-xs">
              <Link to="/admin/requirements">
                Manage
                <ArrowRight className="ml-1 size-3.5" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent>
            {reqLoading ? (
              <div className="space-y-3" data-testid="requirements-compliance-skeleton">
                <div className="grid grid-cols-3 gap-2">
                  <Skeleton className="h-14 rounded-lg" />
                  <Skeleton className="h-14 rounded-lg" />
                  <Skeleton className="h-14 rounded-lg" />
                </div>
                {Array.from({ length: 3 }).map((_, idx) => (
                  <Skeleton key={`req-skel-${idx}`} className="h-14 rounded-lg" />
                ))}
              </div>
            ) : reqError ? (
              <div
                role="alert"
                className="flex flex-col items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center"
              >
                <div className="flex items-start gap-2 text-xs sm:text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{reqError}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void fetchRequirementsCompliance()}
                  className="shrink-0 py-2 px-3.5 text-xs"
                >
                  <RefreshCw className="mr-1.5 size-3.5" />
                  Retry
                </Button>
              </div>
            ) : !reqAnalytics || attentionRequirements.length === 0 ? (
              <div className="req-surface-in flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="mb-2 size-8 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm font-medium text-foreground">No requirements tracked yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Define enrollment requirements to monitor trainee submissions here.
                </p>
              </div>
            ) : (
              <div className="req-surface-in space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border bg-muted/40 p-3 text-center">
                    <p className="text-[11px] font-medium text-muted-foreground">Avg Complete</p>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">
                      {Math.round(reqAnalytics.summary.avg_completion_rate || 0)}%
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-3 text-center">
                    <p className="text-[11px] font-medium text-muted-foreground">To Review</p>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
                      {reqAnalytics.summary.total_submitted || 0}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-3 text-center">
                    <p className="text-[11px] font-medium text-muted-foreground">Rejected</p>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-destructive">
                      {reqAnalytics.summary.total_rejected || 0}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {attentionRequirements.map((item) => {
                    const ratio = clampRatio(item.completion_rate, 100);
                    const pct = Math.round(item.completion_rate || 0);
                    const barColor =
                      pct >= 80
                        ? 'bg-emerald-500'
                        : pct >= 50
                          ? 'bg-amber-500'
                          : 'bg-destructive';
                    return (
                      <Link
                        key={item.requirement_id}
                        to={`/admin/requirements/${item.requirement_id}`}
                        className="req-row-interactive block rounded-lg border p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-sm font-medium text-foreground">
                              {item.display_name}
                            </span>
                            {item.is_mandatory && (
                              <Badge variant="outline" className="shrink-0 py-0 px-1.5 text-[10px]">
                                Required
                              </Badge>
                            )}
                          </div>
                          <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
                            {pct}%
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={`req-progress-fill h-full w-full rounded-full ${barColor}`}
                            style={{ transform: `scaleX(${ratio})` }}
                          />
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
                          {item.verified_count} verified · {item.pending_count} pending
                          {item.rejection_count > 0 ? ` · ${item.rejection_count} rejected` : ''}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
