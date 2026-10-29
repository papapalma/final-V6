import React from 'react';

export type StockLevel = 'out' | 'low' | 'good';

export interface StockStatusInfo {
  level: StockLevel;
  label: string;
  badgeClass: string;
  dotClass: string;
  textClass: string;
}

export function getStockStatus(available: number): StockStatusInfo {
  if (available <= 0) {
    return {
      level: 'out',
      label: 'Out of Stock',
      badgeClass: 'bg-rose-500/10 text-rose-700 border-rose-500/25 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-500/30',
      dotClass: 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]',
      textClass: 'text-rose-700 dark:text-rose-400',
    };
  }
  if (available < 5) {
    return {
      level: 'low',
      label: 'Low Stock',
      badgeClass: 'bg-amber-500/10 text-amber-800 border-amber-500/25 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/30',
      dotClass: 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]',
      textClass: 'text-amber-700 dark:text-amber-400',
    };
  }
  return {
    level: 'good',
    label: 'In Stock',
    badgeClass: 'bg-emerald-500/10 text-emerald-800 border-emerald-500/25 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/30',
    dotClass: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]',
    textClass: 'text-emerald-700 dark:text-emerald-400',
  };
}

interface StockStatusBadgeProps {
  available: number;
  total?: number;
  variant?: 'pill' | 'compact' | 'dot-only';
  className?: string;
}

export default function StockStatusBadge({
  available,
  total,
  variant = 'pill',
  className = '',
}: StockStatusBadgeProps) {
  const status = getStockStatus(available);

  if (variant === 'dot-only') {
    return (
      <span className={`inline-flex items-center gap-1.5 ${status.textClass} font-medium ${className}`}>
        <span className={`size-2 rounded-full ${status.dotClass}`} />
        <span>{available}</span>
      </span>
    );
  }

  if (variant === 'compact') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border backdrop-blur-sm transition-all duration-150 ${status.badgeClass} ${className}`}
      >
        <span className={`size-1.5 rounded-full ${status.dotClass}`} />
        <span>{available}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border backdrop-blur-sm transition-all duration-150 ${status.badgeClass} ${className}`}
    >
      <span className={`size-1.5 rounded-full ${status.dotClass}`} />
      <span>
        {status.label} ({available}{typeof total === 'number' ? `/${total}` : ''})
      </span>
    </span>
  );
}
