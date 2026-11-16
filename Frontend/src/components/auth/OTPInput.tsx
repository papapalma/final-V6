import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../ui/utils';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export interface OTPInputProps {
  /** Current OTP value (0-6 digits) */
  value: string;
  /** Called on each digit entry */
  onChange: (value: string) => void;
  /** Called when 6 digits entered */
  onComplete?: (value: string) => void;
  /** Disable during verification */
  isLoading?: boolean;
  /** Error message to display */
  error?: string;
  /** Focus first field on mount (default: true) */
  autoFocus?: boolean;
  /** Disable all fields */
  disabled?: boolean;
  /** Single char placeholder for each field (default: "0") */
  placeholder?: string;
}

/**
 * OTPInput Component
 * Six separate input fields for OTP entry with excellent UX:
 * - Auto-move to next field on digit entry
 * - Auto-focus previous on backspace
 * - Paste handling: paste 6 digits and auto-fill all fields
 * - Mobile-friendly numeric keyboard (type="tel")
 * - Loading state: disabled with opacity 0.5
 * - Error state: red border when error prop provided
 * - Accessible: ARIA labels, proper focus management
 */
export const OTPInput = React.forwardRef<HTMLDivElement, OTPInputProps>(
  (
    {
      value,
      onChange,
      onComplete,
      isLoading = false,
      error,
      autoFocus = true,
      disabled = false,
      placeholder = '•',
    },
    ref
  ) => {
    const [fields, setFields] = useState<string[]>(value.slice(0, 6).split('').concat(Array(Math.max(0, 6 - value.length)).fill('')));
    const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null));
    const isComplete = value.length === 6;

    // Call onComplete when value becomes complete
    useEffect(() => {
      if (isComplete && onComplete) {
        onComplete(value);
      }
    }, [isComplete, value, onComplete]);

    // Update fields when value prop changes
    useEffect(() => {
      const newFields = value.slice(0, 6).split('').concat(Array(Math.max(0, 6 - value.length)).fill(''));
      setFields(newFields);
    }, [value]);

    // Auto-focus first field on mount if requested
    useEffect(() => {
      if (autoFocus && inputRefs.current[0] && !disabled) {
        inputRefs.current[0].focus();
      }
    }, [autoFocus, disabled]);

    const handleChange = (index: number, char: string) => {
      // Only allow digits
      if (!/^\d?$/.test(char)) {
        return;
      }

      const newFields = [...fields];
      newFields[index] = char;
      setFields(newFields);

      const newValue = newFields.join('').slice(0, 6);
      onChange(newValue);

      // Auto-move to next field
      if (char && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      const isBackspace = e.key === 'Backspace';
      const isDelete = e.key === 'Delete';
      const isArrowLeft = e.key === 'ArrowLeft';
      const isArrowRight = e.key === 'ArrowRight';

      if (isBackspace) {
        e.preventDefault();

        const newFields = [...fields];

        // If current field has a value, clear it
        if (newFields[index]) {
          newFields[index] = '';
          setFields(newFields);
          onChange(newFields.join('').slice(0, 6));
        } else if (index > 0) {
          // Otherwise move to previous field and clear it
          newFields[index - 1] = '';
          setFields(newFields);
          onChange(newFields.join('').slice(0, 6));
          inputRefs.current[index - 1]?.focus();
        }
      } else if (isDelete) {
        e.preventDefault();
        const newFields = [...fields];
        newFields[index] = '';
        setFields(newFields);
        onChange(newFields.join('').slice(0, 6));
      } else if (isArrowLeft && index > 0) {
        e.preventDefault();
        inputRefs.current[index - 1]?.focus();
      } else if (isArrowRight && index < 5) {
        e.preventDefault();
        inputRefs.current[index + 1]?.focus();
      }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();

      const pastedData = e.clipboardData.getData('text/plain');
      const digits = pastedData.replace(/\D/g, '').slice(0, 6);

      if (digits.length > 0) {
        const newFields = digits.split('').concat(Array(6 - digits.length).fill(''));
        setFields(newFields);
        onChange(digits);

        // Auto-focus last filled field or last field
        const lastIndex = Math.min(digits.length - 1, 5);
        inputRefs.current[lastIndex]?.focus();
      }
    };

    const isErrorState = !!error;
    const isLoadingState = isLoading;
    const isDisabledState = disabled || isLoadingState;

    return (
      <div ref={ref} className="space-y-1">
        {/* Input Fields */}
        <div
          className={cn(
            'flex gap-1 transition-opacity duration-200 justify-center',
            isLoadingState && 'opacity-50 cursor-not-allowed'
          )}
        >
          {/* First pair of fields */}
          <div className="flex gap-1">
            {[0, 1].map((index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="tel"
                inputMode="numeric"
                maxLength={1}
                value={fields[index] || ''}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                disabled={isDisabledState}
                aria-label={`OTP digit ${index + 1} of 6`}
                aria-invalid={isErrorState}
                placeholder={placeholder}
                className={cn(
                  'w-10 h-12 text-center text-sm font-semibold rounded border border-2 transition-all',
                  'bg-input-background dark:bg-input/30',
                  'focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'placeholder:text-muted-foreground/40',
                  // Error state
                  isErrorState && 'border-destructive focus:border-destructive focus:ring-destructive/20',
                  // Normal state
                  !isErrorState && 'border-input hover:border-primary/50',
                  // Success state (all filled)
                  isComplete && !isErrorState && 'border-green-500 focus:border-green-500 focus:ring-green-500/20'
                )}
              />
            ))}
          </div>

          {/* Spacer between pairs */}
          <div className="w-0.5" />

          {/* Second pair of fields */}
          <div className="flex gap-1">
            {[2, 3].map((index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="tel"
                inputMode="numeric"
                maxLength={1}
                value={fields[index] || ''}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                disabled={isDisabledState}
                aria-label={`OTP digit ${index + 1} of 6`}
                aria-invalid={isErrorState}
                placeholder={placeholder}
                className={cn(
                  'w-10 h-12 text-center text-sm font-semibold rounded border border-2 transition-all',
                  'bg-input-background dark:bg-input/30',
                  'focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'placeholder:text-muted-foreground/40',
                  // Error state
                  isErrorState && 'border-destructive focus:border-destructive focus:ring-destructive/20',
                  // Normal state
                  !isErrorState && 'border-input hover:border-primary/50',
                  // Success state (all filled)
                  isComplete && !isErrorState && 'border-green-500 focus:border-green-500 focus:ring-green-500/20'
                )}
              />
            ))}
          </div>

          {/* Spacer between pairs */}
          <div className="w-0.5" />

          {/* Third pair of fields */}
          <div className="flex gap-1">
            {[4, 5].map((index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="tel"
                inputMode="numeric"
                maxLength={1}
                value={fields[index] || ''}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                disabled={isDisabledState}
                aria-label={`OTP digit ${index + 1} of 6`}
                aria-invalid={isErrorState}
                placeholder={placeholder}
                className={cn(
                  'w-10 h-12 text-center text-sm font-semibold rounded border border-2 transition-all',
                  'bg-input-background dark:bg-input/30',
                  'focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'placeholder:text-muted-foreground/40',
                  // Error state
                  isErrorState && 'border-destructive focus:border-destructive focus:ring-destructive/20',
                  // Normal state
                  !isErrorState && 'border-input hover:border-primary/50',
                  // Success state (all filled)
                  isComplete && !isErrorState && 'border-green-500 focus:border-green-500 focus:ring-green-500/20'
                )}
              />
            ))}
          </div>

          {/* Success/Error Icon */}
          {isComplete && (
            <div className="flex items-center justify-center ml-1">
              {isErrorState ? (
                <AlertCircle className="size-4 text-destructive animate-pulse" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="size-4 text-green-500" aria-hidden="true" />
              )}
            </div>
          )}
        </div>

        {/* Helper Text */}
        {!isComplete && !error && (
          <p className="text-xs text-muted-foreground text-center">
            Enter the 6-digit code
          </p>
        )}

        {/* Error Message */}
        {error && (
          <div
            className="flex items-center gap-1 text-xs text-destructive"
            role="alert"
            aria-live="polite"
          >
            <AlertCircle className="size-3 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }
);

OTPInput.displayName = 'OTPInput';
