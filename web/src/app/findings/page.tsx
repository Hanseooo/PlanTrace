"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QueryStates } from "@/components/query-states";
import { RunChecks, useLatestRun } from "@/components/run-checks";
import { apiGet, type Schemas } from "@/lib/api";
import { CHECK_LABELS, FindingDetail, STATUS_LABELS } from "./finding-detail";

type Finding = Schemas["Finding"];
type CheckRun = Schemas["CheckRunResult"];

// S4-17, S5-15: the checks shown, in order.
const CHECK_ORDER: Finding["check"][] = ["duplicate", "orphan", "ccc", "zone"];

const NO_BARANGAY = "No barangay";

/** "Upland road → Farm roads" for an orphan's suggested parent, "A vs B" otherwise. */
function itemTitle(f: Finding): string {
  const a = f.ppa_a.title ?? "Untitled PPA";
  if (!f.ppa_b) return a;
  const b = f.ppa_b.title ?? "Untitled PPA";
  return f.check === "orphan" ? `${a} → ${b}` : `${a} vs ${b}`;
}

export default function FindingsPage() {
  const latest = useLatestRun();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Findings</h1>
      <RunChecks />
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
  const unit = check === "duplicate" || check === "ccc" ? "pairs" : "PPAs";

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
                      {f.check === "ccc" && `${f.verdict}, `}
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
