"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { Inbox, LoaderCircle, TriangleAlert } from "lucide-react";
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
      <div className="flex items-center gap-2 py-6 text-muted-foreground">
        <LoaderCircle aria-hidden className="size-5 animate-spin" />
        <p role="status">Loading {what}…</p>
      </div>
    );
  }
  if (query.isError) {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4"
      >
        <TriangleAlert
          aria-hidden
          className="mt-0.5 size-5 shrink-0 text-destructive"
        />
        <div className="flex flex-col items-start gap-3">
          <p>
            Couldn&apos;t load {what}. {query.error.message}
          </p>
          <Button
            variant="outline"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            {query.isFetching ? "Retrying…" : "Retry"}
          </Button>
        </div>
      </div>
    );
  }
  if (isEmpty(query.data)) {
    if (empty === null) return null;
    return (
      <div className="flex items-start gap-3 rounded-xl border border-dashed bg-card p-6 text-muted-foreground">
        <Inbox aria-hidden className="mt-0.5 size-5 shrink-0" />
        <div>{empty}</div>
      </div>
    );
  }
  return children(query.data);
}
