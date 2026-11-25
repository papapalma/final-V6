import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import {
  GraduationCap,
  Calendar,
  Clock,
  User,
  Users,
  CheckCircle2,
  CalendarCheck,
  Pin,
} from 'lucide-react';
import { getThumbnailUrl } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface Program {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
  instructor?: string | null;
  duration_weeks?: number;
  max_trainees?: number;
  thumbnail_path?: string;
  image_path?: string;
  icon?: React.ReactNode;
}

interface TraineeProgramDetailsModalProps {
  program: Program | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnroll?: () => void;
  isEnrolling?: boolean;
  isEnrolled?: boolean;
  enrollmentStatus?: 'accepting' | 'in-progress' | 'completed';
  enrollmentDate?: Date;
  graduatedDate?: Date;
}

export default function TraineeProgramDetailsModal({
  program,
  open,
  onOpenChange,
  onEnroll,
  isEnrolling = false,
  isEnrolled = false,
  enrollmentStatus = 'accepting',
  enrollmentDate,
  graduatedDate,
}: TraineeProgramDetailsModalProps) {
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [pinToDashboard, setPinToDashboard] = useState(false);
  const navigate = useNavigate();

  // Load pin preference
  useEffect(() => {
    if (program?.id) {
      const key = `pin_attendance_${program.id}`;
      const isPinned = localStorage.getItem(key) === 'true';
      setPinToDashboard(isPinned);
    }
  }, [program?.id]);

  const handlePinToggle = (checked: boolean) => {
    setPinToDashboard(checked);
    // Store preference in localStorage
    const key = `pin_attendance_${program?.id}`;
    if (checked) {
      localStorage.setItem(key, 'true');
      toast.success('Attendance pinned to dashboard');
    } else {
      localStorage.removeItem(key);
      toast.success('Attendance unpinned from dashboard');
    }
    
    // Dispatch custom event to update Quick Actions immediately
    window.dispatchEvent(new Event('attendance-pin-changed'));
  };

  if (!program) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const photoUrl = getThumbnailUrl(program.thumbnail_path || program.image_path);

  const getEnrollmentMessage = () => {
    if (isEnrolled) {
      if (enrollmentStatus === 'completed' && graduatedDate) {
        return `Completed on ${formatDate(graduatedDate.toString())}`;
      }
      if (enrollmentStatus === 'in-progress' && enrollmentDate) {
        return `Enrolled since ${formatDate(enrollmentDate.toString())}`;
      }
      return 'You are enrolled in this program';
    }
    return null;
  };

  const getButtonLabel = () => {
    if (isEnrolled) {
      if (enrollmentStatus === 'completed') return 'Completed';
      if (enrollmentStatus === 'in-progress') return 'Enrolled';
    }
    return 'Apply Now';
  };

  const isButtonDisabled = isEnrolled || isEnrolling;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-h-[90vh] p-0"
        style={{ 
          width: 'calc(100% - 2rem)',
          maxWidth: '42rem'
        }}
        hideCloseButton={true}
      >
        <DialogHeader className="space-y-0.5 sm:space-y-1 px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-3 border-b">
          <DialogTitle className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-lg">
            <GraduationCap className="size-4 sm:size-6" />
            <span className="line-clamp-2">{program.name}</span>
          </DialogTitle>
          <DialogDescription className="text-[10px] sm:text-sm">
            Program details and enrollment information
          </DialogDescription>
        </DialogHeader>

        <div className="px-3 sm:px-6 py-2 sm:py-4">
          <div className="space-y-2 sm:space-y-4">
          {/* Status Badge */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <Badge
              variant={program.status === 'active' ? 'default' : 'secondary'}
              className="text-[10px] sm:text-xs"
            >
              {program.status}
            </Badge>
            {isEnrolled && (
              <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1 text-[10px] sm:text-xs">
                <CheckCircle2 className="size-2.5 sm:size-3" />
                {enrollmentStatus === 'completed' ? 'Completed' : 'Enrolled'}
              </Badge>
            )}
          </div>

          {/* Description */}
          {program.description && (
            <div>
              <h3 className="font-semibold text-[10px] sm:text-sm mb-0.5 sm:mb-1">Description</h3>
              <p className="text-muted-foreground text-[10px] sm:text-sm leading-relaxed">
                {program.description}
              </p>
            </div>
          )}

          {/* Program Details Grid */}
          <div className="grid grid-cols-2 gap-1.5 sm:gap-3 lg:grid-cols-4">
            {/* Start Date */}
            <div className="flex items-start gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-lg border bg-muted/30">
              <div className="flex size-6 sm:size-7 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <Calendar className="size-3 sm:size-3.5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] sm:text-[10px] font-medium text-muted-foreground">Start Date</p>
                <p className="text-[10px] sm:text-xs font-semibold mt-0.5">
                  {formatDate(program.start_date)}
                </p>
              </div>
            </div>

            {/* End Date */}
            <div className="flex items-start gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-lg border bg-muted/30">
              <div className="flex size-6 sm:size-7 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <Calendar className="size-3 sm:size-3.5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] sm:text-[10px] font-medium text-muted-foreground">End Date</p>
                <p className="text-[10px] sm:text-xs font-semibold mt-0.5">
                  {formatDate(program.end_date)}
                </p>
              </div>
            </div>

            {/* Duration */}
            {program.duration_weeks && (
              <div className="flex items-start gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-lg border bg-muted/30">
                <div className="flex size-6 sm:size-7 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <Clock className="size-3 sm:size-3.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] sm:text-[10px] font-medium text-muted-foreground">Duration</p>
                  <p className="text-[10px] sm:text-xs font-semibold mt-0.5">
                    {program.duration_weeks} week{program.duration_weeks !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            )}

            {/* Instructor */}
            {program.instructor && (
              <div className="flex items-start gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-lg border bg-muted/30">
                <div className="flex size-6 sm:size-7 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <User className="size-3 sm:size-3.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] sm:text-[10px] font-medium text-muted-foreground">Instructor</p>
                  <p className="text-[10px] sm:text-xs font-semibold mt-0.5 truncate">{program.instructor}</p>
                </div>
              </div>
            )}

            {/* Max Trainees */}
            {program.max_trainees && (
              <div className="flex items-start gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-lg border bg-muted/30">
                <div className="flex size-6 sm:size-7 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <Users className="size-3 sm:size-3.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] sm:text-[10px] font-medium text-muted-foreground">Max Trainees</p>
                  <p className="text-[10px] sm:text-xs font-semibold mt-0.5">{program.max_trainees}</p>
                </div>
              </div>
            )}
          </div>

          {/* Attendance Button - Only for Enrolled Trainees */}
          {isEnrolled && enrollmentStatus !== 'completed' && (
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full gap-1.5 sm:gap-2 h-auto py-2 sm:py-4"
                onClick={() => {
                  navigate('/trainee/attendance');
                  onOpenChange(false);
                }}
              >
                <CalendarCheck className="size-3.5 sm:size-5" />
                <div className="flex-1 text-left">
                  <div className="font-semibold text-xs sm:text-base">View Attendance</div>
                  <div className="text-[10px] sm:text-sm text-muted-foreground font-normal">
                    Check your attendance records for this program
                  </div>
                </div>
              </Button>

              {/* Pin to Dashboard Option */}
              <div className="flex items-center gap-2 p-2 sm:p-3 rounded-lg border bg-muted/30">
                <Checkbox 
                  id="pin-attendance" 
                  checked={pinToDashboard}
                  onCheckedChange={handlePinToggle}
                />
                <label
                  htmlFor="pin-attendance"
                  className="text-[10px] sm:text-sm font-medium leading-none cursor-pointer flex items-center gap-1 sm:gap-2 flex-1"
                >
                  <Pin className="size-3 sm:size-4" />
                  Pin attendance to dashboard
                </label>
              </div>
            </div>
          )}

          {/* Enrollment Status Info */}
          {isEnrolled && (
            <div className="rounded-lg border border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/20 p-2 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <CheckCircle2 className="size-4 sm:size-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-semibold text-xs sm:text-sm text-green-900 dark:text-green-100">
                    {enrollmentStatus === 'completed'
                      ? 'Program Completed'
                      : 'Enrollment Confirmed'}
                  </h4>
                  <p className="text-[10px] sm:text-sm text-green-700 dark:text-green-300 mt-0.5 sm:mt-1">
                    {getEnrollmentMessage()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Info Banner for Pending Enrollment */}
          {!isEnrolled && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/20 p-2 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="flex size-4 sm:size-5 items-center justify-center rounded-full bg-amber-200 dark:bg-amber-800 shrink-0 mt-0.5">
                  <span className="text-[10px] sm:text-xs font-bold text-amber-900 dark:text-amber-100">!</span>
                </div>
                <div>
                  <h4 className="font-semibold text-xs sm:text-sm text-amber-900 dark:text-amber-100">
                    Ready to apply?
                  </h4>
                  <p className="text-[10px] sm:text-sm text-amber-700 dark:text-amber-300 mt-0.5 sm:mt-1">
                    Click the button below to submit your application. Staff will review and confirm your enrollment.
                  </p>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-col px-3 sm:px-6 py-2 sm:py-4 border-t">
          {!isEnrolled && onEnroll && (
            <Button
              onClick={onEnroll}
              disabled={isButtonDisabled}
              className="w-full gap-2 h-9 sm:h-auto text-xs sm:text-base"
              size="lg"
            >
              {isEnrolling ? 'Submitting...' : getButtonLabel()}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
