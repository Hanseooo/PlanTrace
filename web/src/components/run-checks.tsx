"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, LoaderCircle, Play, ShieldCheck } from "lucide-react";
import { card } from "@/components/page-header";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost, type Schemas } from "@/lib/api";

type CheckRun = Schemas["CheckRunResult"];

const ranAt = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** The latest run, shared by every screen that shows run state. */
export function useLatestRun() {
  return useQuery({
    queryKey: ["checks", "latest"],
    queryFn: () => apiGet<CheckRun | null>("/checks/latest"),
  });
}

/**
 * S4-16, S5-10: the Run checks bar with its pending label, error and
 * "Last run". A run refetches the findings and the matrix.
 */
export function RunChecks() {
  const queryClient = useQueryClient();
  const latest = useLatestRun();
  const run = useMutation({
    mutationFn: () => apiPost<CheckRun>("/checks/run"),
    onSuccess: (result) => {
      queryClient.setQueryData(["checks", "latest"], result);
      // CCC counts every classified pair; the review list is the other checks plus
      // CCC conflicts, so the toast names the pairs compared instead.
      const issues = result.counts
        .filter((c) => c.check !== "ccc")
        .reduce((sum, c) => sum + c.found, 0);
      toast.success(
        "Checks finished",
        `${issues} duplicate, orphan or zone ${issues === 1 ? "finding" : "findings"}, plus the CCC pairs.`,
      );
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ["findings"] }),
        queryClient.invalidateQueries({ queryKey: ["ccc"] }),
      ]);
    },
    onError: (e) => toast.error("Couldn't run checks", e.message),
  });

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`${card} relative flex animate-fade-up flex-wrap items-center justify-between gap-4 overflow-hidden bg-ink p-5 text-ink-foreground sm:p-6`}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-primary/40 blur-3xl"
        />
        <div className="relative flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
            <ShieldCheck aria-hidden className="size-6" />
          </span>
          <div className="flex flex-col gap-0.5">
            <p className="font-heading text-lg font-bold">
              Check every confirmed plan at once
            </p>
            {latest.data ? (
              <p className="flex items-center gap-1.5 text-sm text-ink-foreground/75">
                <Clock aria-hidden className="size-4" />
                Last run {ranAt.format(new Date(latest.data.ran_at))}
              </p>
            ) : (
              <p className="text-sm text-ink-foreground/75">
                Duplicates, orphans, zone conflicts and CCC pairs, each with its
                source.
              </p>
            )}
          </div>
        </div>
        <Button
          size="lg"
          disabled={run.isPending}
          onClick={() => run.mutate()}
          className="relative bg-white text-ink shadow-none hover:bg-white/90"
        >
          {run.isPending ? (
            <LoaderCircle aria-hidden className="animate-spin" />
          ) : (
            <Play aria-hidden />
          )}
          {run.isPending ? "Running checks…" : "Run checks"}
        </Button>
      </div>
      {run.isError && (
        <p
          role="alert"
          className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          Couldn&apos;t run checks: {run.error.message}
        </p>
      )}
    </div>
  );
}
