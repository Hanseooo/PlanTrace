"use client";

import type { UseQueryResult } from "@tanstack/react-query";
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
      <p role="status" className="text-muted-foreground">
        Loading {what}…
      </p>
    );
  }
  if (query.isError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-2 rounded-lg border border-destructive/40 p-4"
      >
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
    );
  }
  if (isEmpty(query.data)) {
    return <div className="text-muted-foreground">{empty}</div>;
  }
  return children(query.data);
}
