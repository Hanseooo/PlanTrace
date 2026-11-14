import type { LucideIcon } from "lucide-react";
import { cn } from "cn";
import { card } from "@/components/page-header";

const TONES = {
  violet: "bg-secondary text-secondary-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-info-soft text-info",
} as const;

/**
 * One KPI tile: a label, a big number and a hint. `value` undefined shows a
 * skeleton (hidden from screen readers; the page's own status says it's loading).
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "violet",
  delay = 0,
}: {
  label: string;
  value: React.ReactNode | undefined;
  hint?: React.ReactNode;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  delay?: number;
}) {
  return (
    <div
      className={cn(
        card,
        "flex animate-fade-up flex-col gap-3 p-5 transition-shadow duration-200 hover:shadow-lift",
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-heading text-sm font-semibold text-muted-foreground">
          {label}
        </p>
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-full",
            TONES[tone],
          )}
        >
          <Icon aria-hidden className="size-4.5" />
        </span>
      </div>
      {value === undefined ? (
        <span aria-hidden className="h-9 w-16 animate-pulse rounded-lg bg-muted" />
      ) : (
        <p className="font-heading text-3xl font-extrabold tracking-tight tabular-nums">
          {value}
        </p>
      )}
      {hint && (
        <p
          aria-hidden={value === undefined || undefined}
          className={cn(
            "text-sm text-muted-foreground",
            value === undefined && "invisible",
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
