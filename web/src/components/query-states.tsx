"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { Inbox, RotateCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * RS-01 states for one query: loading, error with Retry, empty with the next
 * action, else the data.
 */
export function QueryStates<T>({
  query,
  what,
  isEmpty,
  empty,
  children,
}: {
  query: UseQueryResult<T>;
  /** Plural noun for the messages, e.g. "plans". */
  what: string;
  isEmpty: (data: T) => boolean;
  /** The empty message, naming the next action. */
  empty: React.ReactNode;
  children: (data: T) => React.ReactNode;
}) {
  if (query.isPending) {
    return (
      <div className="flex w-full flex-col gap-3 py-2">
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <span
            aria-hidden
            className="size-2 animate-pulse rounded-full bg-primary"
          />
          Loading {what}…
        </p>
        <div aria-hidden className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-2xl bg-muted"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }
  if (query.isError) {
    return (
      <div
        role="alert"
        className="flex w-full flex-col items-start gap-4 rounded-3xl border border-destructive/25 bg-destructive/5 p-5 sm:flex-row"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <WifiOff aria-hidden className="size-5" />
        </span>
        <div className="flex flex-col items-start gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="font-heading font-bold">Couldn&apos;t load {what}.</p>
            <p className="text-sm text-muted-foreground">
              {query.error.message}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            <RotateCw
              aria-hidden
              className={query.isFetching ? "animate-spin" : undefined}
            />
            {query.isFetching ? "Retrying…" : "Retry"}
          </Button>
        </div>
      </div>
    );
  }
  if (isEmpty(query.data)) {
    if (empty === null) return null;
    return (
      <div className="flex w-full flex-col items-center gap-3 rounded-3xl border border-dashed border-input bg-card/60 px-6 py-10 text-center text-muted-foreground">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
          <Inbox aria-hidden className="size-6" />
        </span>
        <div className="max-w-md">{empty}</div>
      </div>
    );
  }
  return children(query.data);
}
