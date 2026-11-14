"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MousePointerClick, Play } from "lucide-react";
import { PageHeader, card } from "@/components/page-header";
import { QueryStates } from "@/components/query-states";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost, type Schemas } from "@/lib/api";
import {
  CHECK_LABELS,
  FindingDetail,
  STATUS_LABELS,
  STATUS_TONES,
} from "./finding-detail";

type Finding = Schemas["Finding"];
type CheckRun = Schemas["CheckRunResult"];

// S4-17: the checks S4 shows, in order. S5 adds "ccc".
const CHECK_ORDER: Finding["check"][] = ["duplicate", "orphan", "zone"];

const NO_BARANGAY = "No barangay";

// What each check looks for, in plain words.
const CHECK_HELP: Record<Finding["check"], string> = {
  duplicate:
    "The same project appears in two plans, so it may be funded twice.",
  orphan:
    "A project in the investment program that isn't linked to any bigger plan goal.",
  zone: "A project placed where the land use plan doesn't allow that kind of use.",
  ccc: "Two projects in the same place that may work against each other.",
};

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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Findings"
        description="PlanTrace compares your confirmed plans and lists anything that doesn't line up. Review each one: confirm it if it's a real problem, or reject it if it isn't."
      />
      <div className={`${card} flex flex-wrap items-center gap-4 p-4`}>
        <Button size="lg" disabled={run.isPending} onClick={() => run.mutate()}>
          <Play aria-hidden />
          {run.isPending ? "Running checks…" : "Run checks"}
        </Button>
        {latest.data && (
          <p className="text-muted-foreground">
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
              <div
                className={`${card} flex flex-col items-center gap-2 border-dashed p-10 text-center text-muted-foreground`}
              >
                <MousePointerClick aria-hidden className="size-8" />
                <p>Select a finding to compare its PPAs side by side.</p>
              </div>
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
    <section
      aria-label={CHECK_LABELS[check]}
      className={`${card} flex flex-col gap-3 p-4`}
    >
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          {CHECK_LABELS[check]}{" "}
          <span
            className={`rounded-full px-2 py-0.5 text-sm font-bold ${
              (count?.found ?? findings.length) > 0
                ? "bg-warning-soft text-warning"
                : "bg-success-soft text-success"
            }`}
          >
            {count?.found ?? findings.length} found
          </span>
        </h2>
        <p className="text-sm text-muted-foreground">{CHECK_HELP[check]}</p>
      </div>
      {findings.length === 0 ? (
        <p className="text-sm text-success">
          No issues found for this check. {count?.checked ?? 0} {unit} checked.
        </p>
      ) : (
        [...groups].map(([name, items]) => (
          <section key={name} aria-label={name} className="flex flex-col gap-1">
            <h3 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
              {name}
            </h3>
            <ul className="flex flex-col gap-1">
              {items.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    aria-pressed={f.id === selectedId}
                    onClick={() => onSelect(f.id)}
                    className="flex w-full cursor-pointer flex-col items-start gap-1.5 rounded-lg border bg-background p-3 text-left text-sm transition-colors outline-none hover:border-primary/40 hover:bg-secondary/50 focus-visible:ring-3 focus-visible:ring-ring/40 aria-pressed:border-primary aria-pressed:bg-secondary aria-pressed:ring-1 aria-pressed:ring-primary"
                  >
                    <span className="block font-medium">{itemTitle(f)}</span>
                    <StatusBadge
                      tone={STATUS_TONES[f.status]}
                      className="text-xs"
                    >
                      {STATUS_LABELS[f.status]}
                    </StatusBadge>
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
