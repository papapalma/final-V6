import { useRef, KeyboardEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';
import { SupportedLanguage } from '../i18n/types';

interface LanguageSegmentedControlProps {
  idPrefix?: string;
  className?: string;
  showToast?: boolean;
}

const OPTIONS: Array<{ value: SupportedLanguage; code: string; labelKey: 'settings.englishOption' | 'settings.filipinoOption' }> = [
  { value: 'en', code: 'EN', labelKey: 'settings.englishOption' },
  { value: 'fil', code: 'FIL', labelKey: 'settings.filipinoOption' },
];

export function LanguageSegmentedControl({
  idPrefix = 'settings',
  className = '',
  showToast = true,
}: LanguageSegmentedControlProps) {
  const { language, setLanguage, t } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  const buttonRefs = useRef<Record<SupportedLanguage, HTMLButtonElement | null>>({
    en: null,
    fil: null,
  });

  const handleSelect = async (next: SupportedLanguage) => {
    if (next === language) return;
    await setLanguage(next);
    if (showToast) {
      toast.success(
        next === 'fil'
          ? t('settings.switchedToFilipinoToast')
          : t('settings.switchedToEnglishToast')
      );
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (
      e.key === 'ArrowRight' ||
      e.key === 'ArrowDown' ||
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowUp'
    ) {
      e.preventDefault();
      const next: SupportedLanguage = language === 'en' ? 'fil' : 'en';
      buttonRefs.current[next]?.focus();
      void handleSelect(next);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={t('settings.languageGroupAria')}
      onKeyDown={handleKeyDown}
      data-no-translate="true"
      className={`inline-flex items-center gap-1 rounded-xl border border-border/80 bg-muted p-1 ${className}`}
    >
      {OPTIONS.map((option) => {
        const isSelected = language === option.value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttonRefs.current[option.value] = el;
            }}
            id={`${idPrefix}-lang-${option.value}`}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => void handleSelect(option.value)}
            className={`lang-segment-btn relative inline-flex min-h-[44px] sm:min-h-[36px] items-center justify-center gap-2 rounded-lg py-2 px-3.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
              isSelected
                ? 'text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {isSelected && (
              <motion.span
                layoutId={`lang-segment-pill-${idPrefix}`}
                aria-hidden="true"
                transition={
                  prefersReducedMotion
                    ? { duration: 0.14, ease: 'easeOut' }
                    : { type: 'spring', bounce: 0, duration: 0.22 }
                }
                className="pointer-events-none absolute inset-0 rounded-lg border border-border/60 bg-card shadow-xs"
              />
            )}
            <span className="relative z-10 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-primary">
              {option.code}
            </span>
            <span className="relative z-10">{t(option.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}

export default LanguageSegmentedControl;
