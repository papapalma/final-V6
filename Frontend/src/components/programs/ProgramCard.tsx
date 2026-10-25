import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Calendar, Clock, User, Users, BarChart3 } from 'lucide-react';
import { EnrollmentButton, EnrollmentStatus, getEnrollmentButtonState } from './EnrollmentButton';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useNavigate } from 'react-router-dom';
import programService from '../../services/programService';
import { Skeleton } from '../ui/skeleton';

interface Program {
  id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  status: string;
  instructor?: string | null;
  duration_weeks?: number;
  max_trainees?: number;
  enrollment_limit?: number | null;
  thumbnail_path?: string;
  image_path?: string;
  icon?: React.ReactNode;
  current_enrollment?: number;
}

interface ProgramCardProps {
  program: Program;
  photoUrl?: string;
  isEnrolled?: boolean;
  enrollmentStatus?: 'accepting' | 'in-progress' | 'completed';
  enrollmentDate?: Date;
  graduatedDate?: Date;
  onEnroll?: () => void;
  isEnrolling?: boolean;
  enrollmentLimit?: number | null;
  enrolledCount?: number;
}

interface ProgramStats {
  current_enrollment: number;
  enrollment_limit?: number | null;
  max_trainees: number;
  pending_registrations: number;
  approved_registrations: number;
  total_registrations: number;
  total_interested: number;
  capacity_percentage: number;
  available_spots: number;
  program_status: string;
}

export function ProgramCard({
  program,
  photoUrl,
  isEnrolled = false,
  enrollmentStatus = 'accepting',
  enrollmentDate,
  graduatedDate,
  onEnroll,
  isEnrolling = false,
  enrollmentLimit,
  enrolledCount = 0,
}: ProgramCardProps) {
  const [showButton, setShowButton] = useState(false);
  const [stats, setStats] = useState<ProgramStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Use media query hook to detect desktop viewport (1024px+)
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  // Fetch program stats when card mounts or program ID changes
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setStatsLoading(true);
        const statsData = await programService.getProgramSpecificStats(program.id);
        setStats(statsData);
      } catch (error) {
        // Silently fail - stats are optional enhancements for trainee view
        // 403 errors are expected when user lacks permissions
      } finally {
        setStatsLoading(false);
      }
    };

    if (program.id) {
      fetchStats();
    }
  }, [program.id]);

  // Calculate capacity state using stats or props
  const enrollmentCount = stats?.current_enrollment ?? enrolledCount;
  const enrollmentCapacity = stats?.enrollment_limit ?? enrollmentLimit;
  const isAtCapacity = enrollmentCapacity
    ? enrollmentCount >= enrollmentCapacity
    : false;

  const isUnlimited = enrollmentCapacity === null || enrollmentCapacity === undefined;

  const handleMouseEnter = () => {
    if (isDesktop) {
      setShowButton(true);
    }
  };

  const handleMouseLeave = () => {
    if (isDesktop) {
      setShowButton(false);
    }
  };

  const handleTouchStart = () => {
    if (!isDesktop) {
      setShowButton(true);
    }
  };

  const handleTouchEnd = () => {
    if (!isDesktop) {
      setShowButton(false);
    }
  };

  const handleCardFocus = () => {
    setShowButton(true);
  };

  const handleCardBlur = () => {
    setShowButton(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const buttonState = getEnrollmentButtonState(
    isEnrolled,
    enrollmentStatus,
    enrollmentDate,
    graduatedDate
  );

  // Override button state if at capacity
  const finalButtonState = isAtCapacity && !isUnlimited
    ? {
        ...buttonState,
        disabled: true,
        label: 'Program Full',
        tooltip: 'Program is at capacity',
      }
    : buttonState;

  return (
    <Card
      ref={cardRef}
      className="group hover:shadow-lg transition-all overflow-hidden flex flex-col relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onFocus={handleCardFocus}
      onBlur={handleCardBlur}
      tabIndex={0}
    >
      {/* Program Image */}
      {photoUrl && (
        <div className="w-full h-48 rounded-t-lg overflow-hidden border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
          <img
            src={photoUrl}
            alt={program.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Program Header */}
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
            {program.icon}
          </div>
          <Badge variant={program.status === 'active' ? 'default' : 'secondary'}>
            {program.status}
          </Badge>
        </div>
        <CardTitle className="mt-2 text-base leading-snug">{program.name}</CardTitle>
        {program.description && (
          <CardDescription className="line-clamp-2">{program.description}</CardDescription>
        )}
      </CardHeader>

      {/* Program Content */}
      <CardContent className="flex flex-col flex-1 gap-3">
        <div className="space-y-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="size-3.5 shrink-0" />
            <span>
              {formatDate(program.start_date)} – {formatDate(program.end_date)}
            </span>
          </div>
          {program.duration_weeks && (
            <div className="flex items-center gap-2">
              <Clock className="size-3.5 shrink-0" />
              <span>{program.duration_weeks} week{program.duration_weeks !== 1 ? 's' : ''}</span>
            </div>
          )}
          {program.instructor && (
            <div className="flex items-center gap-2">
              <User className="size-3.5 shrink-0" />
              <span>{program.instructor}</span>
            </div>
          )}
          {program.max_trainees && (
            <div className="flex items-center gap-2">
              <Users className="size-3.5 shrink-0" />
              <span>Max {program.max_trainees} trainees</span>
            </div>
          )}

          {/* Capacity Counter Display - Label Only (no link) */}
          {!isUnlimited && (
            <div className="flex items-center gap-2 pt-1.5 border-t border-gray-200 dark:border-gray-700 mt-2 font-medium text-xs sm:text-sm">
              <Users className="size-3.5 shrink-0" />
              <span className={isAtCapacity ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}>
                {enrollmentCount} / {enrollmentCapacity} enrolled
              </span>
            </div>
          )}

          {/* Total Registrations - Label Only (no link) */}
          {stats && (
            <div className="flex items-center gap-2 pt-1.5 font-medium text-xs sm:text-sm text-muted-foreground">
              <BarChart3 className="size-3.5 shrink-0" />
              <span>
                {stats.total_registrations} trying to register
              </span>
            </div>
          )}

          {/* Loading Skeleton for Stats */}
          {statsLoading && !stats && (
            <div className="space-y-2 pt-1.5">
              <Skeleton className="h-4 w-24" />
            </div>
          )}
        </div>

        {/* Enrollment Button - Always at bottom */}
        <div className="mt-auto pt-2">
          {/* Full Badge */}
          {isAtCapacity && (
            <div className="mb-2">
              <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
                Full
              </span>
            </div>
          )}
          <EnrollmentButton
            state={finalButtonState}
            onClick={onEnroll}
            isLoading={isEnrolling}
            hidden={!showButton}
            className={`w-full`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
