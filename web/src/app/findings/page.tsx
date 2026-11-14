"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QueryStates } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost, type Schemas } from "@/lib/api";
import { CHECK_LABELS, FindingDetail, STATUS_LABELS } from "./finding-detail";

type Finding = Schemas["Finding"];
type CheckRun = Schemas["CheckRunResult"];

// S4-17: the checks S4 shows, in order. S5 adds "ccc".
const CHECK_ORDER: Finding["check"][] = ["duplicate", "orphan", "zone"];

const NO_BARANGAY = "No barangay";

const ranAt = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** "Upland road → Farm roads" for an orphan's suggested parent, "A vs B" otherwise. */
function itemTitle(f: Finding): string {
  const a = f.ppa_a.title ?? "Untitled PPA";
  if (!f.ppa_b) return a;
  const b = f.ppa_b.title ?? "Untitled PPA";
  return f.check === "orphan" ? `${a} → ${b}` : `${a} vs ${b}`;
}

export default function FindingsPage() {
  const queryClient = useQueryClient();
  const latest = useQuery({
    queryKey: ["checks", "latest"],
    queryFn: () => apiGet<CheckRun | null>("/checks/latest"),
  });
  const run = useMutation({
    mutationFn: () => apiPost<CheckRun>("/checks/run"),
    onSuccess: (result) => {
      queryClient.setQueryData(["checks", "latest"], result);
      return queryClient.invalidateQueries({ queryKey: ["findings"] });
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Findings</h1>
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
      <QueryStates
        query={latest}
        what="the last run"
        isEmpty={(data) => data === null}
        empty="Checks haven't been run yet."
      >
        {(data) => data && <FindingsBody counts={data.counts} />}
      </QueryStates>
    </div>
  );
}

function FindingsBody({ counts }: { counts: CheckRun["counts"] }) {
  const findings = useQuery({
    queryKey: ["findings"],
    queryFn: () => apiGet<Finding[]>("/findings"),
  });
  // S4-21: without names the groups fall back to PSGC codes.
  const barangays = useQuery({
    queryKey: ["barangays"],
    queryFn: () => apiGet<Schemas["Barangay"][]>("/barangays"),
  });
  const barangayName = (code: string) =>
    barangays.data?.find((b) => b.psgc_code === code)?.name ?? code;
  const [selectedId, setSelectedId] = useState<number | null>(null);

  return (
    <QueryStates
      query={findings}
      what="findings"
      // Each check shows its own "No issues found" (S4-17).
      isEmpty={() => false}
      empty={null}
    >
      {(data) => {
        const selected = data.find((f) => f.id === selectedId);
        return (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <div
              role="region"
              aria-label="Findings list"
              className="flex flex-col gap-6"
            >
              {CHECK_ORDER.map((check) => (
                <CheckGroup
                  key={check}
                  check={check}
                  count={counts.find((c) => c.check === check)}
                  findings={data.filter((f) => f.check === check)}
                  barangayName={barangayName}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              ))}
            </div>
            {selected ? (
              <FindingDetail
                key={selected.id}
                finding={selected}
                barangayName={barangayName}
              />
            ) : (
              <p className="text-muted-foreground">
                Select a finding to compare its PPAs side by side.
              </p>
            )}
          </div>
        );
      }}
    </QueryStates>
  );
}

function CheckGroup({
  check,
  count,
  findings,
  barangayName,
  selectedId,
  onSelect,
}: {
  check: Finding["check"];
  count: CheckRun["counts"][number] | undefined;
  findings: Finding[];
  barangayName: (code: string) => string;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  // The api orders by check, barangay, id, so first-seen order keeps that order.
  const groups = new Map<string, Finding[]>();
  for (const f of findings) {
    const name = f.barangay === null ? NO_BARANGAY : barangayName(f.barangay);
    groups.set(name, [...(groups.get(name) ?? []), f]);
  }
  const unit = check === "duplicate" ? "pairs" : "PPAs";

  return (
    <section aria-label={CHECK_LABELS[check]} className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">
        {CHECK_LABELS[check]}{" "}
        <span className="text-sm font-normal text-muted-foreground">
          {count?.found ?? findings.length} found
        </span>
      </h2>
      {findings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No issues found for this check. {count?.checked ?? 0} {unit} checked.
        </p>
      ) : (
        [...groups].map(([name, items]) => (
          <section key={name} aria-label={name} className="flex flex-col gap-1">
            <h3 className="text-sm font-medium text-muted-foreground">
              {name}
            </h3>
            <ul className="flex flex-col gap-1">
              {items.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    aria-pressed={f.id === selectedId}
                    onClick={() => onSelect(f.id)}
                    className="w-full rounded-lg border p-2 text-left text-sm hover:bg-muted aria-pressed:border-primary aria-pressed:bg-muted"
                  >
                    <span className="block">{itemTitle(f)}</span>
                    <span className="block text-muted-foreground">
                      {STATUS_LABELS[f.status]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </section>
  );
}
