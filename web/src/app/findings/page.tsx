"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QueryStates } from "@/components/query-states";
import { apiGet, pesos, years, type Schemas } from "@/lib/api";

type Finding = Schemas["Finding"];
type FindingPpa = Schemas["FindingPpa"];

const CHECK_LABELS: Record<Finding["check"], string> = {
  duplicate: "Duplicate",
  orphan: "Orphan",
  ccc: "CCC",
  zone: "Zone",
};

export default function FindingsPage() {
  const findings = useQuery({
    queryKey: ["findings"],
    queryFn: () => apiGet<Finding[]>("/findings"),
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Findings</h1>
      <QueryStates
        query={findings}
        what="findings"
        isEmpty={(data) => data.length === 0}
        empty="Checks haven't been run yet. Confirm your plans, then run checks."
      >
        {(data) => {
          const selected = data.find((f) => f.id === selectedId);
          return (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <ul aria-label="Findings" className="flex flex-col gap-1">
                {data.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      aria-pressed={f.id === selectedId}
                      onClick={() => setSelectedId(f.id)}
                      className="w-full rounded-lg border p-2 text-left text-sm hover:bg-muted aria-pressed:border-primary aria-pressed:bg-muted"
                    >
                      <span className="font-medium">
                        {CHECK_LABELS[f.check]}
                        {f.verdict && ` · ${f.verdict}`}
                      </span>
                      <span className="block">
                        {f.ppa_a.title ?? "Untitled PPA"}
                        {f.ppa_b && ` vs ${f.ppa_b.title ?? "Untitled PPA"}`}
                      </span>
                      <span className="block text-muted-foreground">
                        {f.status}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {selected ? (
                <FindingDetail finding={selected} />
              ) : (
                <p className="text-muted-foreground">
                  Select a finding to compare its PPAs side by side.
                </p>
              )}
            </div>
          );
        }}
      </QueryStates>
    </div>
  );
}

function FindingDetail({ finding }: { finding: Finding }) {
  return (
    <section aria-label="Finding detail" className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">
        {CHECK_LABELS[finding.check]} finding
        {finding.verdict && `: ${finding.verdict}`}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <PpaCard ppa={finding.ppa_a} />
        {finding.ppa_b ? (
          <PpaCard ppa={finding.ppa_b} />
        ) : (
          <p className="text-muted-foreground">
            No second PPA: this finding is against the zoning map.
          </p>
        )}
      </div>
      <p>{finding.reason}</p>
      <p className="text-sm text-muted-foreground">
        Source pages: {finding.page_ids.join(", ") || "none"}
      </p>
    </section>
  );
}

function PpaCard({ ppa }: { ppa: FindingPpa }) {
  const rows: [string, string][] = [
    ["Plan", ppa.plan_type],
    ["Title", ppa.title ?? "—"],
    ["Office", ppa.office ?? "—"],
    ["Barangays", ppa.barangays.join(", ") || "—"],
    ["Cost", ppa.cost === null ? "—" : pesos.format(ppa.cost)],
    ["Years", years(ppa.year_start, ppa.year_end)],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border p-3 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
