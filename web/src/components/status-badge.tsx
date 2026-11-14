import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleX,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { cn } from "cn";

export type Tone =
  "success" | "warning" | "danger" | "info" | "neutral" | "busy";

const TONES: Record<Tone, { className: string; icon: typeof CircleCheck }> = {
  success: {
    className: "bg-success-soft text-success ring-success/20",
    icon: CircleCheck,
  },
  warning: {
    className: "bg-warning-soft text-warning ring-warning/25",
    icon: CircleAlert,
  },
  danger: {
    className: "bg-destructive/10 text-destructive ring-destructive/20",
    icon: CircleX,
  },
  info: {
    className: "bg-secondary text-secondary-foreground ring-primary/15",
    icon: Sparkles,
  },
  neutral: {
    className: "bg-muted text-muted-foreground ring-border",
    icon: CircleDashed,
  },
  busy: {
    className: "bg-secondary text-secondary-foreground ring-primary/15",
    icon: LoaderCircle,
  },
};

/**
 * A status pill: colour plus an icon, so meaning never rests on colour alone.
 * The icon is hidden from screen readers; the text is the accessible name.
 */
export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  const { className: toneClass, icon: Icon } = TONES[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm leading-none font-bold whitespace-nowrap ring-1 ring-inset",
        toneClass,
        className,
      )}
    >
      <Icon
        aria-hidden
        className={cn("size-4 shrink-0", tone === "busy" && "animate-spin")}
      />
      {children}
    </span>
  );
}
