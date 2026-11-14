"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
 * S4-16, S5-10: the Run checks button with its pending label, error and
 * "Last run". A run refetches the findings and the matrix.
 */
export function RunChecks() {
  const queryClient = useQueryClient();
  const latest = useLatestRun();
  const run = useMutation({
    mutationFn: () => apiPost<CheckRun>("/checks/run"),
    onSuccess: (result) => {
      queryClient.setQueryData(["checks", "latest"], result);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ["findings"] }),
        queryClient.invalidateQueries({ queryKey: ["ccc"] }),
      ]);
    },
  });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled={run.isPending} onClick={() => run.mutate()}>
        {run.isPending ? "Running checks…" : "Run checks"}
      </Button>
      {latest.data && (
        <p className="text-sm text-muted-foreground">
          Last run {ranAt.format(new Date(latest.data.ran_at))}
        </p>
      )}
      {run.isError && (
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t run checks: {run.error.message}
        </p>
      )}
    </div>
  );
}
