import * as React from 'react';
import { cn } from './utils';

const EXIT_DURATION_MS = 150;
const BUMP_DURATION_MS = 150;

export function formatBadgeCount(count: number, max = 99): string | null {
  if (!Number.isFinite(count) || count <= 0) {
    return null;
  }
  const safeCount = Math.floor(count);
  if (safeCount <= 0) {
    return null;
  }
  return safeCount > max ? `${max}+` : String(safeCount);
}

export function formatBadgeAriaLabel(
  baseLabel: string,
  count: number,
  singularUnit: string,
  pluralUnit = `${singularUnit}s`,
): string {
  if (!Number.isFinite(count) || count <= 0) {
    return baseLabel;
  }
  const safeCount = Math.floor(count);
  if (safeCount <= 0) {
    return baseLabel;
  }
  const unit = safeCount === 1 ? singularUnit : pluralUnit;
  return `${baseLabel}, ${safeCount} ${unit}`;
}

export type NotificationStatus = 'online' | 'busy' | 'offline' | 'error';

export type NotificationBadgeProps =
  | {
      variant: 'count';
      count: number;
      max?: number;
      size?: 'sm' | 'md';
      position?: 'corner' | 'inline';
      ringClassName?: string;
      ariaLabel?: string;
      className?: string;
    }
  | {
      variant: 'dot';
      show: boolean;
      position?: 'corner' | 'inline';
      ringClassName?: string;
      ariaLabel?: string;
      className?: string;
    }
  | {
      variant: 'status';
      status: NotificationStatus;
      position?: 'bottom-right' | 'inline';
      ringClassName?: string;
      ariaLabel?: string;
      className?: string;
    };

const STATUS_COLOR_MAP: Record<NotificationStatus, string> = {
  online: 'bg-emerald-500',
  busy: 'bg-amber-500',
  offline: 'bg-slate-400 dark:bg-slate-500',
  error: 'bg-red-600',
};

function CountBadge({
  count,
  max = 99,
  size = 'md',
  position = 'corner',
  ringClassName = 'ring-card',
  ariaLabel,
  className,
}: Extract<NotificationBadgeProps, { variant: 'count' }>) {
  const formatted = formatBadgeCount(count, max);
  const [renderedText, setRenderedText] = React.useState<string | null>(formatted);
  const [isExiting, setIsExiting] = React.useState(false);
  const [isBumping, setIsBumping] = React.useState(false);
  const prevCountRef = React.useRef<number>(count);
  const isMountedBadgeRef = React.useRef<boolean>(formatted !== null);

  React.useEffect(() => {
    const prevCount = prevCountRef.current;
    prevCountRef.current = count;

    if (formatted !== null) {
      isMountedBadgeRef.current = true;
      setIsExiting(false);
      setRenderedText(formatted);

      if (prevCount > 0 && count > prevCount) {
        setIsBumping(true);
        const bumpTimer = window.setTimeout(() => setIsBumping(false), BUMP_DURATION_MS);
        return () => window.clearTimeout(bumpTimer);
      }
      return;
    }

    if (isMountedBadgeRef.current) {
      setIsBumping(false);
      setIsExiting(true);
      const exitTimer = window.setTimeout(() => {
        isMountedBadgeRef.current = false;
        setRenderedText(null);
        setIsExiting(false);
      }, EXIT_DURATION_MS);
      return () => window.clearTimeout(exitTimer);
    }
  }, [count, formatted]);

  if (renderedText === null) {
    return null;
  }

  return (
    <span
      data-slot="notification-badge"
      data-variant="count"
      data-state={isExiting ? 'exiting' : 'visible'}
      role={ariaLabel ? 'status' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className={cn(
        'pointer-events-none select-none inline-flex items-center justify-center rounded-full bg-red-600 font-semibold leading-none whitespace-nowrap tabular-nums text-white shadow-xs ring-2 transition-[opacity,transform,scale] duration-150 ease-out',
        ringClassName,
        size === 'sm' ? 'h-4 min-w-4 px-1 text-[10px]' : 'h-5 min-w-5 px-1.5 text-[11px]',
        position === 'corner'
          ? 'absolute top-0 right-0 z-10 translate-x-1/3 -translate-y-1/3'
          : 'relative shrink-0',
        isExiting ? 'opacity-0 scale-80' : 'opacity-100 scale-100',
        isBumping && 'notif-badge-bump',
        className,
      )}
    >
      {renderedText}
    </span>
  );
}

function DotBadge({
  show,
  position = 'corner',
  ringClassName = 'ring-card',
  ariaLabel,
  className,
}: Extract<NotificationBadgeProps, { variant: 'dot' }>) {
  const [rendered, setRendered] = React.useState(show);
  const [isExiting, setIsExiting] = React.useState(false);

  React.useEffect(() => {
    if (show) {
      setIsExiting(false);
      setRendered(true);
      return;
    }

    if (rendered) {
      setIsExiting(true);
      const exitTimer = window.setTimeout(() => {
        setRendered(false);
        setIsExiting(false);
      }, EXIT_DURATION_MS);
      return () => window.clearTimeout(exitTimer);
    }
  }, [show, rendered]);

  if (!rendered) {
    return null;
  }

  return (
    <span
      data-slot="notification-badge"
      data-variant="dot"
      data-state={isExiting ? 'exiting' : 'visible'}
      role={ariaLabel ? 'status' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className={cn(
        'pointer-events-none select-none inline-block size-2 rounded-full bg-red-600 ring-2 transition-[opacity,transform,scale] duration-150 ease-out',
        ringClassName,
        position === 'corner'
          ? 'absolute top-0 right-0 z-10 translate-x-1/3 -translate-y-1/3'
          : 'relative shrink-0',
        isExiting ? 'opacity-0 scale-80' : 'opacity-100 scale-100',
        className,
      )}
    />
  );
}

function StatusBadgeDot({
  status,
  position = 'inline',
  ringClassName = 'ring-card',
  ariaLabel,
  className,
}: Extract<NotificationBadgeProps, { variant: 'status' }>) {
  return (
    <span
      data-slot="notification-badge"
      data-variant="status"
      data-status={status}
      role={ariaLabel ? 'status' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className={cn(
        'pointer-events-none select-none inline-block size-2 rounded-full transition-colors duration-150 ease-out',
        STATUS_COLOR_MAP[status],
        position === 'bottom-right'
          ? cn('absolute bottom-0 right-0 z-10 translate-x-1/4 translate-y-1/4 ring-2', ringClassName)
          : 'relative shrink-0',
        className,
      )}
    />
  );
}

export function NotificationBadge(props: NotificationBadgeProps) {
  if (props.variant === 'count') {
    return <CountBadge {...props} />;
  }
  if (props.variant === 'dot') {
    return <DotBadge {...props} />;
  }
  return <StatusBadgeDot {...props} />;
}
