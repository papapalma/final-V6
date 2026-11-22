import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils";

const filterPillVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 select-none cursor-pointer active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
  {
    variants: {
      tone: {
        neutral:
          "border-border bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground",
        success:
          "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400",
        info:
          "border-blue-500/25 bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-400",
        warning:
          "border-amber-500/25 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-400",
        danger:
          "border-red-500/25 bg-red-500/10 text-red-700 hover:bg-red-500/20 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-400",
        muted:
          "border-slate-400/25 bg-slate-500/10 text-slate-600 hover:bg-slate-500/20 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-300",
      },
      active: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      {
        tone: "neutral",
        active: true,
        className:
          "border-transparent bg-foreground text-background shadow-xs hover:bg-foreground/90 hover:text-background",
      },
      {
        tone: "success",
        active: true,
        className:
          "border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-600/25 hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:text-white",
      },
      {
        tone: "info",
        active: true,
        className:
          "border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700 dark:border-blue-500 dark:bg-blue-600 dark:text-white",
      },
      {
        tone: "warning",
        active: true,
        className:
          "border-amber-500 bg-amber-500 text-white shadow-sm shadow-amber-500/25 hover:bg-amber-600 dark:border-amber-500 dark:bg-amber-600 dark:text-white",
      },
      {
        tone: "danger",
        active: true,
        className:
          "border-red-600 bg-red-600 text-white shadow-sm shadow-red-600/25 hover:bg-red-700 dark:border-red-500 dark:bg-red-600 dark:text-white",
      },
      {
        tone: "muted",
        active: true,
        className:
          "border-slate-600 bg-slate-600 text-white shadow-sm shadow-slate-600/25 hover:bg-slate-700 dark:border-slate-500 dark:bg-slate-600 dark:text-white",
      },
    ],
    defaultVariants: {
      tone: "neutral",
      active: false,
    },
  },
);

export interface FilterPillProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof filterPillVariants> {
  active?: boolean;
}

const FilterPill = React.forwardRef<HTMLButtonElement, FilterPillProps>(
  ({ className, tone, active = false, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-pressed={active}
      data-slot="filter-pill"
      data-active={active ? "true" : "false"}
      className={cn(filterPillVariants({ tone, active, className }))}
      {...props}
    />
  ),
);
FilterPill.displayName = "FilterPill";

export { FilterPill, filterPillVariants };
