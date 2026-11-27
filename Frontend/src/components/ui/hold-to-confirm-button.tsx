import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { cn } from './utils';

interface HoldToConfirmButtonProps {
  onConfirm: () => Promise<void> | void;
  durationMs?: number;
  disabled?: boolean;
  isProcessing?: boolean;
  label?: string;
  holdingLabel?: string;
  processingLabel?: string;
  className?: string;
}

/**
 * Tactile hold-to-confirm destructive button for irreversible actions (e.g. permanent archive purge).
 * Supports both pointer press-and-hold and keyboard Space/Enter hold, with reduced-motion fallback.
 */
export function HoldToConfirmButton({
  onConfirm,
  durationMs = 1500,
  disabled = false,
  isProcessing = false,
  label = 'Hold to Delete Permanently',
  holdingLabel = 'Keep holding...',
  processingLabel = 'Deleting...',
  className,
}: HoldToConfirmButtonProps) {
  const [holding, setHolding] = React.useState(false);
  const [remainingMs, setRemainingMs] = React.useState(durationMs);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = React.useRef<number>(0);
  const confirmedRef = React.useRef(false);

  const clearTimers = React.useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (tickRef.current !== null) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const cancelHold = React.useCallback(() => {
    clearTimers();
    setHolding(false);
    setRemainingMs(durationMs);
  }, [clearTimers, durationMs]);

  const startHold = React.useCallback(() => {
    if (disabled || isProcessing || holding) return;
    confirmedRef.current = false;
    startedAtRef.current = Date.now();
    setHolding(true);
    setRemainingMs(durationMs);

    tickRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      setRemainingMs(Math.max(0, durationMs - elapsed));
    }, 100);

    timerRef.current = setTimeout(() => {
      clearTimers();
      confirmedRef.current = true;
      setHolding(false);
      setRemainingMs(durationMs);
      void onConfirm();
    }, durationMs);
  }, [clearTimers, disabled, durationMs, holding, isProcessing, onConfirm]);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || disabled || isProcessing) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // jsdom / environments without pointer capture
    }
    startHold();
  };

  const handlePointerEnd = () => {
    if (!confirmedRef.current) {
      cancelHold();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      startHold();
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!confirmedRef.current) {
        cancelHold();
      }
    }
  };

  const secondsText = (remainingMs / 1000).toFixed(1);

  return (
    <button
      type="button"
      data-slot="button"
      data-holding={holding ? 'true' : 'false'}
      disabled={disabled || isProcessing}
      aria-label={`${label} (hold for ${(durationMs / 1000).toFixed(1)} seconds)`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onBlur={handlePointerEnd}
      style={{ '--hold-duration': `${durationMs}ms` } as React.CSSProperties}
      className={cn(
        'relative inline-flex h-10 items-center justify-center gap-2 overflow-hidden rounded-md bg-destructive/90 px-4 py-2.5 text-sm font-medium text-white select-none transition-transform duration-100 ease-out focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-destructive/30 disabled:pointer-events-none disabled:opacity-50',
        holding && 'scale-[0.98]',
        className,
      )}
    >
      {/* GPU-composited clip-path progress fill */}
      <span
        aria-hidden="true"
        className="hold-confirm-fill pointer-events-none absolute inset-0 bg-red-800/90 dark:bg-red-700"
      />
      <span className="relative z-10 inline-flex items-center gap-2">
        {isProcessing ? (
          <>
            <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>{processingLabel}</span>
          </>
        ) : holding ? (
          <>
            <Trash2 className="size-4" />
            <span>
              {holdingLabel} ({secondsText}s)
            </span>
          </>
        ) : (
          <>
            <Trash2 className="size-4" />
            <span>{label}</span>
          </>
        )}
      </span>
    </button>
  );
}
