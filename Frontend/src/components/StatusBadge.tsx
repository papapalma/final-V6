import React from 'react';
import { Badge } from './ui/badge';
import { cn } from './ui/utils';

/**
 * StatusBadge Component
 * 
 * A reusable badge component for displaying trainee status information with
 * appropriate color-coding and visual styling.
 * 
 * Supports three main status categories:
 * 1. Graduation Status (pending, graduated, not_completed, suspended)
 * 2. Employment Status (pending, employed, unemployed, self_employed, pursuing_education, deceased)
 * 3. Skills Match (exact_match, partial_match, no_match, not_applicable)
 * 
 * **Performance Optimization:** Memoized with React.memo to prevent unnecessary
 * re-renders when parent components update but badge props remain unchanged.
 * 
 * Requirement: 2.0, 5.0, 6.0, 7.0
 */

export type GraduationStatusValue = 'pending' | 'graduated' | 'not_completed' | 'suspended';
export type EmploymentStatusValue = 'pending' | 'employed' | 'unemployed' | 'self_employed' | 'pursuing_education' | 'deceased';
export type SkillsMatchValue = 'exact_match' | 'partial_match' | 'no_match' | 'not_applicable';

export type StatusBadgeVariant = GraduationStatusValue | EmploymentStatusValue | SkillsMatchValue;

interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  type?: 'graduation' | 'employment' | 'skills';
  label?: string;
  percentage?: number | null;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Color and styling mappings for graduation status badges
 * Requirement: 5.0 - Display graduation status with color-coded badges
 */
const GRADUATION_STATUS_STYLES: Record<GraduationStatusValue, { color: string; bgColor: string; label: string }> = {
  pending: {
    color: 'text-yellow-700 dark:text-yellow-300',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/40 border-yellow-300 dark:border-yellow-700',
    label: 'Pending',
  },
  graduated: {
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700',
    label: 'Graduated',
  },
  not_completed: {
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-700',
    label: 'Not Completed',
  },
  suspended: {
    color: 'text-orange-700 dark:text-orange-300',
    bgColor: 'bg-orange-100 dark:bg-orange-900/40 border-orange-300 dark:border-orange-700',
    label: 'Suspended',
  },
};

/**
 * Color and styling mappings for employment status badges
 * Requirement: 6.0 - Display employment status with distinct visual styling
 */
const EMPLOYMENT_STATUS_STYLES: Record<EmploymentStatusValue, { color: string; bgColor: string; label: string }> = {
  pending: {
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-100 dark:bg-gray-900/40 border-gray-300 dark:border-gray-700',
    label: 'Pending',
  },
  employed: {
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700',
    label: 'Employed',
  },
  unemployed: {
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-100 dark:bg-gray-900/40 border-gray-300 dark:border-gray-700',
    label: 'Unemployed',
  },
  self_employed: {
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700',
    label: 'Self-Employed',
  },
  pursuing_education: {
    color: 'text-yellow-700 dark:text-yellow-300',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/40 border-yellow-300 dark:border-yellow-700',
    label: 'Pursuing Education',
  },
  deceased: {
    color: 'text-slate-700 dark:text-slate-300',
    bgColor: 'bg-slate-100 dark:bg-slate-900/40 border-slate-300 dark:border-slate-700',
    label: 'Deceased',
  },
};

/**
 * Color and styling mappings for skills match badges
 * Requirement: 7.0 - Track job-skills alignment with color-coded badges
 */
const SKILLS_MATCH_STYLES: Record<SkillsMatchValue, { color: string; bgColor: string; label: string; icon: string }> = {
  exact_match: {
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700',
    label: 'Exact Match',
    icon: '✓',
  },
  partial_match: {
    color: 'text-yellow-700 dark:text-yellow-300',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/40 border-yellow-300 dark:border-yellow-700',
    label: 'Partial Match',
    icon: '◐',
  },
  no_match: {
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-100 dark:bg-gray-900/40 border-gray-300 dark:border-gray-700',
    label: 'No Match',
    icon: '✗',
  },
  not_applicable: {
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700',
    label: 'Not Applicable',
    icon: '—',
  },
};

/**
 * StatusBadge Component
 * 
 * Displays a color-coded badge for trainee status information.
 * **Memoized:** Prevents re-renders when props haven't changed.
 * 
 * @param variant - The status value (e.g., 'graduated', 'employed', 'exact_match')
 * @param type - The status category (graduation, employment, or skills)
 * @param label - Optional custom label to override the default
 * @param percentage - Optional percentage to display (for skills match)
 * @param className - Optional additional CSS classes
 * @param children - Optional custom content
 * 
 * Examples:
 * - <StatusBadge variant="graduated" type="graduation" />
 * - <StatusBadge variant="employed" type="employment" />
 * - <StatusBadge variant="partial_match" type="skills" percentage={65} />
 */
export const StatusBadge = React.memo(function StatusBadge({
  variant,
  type = 'employment',
  label,
  percentage,
  className,
  children,
}: StatusBadgeProps): React.ReactElement {
  let styles;
  let displayLabel = label;
  let icon = '';

  // Determine styles based on status type
  if (type === 'graduation') {
    styles = GRADUATION_STATUS_STYLES[variant as GraduationStatusValue];
  } else if (type === 'skills') {
    const skillsStyle = SKILLS_MATCH_STYLES[variant as SkillsMatchValue];
    styles = skillsStyle;
    icon = skillsStyle.icon;
    // Format skills match display with percentage
    if (!label) {
      displayLabel = percentage !== null && percentage !== undefined
        ? `${skillsStyle.label} (${percentage}%)`
        : skillsStyle.label;
    }
  } else {
    // Default to employment status
    styles = EMPLOYMENT_STATUS_STYLES[variant as EmploymentStatusValue];
  }

  if (!styles) {
    // Fallback for unknown variants
    styles = {
      color: 'text-gray-700 dark:text-gray-300',
      bgColor: 'bg-gray-100 dark:bg-gray-900/40 border-gray-300 dark:border-gray-700',
      label: 'Unknown',
    };
  }

  // Use custom label if provided, otherwise use default
  const finalLabel = displayLabel || styles.label;

  return (
    <Badge
      className={cn(
        'border font-medium inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm transition-all duration-200 ease-out',
        styles.bgColor,
        styles.color,
        className
      )}
      variant="outline"
    >
      {icon && <span className="text-xs font-bold">{icon}</span>}
      {children || finalLabel}
    </Badge>
  );
});

StatusBadge.displayName = 'StatusBadge';

/**
 * Helper component to get the appropriate status badge for a graduation status.
 * **Memoized:** Prevents re-renders when props haven't changed.
 * 
 * Useful for quick badge creation without specifying type each time.
 */
export const GraduationStatusBadge = React.memo(
  ({
    status,
    className,
  }: {
    status: GraduationStatusValue;
    className?: string;
  }) => {
    return <StatusBadge variant={status} type="graduation" className={className} />;
  },
  (prevProps, nextProps) => {
    // Return true if props are equal (skip re-render)
    return prevProps.status === nextProps.status && prevProps.className === nextProps.className;
  }
);

GraduationStatusBadge.displayName = 'GraduationStatusBadge';

/**
 * Helper component to get the appropriate status badge for an employment status.
 * **Memoized:** Prevents re-renders when props haven't changed.
 * 
 * Useful for quick badge creation without specifying type each time.
 */
export const EmploymentStatusBadge = React.memo(
  ({
    status,
    className,
  }: {
    status: EmploymentStatusValue;
    className?: string;
  }) => {
    return <StatusBadge variant={status} type="employment" className={className} />;
  },
  (prevProps, nextProps) => {
    // Return true if props are equal (skip re-render)
    return prevProps.status === nextProps.status && prevProps.className === nextProps.className;
  }
);

EmploymentStatusBadge.displayName = 'EmploymentStatusBadge';

/**
 * Helper component to get the appropriate status badge for skills match.
 * **Memoized:** Prevents re-renders when props haven't changed.
 * 
 * Automatically includes percentage if provided.
 */
export const SkillsMatchBadge = React.memo(
  ({
    match,
    percentage,
    className,
  }: {
    match: SkillsMatchValue;
    percentage?: number | null;
    className?: string;
  }) => {
    return (
      <StatusBadge
        variant={match}
        type="skills"
        percentage={percentage}
        className={className}
      />
    );
  },
  (prevProps, nextProps) => {
    // Return true if props are equal (skip re-render)
    return (
      prevProps.match === nextProps.match &&
      prevProps.percentage === nextProps.percentage &&
      prevProps.className === nextProps.className
    );
  }
);

SkillsMatchBadge.displayName = 'SkillsMatchBadge';

export default StatusBadge;
