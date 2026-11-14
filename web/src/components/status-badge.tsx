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
  success: { className: "bg-success-soft text-success", icon: CircleCheck },
  warning: { className: "bg-warning-soft text-warning", icon: CircleAlert },
  danger: { className: "bg-destructive/10 text-destructive", icon: CircleX },
  info: { className: "bg-secondary text-secondary-foreground", icon: Sparkles },
  neutral: { className: "bg-muted text-muted-foreground", icon: CircleDashed },
  busy: {
    className: "bg-secondary text-secondary-foreground",
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
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium whitespace-nowrap",
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
