"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CircleCheck, CircleX, Info, X } from "lucide-react";
import { cn } from "cn";

type ToastTone = "success" | "error" | "info";

type ToastItem = {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
};

// A tiny module store, so any handler (a mutation's onSuccess, an event
// listener) can raise a toast without a hook or a context.
let items: ToastItem[] = [];
const listeners = new Set<() => void>();
let nextId = 1;
const EMPTY: ToastItem[] = [];
const MAX_VISIBLE = 4;

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function push(tone: ToastTone, title: string, description?: string) {
  const item = { id: nextId++, tone, title, description };
  items = [...items.slice(-(MAX_VISIBLE - 1)), item];
  emit();
  return item.id;
}

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

/** Raise a toast: `toast.success("Plan confirmed", "Its PPAs now go into checks.")`. */
export const toast = {
  success: (title: string, description?: string) =>
    push("success", title, description),
  error: (title: string, description?: string) =>
    push("error", title, description),
  info: (title: string, description?: string) =>
    push("info", title, description),
};

const TONES: Record<
  ToastTone,
  { icon: typeof CircleCheck; iconClass: string; bar: string; ms: number }
> = {
  success: {
    icon: CircleCheck,
    iconClass: "bg-success-soft text-success",
    bar: "bg-success",
    ms: 4500,
  },
  // Errors stay longer: they usually need reading.
  error: {
    icon: CircleX,
    iconClass: "bg-destructive/10 text-destructive",
    bar: "bg-destructive",
    ms: 8000,
  },
  info: {
    icon: Info,
    iconClass: "bg-secondary text-secondary-foreground",
    bar: "bg-primary",
    ms: 4500,
  },
};

/**
 * The toast stack, bottom right. It is a polite live region with no role of its
 * own, so screen readers hear each toast without it competing with the page's
 * own status and alert messages, which stay the source of truth.
 */
export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => items, () => EMPTY);

  // Going offline is the most common cause of a failed save; say so up front.
  useEffect(() => {
    const offline = () =>
      toast.error(
        "You're offline",
        "Changes won't save until the connection is back.",
      );
    const online = () => toast.success("Back online");
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6"
    >
      {list.map((item) => (
        <Toast key={item.id} item={item} />
      ))}
    </div>
  );
}

function Toast({ item }: { item: ToastItem }) {
  const { icon: Icon, iconClass, bar, ms } = TONES[item.tone];
  const [paused, setPaused] = useState(false);
  const left = useRef(ms);
  const startedAt = useRef(0);

  // Hover or focus pauses the timer, so a toast never vanishes mid-read.
  useEffect(() => {
    if (paused) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => dismissToast(item.id), left.current);
    return () => {
      window.clearTimeout(timer);
      left.current -= Date.now() - startedAt.current;
    };
  }, [paused, item.id]);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto relative flex w-full animate-toast-in items-start gap-3 overflow-hidden rounded-2xl border bg-card p-4 pr-11 text-card-foreground shadow-lift sm:w-96"
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          iconClass,
        )}
      >
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5 pt-1">
        <p className="font-heading text-sm font-bold">{item.title}</p>
        {item.description && (
          <p className="text-sm text-muted-foreground">{item.description}</p>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => dismissToast(item.id)}
        className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <X aria-hidden className="size-4" />
      </button>
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 bottom-0 h-0.5 origin-left opacity-60",
          bar,
        )}
        style={{
          animation: `toast-progress ${ms}ms linear forwards`,
          animationPlayState: paused ? "paused" : "running",
        }}
      />
    </div>
  );
}
