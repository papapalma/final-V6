import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Loader2,
  GraduationCap,
  Calendar,
  Clock,
  Users,
  User,
  ArrowLeft,
  LogIn,
  UserPlus,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import programSharingService, { type SharedProgramDetails } from '../services/programSharingService';
import { getFileUrl, getThumbnailUrl } from '../services/api';

/**
 * LinkHandlerPage — Public entry point for shared program links (`/share?program_id=...`)
 *
 * - Validates the program via public `GET /api/programs/:id/validate-share`
 * - Authenticated trainees -> `/programs/:id/enroll` (enrollment modal)
 * - Authenticated staff/admins -> `/programs/:id` (program details)
 * - Unauthenticated visitors -> Public Program Preview card with Register & Log In CTAs
 */
export default function LinkHandlerPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, isAuthReady, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharedProgram, setSharedProgram] = useState<SharedProgramDetails | null>(null);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    let cancelled = false;

    const handleProgramLink = async () => {
      try {
        setLoading(true);
        setError(null);
        setSharedProgram(null);
        setImageLoadFailed(false);

        const programId = searchParams.get('program_id');
        if (!programId) {
          navigate('/', { replace: true });
          return;
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(programId)) {
          localStorage.removeItem('selected_program_id');
          localStorage.removeItem('selected_program_tenant_id');
          setError('Invalid program link format');
          toast.error('Invalid program link');
          navigate('/', { replace: true });
          return;
        }

        const response = await programSharingService.validateProgramShare(programId);
        if (cancelled) return;

        if (!response.isValid || !response.isActive) {
          localStorage.removeItem('selected_program_id');
          localStorage.removeItem('selected_program_tenant_id');
          const msg = response.error || 'This program is no longer available';
          setError(msg);
          toast.error(msg);
          return;
        }

        if (!response.isPublic) {
          localStorage.removeItem('selected_program_id');
          localStorage.removeItem('selected_program_tenant_id');
          const msg = 'This program is not available for public enrollment';
          setError(msg);
          toast.error(msg);
          return;
        }

        // Persist shared program context for post-login / registration pre-selection
        localStorage.setItem('selected_program_id', programId);
        if (response.program?.tenant_id) {
          localStorage.setItem('selected_program_tenant_id', response.program.tenant_id);
        }

        if (isAuthenticated) {
          if (user?.role === 'trainee') {
            navigate(`/programs/${programId}/enroll`, { replace: true });
          } else {
            navigate(`/programs/${programId}`, { replace: true });
          }
          return;
        }

        setSharedProgram(
          response.program ?? {
            id: programId,
            name: 'Training Program',
          }
        );
      } catch (err) {
        if (cancelled) return;
        localStorage.removeItem('selected_program_id');
        localStorage.removeItem('selected_program_tenant_id');
        console.error('Error validating program:', err);
        setError('Unable to validate program. Please try again.');
        toast.error('Unable to validate program. Please try again.');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void handleProgramLink();

    return () => {
      cancelled = true;
    };
  }, [searchParams, navigate, isAuthenticated, isAuthReady, user?.role]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'TBA';
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return 'TBA';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading || !isAuthReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="space-y-4 text-center">
          <Loader2 className="mx-auto size-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Validating program...</p>
        </div>
      </div>
    );
  }

  if (error || !sharedProgram) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md border-border">
          <CardContent className="space-y-4 p-6 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="size-6" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-xl font-semibold text-foreground">Program Unavailable</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {error || 'This shared program link is invalid or no longer accepting enrollments.'}
              </p>
            </div>
            <Button onClick={() => navigate('/', { replace: true })} className="w-full py-2.5 px-4">
              <ArrowLeft className="mr-2 size-4" />
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const bannerUrl =
    getFileUrl(sharedProgram.image_path) || getThumbnailUrl(sharedProgram.thumbnail_path);
  const capacityLimit = sharedProgram.enrollment_limit ?? sharedProgram.max_trainees;
  const enrolledCount = sharedProgram.current_enrollment ?? 0;
  const isUpcoming = sharedProgram.status === 'upcoming';

  const handleOpenRegister = () => {
    navigate('/', {
      state: {
        openRegister: true,
        programId: sharedProgram.id,
        tenantId: sharedProgram.tenant_id,
      },
    });
  };

  const handleOpenLogin = () => {
    navigate('/', {
      state: {
        openLogin: true,
        programId: sharedProgram.id,
        tenantId: sharedProgram.tenant_id,
      },
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-6">
      <div className="w-full max-w-2xl space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="gap-2 py-2 px-3.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Explore All Programs
        </Button>

        <Card className="overflow-hidden border-border shadow-lg">
          {/* Program Banner */}
          {bannerUrl && !bannerUrl.includes('blank-thumbnail') && !imageLoadFailed ? (
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
              <img
                src={bannerUrl}
                alt={sharedProgram.name}
                className="h-full w-full object-cover"
                onError={() => setImageLoadFailed(true)}
              />
            </div>
          ) : (
            <div className="flex h-44 w-full items-center justify-center bg-primary/10">
              <GraduationCap className="size-16 text-primary" />
            </div>
          )}

          <CardContent className="space-y-6 p-6">
            {/* Title & Status */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={
                    isUpcoming
                      ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 py-0.5 px-2'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 py-0.5 px-2'
                  }
                >
                  {isUpcoming ? 'Upcoming Cohort' : 'Open for Enrollment'}
                </Badge>
                {sharedProgram.duration_weeks && (
                  <Badge variant="outline" className="py-0.5 px-2">
                    <Clock className="mr-1 size-3" />
                    {sharedProgram.duration_weeks} {sharedProgram.duration_weeks === 1 ? 'week' : 'weeks'}
                  </Badge>
                )}
              </div>

              <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">
                {sharedProgram.name}
              </h1>

              {sharedProgram.description && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {sharedProgram.description}
                </p>
              )}
            </div>

            {/* Metadata Grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Calendar className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Schedule</p>
                  <p className="truncate text-sm font-medium text-foreground">
                    {formatDate(sharedProgram.start_date)} – {formatDate(sharedProgram.end_date)}
                  </p>
                </div>
              </div>

              {sharedProgram.instructor && (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <User className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Instructor</p>
                    <p className="truncate text-sm font-medium text-foreground">
                      {sharedProgram.instructor}
                    </p>
                  </div>
                </div>
              )}

              {capacityLimit !== undefined && capacityLimit !== null && capacityLimit > 0 && (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3 sm:col-span-2">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Users className="size-4" />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Enrollment Capacity</span>
                      <span className="font-medium text-foreground">
                        {enrolledCount} / {capacityLimit} enrolled
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{
                          width: `${Math.min(100, Math.round((enrolledCount / capacityLimit) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row">
              <Button
                onClick={handleOpenRegister}
                className="flex-1 gap-2 py-2.5 px-4"
              >
                <UserPlus className="size-4" />
                Register &amp; Apply
              </Button>
              <Button
                variant="outline"
                onClick={handleOpenLogin}
                className="flex-1 gap-2 py-2.5 px-4"
              >
                <LogIn className="size-4" />
                Log In to Enroll
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
