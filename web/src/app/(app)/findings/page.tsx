"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  LoaderCircle,
  MousePointerClick,
  Play,
  ShieldCheck,
} from "lucide-react";
import { cn } from "cn";
import { PageHeader, card } from "@/components/page-header";
import { QueryStates } from "@/components/query-states";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { toast } from "@/components/toast";
import { Button, buttonVariants } from "@/components/ui/button";
import { apiGet, apiPost, type Schemas } from "@/lib/api";
import {
  CHECK_ICONS,
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
      const found = result.counts.reduce((sum, c) => sum + c.found, 0);
      toast.success(
        "Checks finished",
        found === 0
          ? "No issues found across your confirmed plans."
          : `${found} ${found === 1 ? "finding" : "findings"} to review.`,
      );
      return queryClient.invalidateQueries({ queryKey: ["findings"] });
    },
    onError: (e) => toast.error("Couldn't run checks", e.message),
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Findings"
        description="PlanTrace compares your confirmed plans and lists anything that doesn't line up. Review each one: confirm it if it's a real problem, or reject it if it isn't."
      />
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
                Duplicates, orphans and zone conflicts, each with its source.
              </p>
            )}
          </div>
        </div>
        <div className="relative flex flex-col items-end gap-2">
          <Button
            size="lg"
            disabled={run.isPending}
            onClick={() => run.mutate()}
            className="bg-white text-ink shadow-none hover:bg-white/90"
          >
            {run.isPending ? (
              <LoaderCircle aria-hidden className="animate-spin" />
            ) : (
              <Play aria-hidden />
            )}
            {run.isPending ? "Running checks…" : "Run checks"}
          </Button>
        </div>
      </div>
      {run.isError && (
        <p
          role="alert"
          className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          Couldn&apos;t run checks: {run.error.message}
        </p>
      )}
      <QueryStates
        query={latest}
        what="the last run"
        isEmpty={(data) => data === null}
        empty={
          <p>
            Checks haven&apos;t been run yet. Press Run checks to compare the
            confirmed plans, or{" "}
            <Link
              href="/plans"
              className="font-bold text-primary underline underline-offset-4"
            >
              confirm a plan
            </Link>{" "}
            first.
          </p>
        }
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
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {CHECK_ORDER.map((check, i) => {
          const count = counts.find((c) => c.check === check);
          return (
            <StatCard
              key={check}
              label={CHECK_LABELS[check]}
              value={count?.found ?? 0}
              hint={`${count?.checked ?? 0} ${check === "duplicate" ? "pairs" : "PPAs"} checked`}
              icon={CHECK_ICONS[check]}
              tone={(count?.found ?? 0) > 0 ? "warning" : "success"}
              delay={i * 60}
            />
          );
        })}
        <StatCard
          label="Reviewed"
          value={
            findings.data
              ? `${findings.data.filter((f) => f.status !== "suggested").length}/${findings.data.length}`
              : undefined
          }
          hint="Confirmed or rejected by a planner"
          icon={ShieldCheck}
          tone="info"
          delay={CHECK_ORDER.length * 60}
        />
      </div>
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
                className="flex flex-col gap-4"
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
                  className={`${card} flex flex-col items-center gap-3 border-dashed p-12 text-center text-muted-foreground lg:sticky lg:top-28`}
                >
                  <span className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
                    <MousePointerClick aria-hidden className="size-7" />
                  </span>
                  <p className="font-heading font-bold text-foreground">
                    Pick a finding
                  </p>
                  <p className="max-w-sm">
                    Select a finding on the left to compare its PPAs side by
                    side, read why it was flagged and open the source pages.
                  </p>
                  <Link
                    href="/ccc"
                    className={buttonVariants({ variant: "outline" })}
                  >
                    Or open the CCC matrix
                  </Link>
                </div>
              )}
            </div>
          );
        }}
      </QueryStates>
    </div>
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
  const found = count?.found ?? findings.length;
  const Icon = CHECK_ICONS[check];

  return (
    <section
      aria-label={CHECK_LABELS[check]}
      className={`${card} flex flex-col gap-4 p-4 sm:p-5`}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
          <Icon aria-hidden className="size-5" />
        </span>
        <div className="flex flex-col gap-0.5">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            {CHECK_LABELS[check]}{" "}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-bold ring-1 ring-inset",
                found > 0
                  ? "bg-warning-soft text-warning ring-warning/25"
                  : "bg-success-soft text-success ring-success/20",
              )}
            >
              {found} found
            </span>
          </h2>
          <p className="text-sm text-muted-foreground">{CHECK_HELP[check]}</p>
        </div>
      </div>
      {findings.length === 0 ? (
        <p className="rounded-2xl bg-success-soft/60 px-3 py-2 text-sm text-success">
          No issues found for this check. {count?.checked ?? 0} {unit} checked.
        </p>
      ) : (
        [...groups].map(([name, items]) => (
          <section key={name} aria-label={name} className="flex flex-col gap-2">
            <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              {name}
            </h3>
            <ul className="flex flex-col gap-2">
              {items.map((f) => {
                const selected = f.id === selectedId;
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onSelect(f.id)}
                      className={cn(
                        "group flex w-full cursor-pointer flex-col items-start gap-2 rounded-2xl border p-3.5 text-left text-sm transition-all duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                        selected
                          ? "border-primary bg-primary text-primary-foreground shadow-[0_10px_24px_-10px_var(--primary)]"
                          : "bg-background hover:-translate-y-px hover:border-primary/40 hover:bg-secondary/50 hover:shadow-card",
                      )}
                    >
                      <span className="block font-bold">{itemTitle(f)}</span>
                      <StatusBadge
                        tone={STATUS_TONES[f.status]}
                        className={cn(
                          "text-xs",
                          selected && "bg-white text-ink ring-white/0",
                        )}
                      >
                        {STATUS_LABELS[f.status]}
                      </StatusBadge>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </section>
  );
}
