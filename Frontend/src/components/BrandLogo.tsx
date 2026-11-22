import { useState, useEffect } from 'react';
import { GraduationCap } from 'lucide-react';
import { useBranding, getBrandInitials } from '../contexts/BrandingContext';
import { getFileUrl } from '../services/api';
import { cn } from './ui/utils';

export interface BrandLogoProps {
  /** Optional explicit logo URL/path override (e.g. tenant preview on landing page) */
  logoUrl?: string | null;
  /** Optional organization name for alt text & monogram fallback */
  companyName?: string;
  /** Size preset aligned to 8pt harmonic scale */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Fallback visual when no logo is uploaded or image fails to load */
  fallbackVariant?: 'monogram' | 'icon';
  className?: string;
  imgClassName?: string;
}

const SIZE_CLASSES: Record<NonNullable<BrandLogoProps['size']>, { box: string; text: string; icon: string }> = {
  xs: { box: 'size-8 rounded-lg', text: 'text-[10px] font-bold', icon: 'size-4' },
  sm: { box: 'size-10 rounded-xl', text: 'text-xs font-bold', icon: 'size-5' },
  md: { box: 'size-12 rounded-xl', text: 'text-sm font-bold', icon: 'size-6' },
  lg: { box: 'size-16 rounded-2xl', text: 'text-xl font-bold', icon: 'size-8' },
};

export function BrandLogo({
  logoUrl,
  companyName,
  size = 'sm',
  fallbackVariant = 'monogram',
  className,
  imgClassName,
}: BrandLogoProps) {
  const branding = useBranding();
  const resolvedSrc =
    logoUrl !== undefined
      ? logoUrl
        ? getFileUrl(logoUrl)
        : null
      : branding.logoUrl;
  const resolvedName = companyName || branding.companyName;

  const [imgFailed, setImgFailed] = useState(false);

  // Reset error state whenever logo URL changes so newly uploaded logos render immediately
  useEffect(() => {
    setImgFailed(false);
  }, [resolvedSrc]);

  const preset = SIZE_CLASSES[size];

  if (resolvedSrc && !imgFailed) {
    return (
      <img
        src={resolvedSrc}
        alt={`${resolvedName} Logo`}
        loading="lazy"
        onError={() => setImgFailed(true)}
        className={cn(
          preset.box,
          'shrink-0 border border-border bg-card object-contain shadow-xs',
          className,
          imgClassName,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        preset.box,
        'flex shrink-0 items-center justify-center bg-primary text-primary-foreground shadow-sm select-none',
        className,
      )}
      aria-label={`${resolvedName} Logo`}
    >
      {fallbackVariant === 'icon' ? (
        <GraduationCap className={preset.icon} />
      ) : (
        <span className={preset.text}>{getBrandInitials(resolvedName)}</span>
      )}
    </div>
  );
}

export default BrandLogo;
