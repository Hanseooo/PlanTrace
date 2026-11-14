"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Lightbulb, LoaderCircle, X } from "lucide-react";
import { cn } from "cn";
import { PageHeader, card } from "@/components/page-header";
import { QueryStates } from "@/components/query-states";
import { RunChecks, useLatestRun } from "@/components/run-checks";
import { SourcePanel } from "@/components/source-panel";
import { StatusBadge } from "@/components/status-badge";
import { toast } from "@/components/toast";
import { Button, buttonVariants } from "@/components/ui/button";
import { API_URL, apiGet, type Schemas } from "@/lib/api";
import {
  SourceButton,
  STATUS_LABELS,
  STATUS_TONES,
} from "../findings/finding-detail";

type Matrix = Schemas["CccMatrix"];
type Cell = Schemas["CccCell"];
type Ppa = Matrix["ppas"][number];

// Colour per verdict; the letter stays, so colour is never the only cue.
const VERDICT_STYLE: Record<Cell["verdict"], string> = {
  Conflict: "bg-destructive/12 font-extrabold text-destructive",
  Compatible: "bg-secondary font-bold text-secondary-foreground",
  Complementary: "bg-success-soft font-bold text-success",
};

const VERDICT_HELP: Record<Cell["verdict"], string> = {
  Conflict: "the two projects work against each other",
  Compatible: "the two projects can go ahead side by side",
  Complementary: "the two projects help each other",
};

// AC-33 cell labels.
const VERDICT_SHORT: Record<Cell["verdict"], string> = {
  Conflict: "C",
  Compatible: "Cm",
  Complementary: "Cp",
};

/** S5-11: "<plan type> <code>: <title>". */
function ppaLabel(p: Ppa): string {
  const code = p.code ? ` ${p.code}` : "";
  return `${p.plan_type}${code}: ${p.title ?? "Untitled PPA"}`;
}

/** S5-13: fetch the workbook and save it; a link can't show pending or error. */
async function downloadExport() {
  if (!API_URL) throw new Error("NEXT_PUBLIC_API_URL is not set.");
  let res: Response;
  try {
    res = await fetch(`${API_URL}/ccc/export`);
  } catch {
    throw new Error("Can't reach the PlanTrace API. Check that it is running.");
  }
  if (!res.ok) throw new Error(`The PlanTrace API answered ${res.status}.`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = "ccc_export.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

export default function CccPage() {
  const latest = useLatestRun();
  const exporting = useMutation({
    mutationFn: downloadExport,
    onSuccess: () =>
      toast.success("Export ready", "The matrix was saved as ccc_export.xlsx."),
    onError: (e) => toast.error("Couldn't export", e.message),
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="CCC matrix"
        description="Every pair of projects that share a place, and how they affect each other. Read across a row and down a column to find a pair, then click its letter for the reason."
        actions={
          <Button
            size="lg"
            disabled={exporting.isPending}
            onClick={() => exporting.mutate()}
          >
            {exporting.isPending ? (
              <LoaderCircle aria-hidden className="animate-spin" />
            ) : (
              <Download aria-hidden />
            )}
            {exporting.isPending ? "Exporting…" : "Export CCC matrix (.xlsx)"}
          </Button>
        }
      />
      {exporting.isError && (
        <p
          role="alert"
          className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          Couldn&apos;t export: {exporting.error.message}
        </p>
      )}
      <RunChecks />
      <QueryStates
        query={latest}
        what="the last run"
        isEmpty={(data) => data === null}
        empty="Checks haven't been run yet."
      >
        {() => <MatrixSection />}
      </QueryStates>
    </div>
  );
}

function MatrixSection() {
  const matrix = useQuery({
    queryKey: ["ccc"],
    queryFn: () => apiGet<Matrix>("/ccc"),
  });
  return (
    <QueryStates
      query={matrix}
      what="the CCC matrix"
      isEmpty={(data) => data.ppas.length === 0}
      empty={
        <div className="flex flex-col items-center gap-3">
          <p>No confirmed PPAs to compare. Confirm a plan first.</p>
          <Link href="/plans" className={buttonVariants()}>
            Go to the plans list
          </Link>
        </div>
      }
    >
      {(data) => <MatrixGrid matrix={data} />}
    </QueryStates>
  );
}

function MatrixGrid({ matrix }: { matrix: Matrix }) {
  const [open, setOpen] = useState<{
    cell: Cell;
    opener: HTMLElement;
  } | null>(null);
  const [source, setSource] = useState<{
    pageId: number;
    opener: HTMLElement;
  } | null>(null);

  // A pair is listed once; show it in both triangles. Rejected cells stay blank (AC-33).
  const cells = new Map<string, Cell>();
  for (const c of matrix.cells) {
    if (c.status === "rejected") continue;
    cells.set(`${c.ppa_a}-${c.ppa_b}`, c);
    cells.set(`${c.ppa_b}-${c.ppa_a}`, c);
  }
  const byId = new Map(matrix.ppas.map((p) => [p.id, p]));
  const conflicts = matrix.cells.filter(
    (c) => c.verdict === "Conflict" && c.status !== "rejected",
  ).length;

  function close() {
    open?.opener.focus();
    setOpen(null);
    setSource(null);
  }

  return (
    <div
      className="flex flex-col gap-4"
      onKeyDown={(e) => {
        // The source panel stops its own Escape, so this runs once it is closed.
        if (e.key === "Escape" && open) close();
      }}
    >
      <dl
        aria-label="What the letters mean"
        className={`${card} flex animate-fade-up flex-wrap gap-x-8 gap-y-3 p-5 text-sm`}
      >
        {(Object.keys(VERDICT_SHORT) as Cell["verdict"][]).map((v) => (
          <div key={v} className="flex items-center gap-3">
            <dt
              className={`flex h-9 w-11 items-center justify-center rounded-xl font-heading ${VERDICT_STYLE[v]}`}
            >
              {VERDICT_SHORT[v]}
            </dt>
            <dd>
              <span className="font-bold">{v}</span>
              <span className="block text-muted-foreground">
                {VERDICT_HELP[v]}
              </span>
            </dd>
          </div>
        ))}
        <div className="flex items-center gap-3">
          <dt className="h-9 w-11 rounded-xl border-2 border-dashed border-foreground/60" />
          <dd>
            <span className="font-bold">Dashed border</span>
            <span className="block text-muted-foreground">
              AI suggestion, not yet reviewed
            </span>
          </dd>
        </div>
      </dl>
      <div className="flex flex-col items-start gap-4 lg:flex-row">
        <div
          className={`${card} flex max-w-full min-w-0 flex-1 flex-col gap-3 p-4 sm:p-5`}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-heading text-lg font-bold">
              {matrix.ppas.length} PPAs · {matrix.cells.length} pairs compared
            </p>
            <p className="text-sm text-muted-foreground">
              {conflicts} {conflicts === 1 ? "conflict" : "conflicts"} · blank
              means the pair wasn&apos;t a candidate
            </p>
          </div>
          <div className="max-w-full overflow-x-auto rounded-2xl border">
            <table className="border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  <td className="sticky left-0 z-10 border-r border-b bg-card" />
                  {matrix.ppas.map((col) => (
                    <th
                      key={col.id}
                      scope="col"
                      aria-label={ppaLabel(col)}
                      title={ppaLabel(col)}
                      className="w-11 border-r border-b bg-muted/50 p-1.5 align-bottom font-bold last:border-r-0"
                    >
                      <span className="block max-h-44 overflow-hidden text-ellipsis whitespace-nowrap [writing-mode:vertical-rl]">
                        {ppaLabel(col)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.ppas.map((row) => (
                  <tr key={row.id} className="group">
                    <th
                      scope="row"
                      title={ppaLabel(row)}
                      className="sticky left-0 z-10 w-64 max-w-64 truncate border-r border-b bg-card px-2.5 py-1.5 text-left font-bold group-hover:bg-secondary"
                    >
                      {ppaLabel(row)}
                    </th>
                    {matrix.ppas.map((col) => {
                      if (row.id === col.id) {
                        return (
                          <td
                            key={col.id}
                            className="h-10 border-r border-b bg-muted last:border-r-0"
                          />
                        );
                      }
                      const cell = cells.get(`${row.id}-${col.id}`);
                      return (
                        <td
                          key={col.id}
                          className="h-10 w-11 border-r border-b p-1 text-center last:border-r-0"
                        >
                          {cell && (
                            <button
                              type="button"
                              aria-label={`${cell.verdict}${cell.status === "suggested" ? ", AI suggestion" : ""}: ${ppaLabel(row)} × ${ppaLabel(col)}`}
                              aria-pressed={open?.cell === cell}
                              onClick={(e) => {
                                setSource(null);
                                setOpen({ cell, opener: e.currentTarget });
                              }}
                              className={cn(
                                "flex size-8 cursor-pointer items-center justify-center rounded-lg font-heading transition-transform duration-150 outline-none hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:ring-3 aria-pressed:ring-primary",
                                VERDICT_STYLE[cell.verdict],
                                cell.status === "suggested" &&
                                  "border-2 border-dashed border-foreground/60",
                              )}
                            >
                              {VERDICT_SHORT[cell.verdict]}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {open && (
          <CellDetail
            key={`${open.cell.ppa_a}-${open.cell.ppa_b}`}
            cell={open.cell}
            a={byId.get(open.cell.ppa_a)}
            b={byId.get(open.cell.ppa_b)}
            onClose={close}
            onOpenSource={(pageId, opener) => setSource({ pageId, opener })}
          />
        )}
        {open && source && (
          <SourcePanel
            pageId={source.pageId}
            returnFocusTo={source.opener}
            onClose={() => setSource(null)}
          />
        )}
      </div>
    </div>
  );
}

/** S5-12: a cell's labels, verdict, reason and sources. Read-only. */
function CellDetail({
  cell,
  a,
  b,
  onClose,
  onOpenSource,
}: {
  cell: Cell;
  a: Ppa | undefined;
  b: Ppa | undefined;
  onClose: () => void;
  onOpenSource: (pageId: number, opener: HTMLElement) => void;
}) {
  return (
    <section
      aria-label="Cell detail"
      className={`${card} flex w-full animate-fade-up flex-col gap-4 p-5 text-sm shadow-lift lg:sticky lg:top-28 lg:w-96 lg:shrink-0`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-10 w-12 items-center justify-center rounded-xl font-heading text-base",
              VERDICT_STYLE[cell.verdict],
            )}
          >
            {VERDICT_SHORT[cell.verdict]}
          </span>
          <h2 className="text-xl font-bold">{cell.verdict}</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={onClose}
        >
          <X aria-hidden />
          Close
        </Button>
      </div>
      <StatusBadge tone={STATUS_TONES[cell.status]} className="self-start">
        {STATUS_LABELS[cell.status]}
      </StatusBadge>
      <ul className="flex flex-col gap-2">
        {[a, b].map((p, i) => (
          <li
            key={p?.id ?? i}
            className="rounded-2xl border bg-muted/40 px-3 py-2 font-bold"
          >
            {p ? ppaLabel(p) : "Unknown PPA"}
          </li>
        ))}
      </ul>
      <div className="flex gap-3 rounded-2xl border border-primary/20 bg-secondary/60 p-4">
        <Lightbulb
          aria-hidden
          className="mt-0.5 size-5 shrink-0 text-primary"
        />
        <div className="flex flex-col gap-0.5">
          <span className="font-bold">Why</span>
          <p>{cell.reason}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">Sources</span>
        {cell.page_ids.length === 0
          ? "No source page"
          : cell.page_ids.map((pageId) => (
              <SourceButton
                key={pageId}
                pageId={pageId}
                onOpen={onOpenSource}
              />
            ))}
      </div>
    </section>
  );
}
