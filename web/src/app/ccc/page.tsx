"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { PageHeader, card } from "@/components/page-header";
import { QueryStates } from "@/components/query-states";
import { RunChecks, useLatestRun } from "@/components/run-checks";
import { SourcePanel } from "@/components/source-panel";
import { Button } from "@/components/ui/button";
import { API_URL, apiGet, type Schemas } from "@/lib/api";
import { SourceButton, STATUS_LABELS } from "../findings/finding-detail";

type Matrix = Schemas["CccMatrix"];
type Cell = Schemas["CccCell"];
type Ppa = Matrix["ppas"][number];

// Colour per verdict; the letter stays, so colour is never the only cue.
const VERDICT_STYLE: Record<Cell["verdict"], string> = {
  Conflict: "bg-destructive/15 font-bold text-destructive",
  Compatible: "bg-secondary text-secondary-foreground",
  Complementary: "bg-success-soft text-success",
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
  // Revoking in the same task can cancel the download in Firefox and Safari.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function CccPage() {
  const latest = useLatestRun();
  const exporting = useMutation({ mutationFn: downloadExport });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="CCC matrix"
        description="Every pair of projects from different plans that share a barangay or sector, and how they affect each other. Read across a row and down a column to find a pair."
        actions={
          <Button
            variant="outline"
            disabled={exporting.isPending}
            onClick={() => exporting.mutate()}
          >
            <Download aria-hidden />
            {exporting.isPending ? "Exporting…" : "Export CCC matrix (.xlsx)"}
          </Button>
        }
      />
      {exporting.isError && (
        <p role="alert" className="text-sm text-destructive">
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
        <p>
          No confirmed PPAs to compare. Confirm a plan on{" "}
          <Link href="/plans" className="underline underline-offset-4">
            Plans
          </Link>
          .
        </p>
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

  function close() {
    open?.opener.focus();
    setOpen(null);
    setSource(null);
  }

  return (
    <div
      className="flex flex-col gap-3"
      onKeyDown={(e) => {
        // The source panel stops its own Escape, so this runs once it is closed.
        if (e.key === "Escape" && open) close();
      }}
    >
      <dl
        aria-label="What the letters mean"
        className={`${card} flex flex-wrap gap-x-6 gap-y-2 p-4 text-sm`}
      >
        {(Object.keys(VERDICT_SHORT) as Cell["verdict"][]).map((v) => (
          <div key={v} className="flex items-center gap-2">
            <dt
              className={`flex h-7 w-9 items-center justify-center rounded border ${VERDICT_STYLE[v]}`}
            >
              {VERDICT_SHORT[v]}
            </dt>
            <dd>
              <span className="font-bold">{v}</span>: {VERDICT_HELP[v]}
            </dd>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <dt className="h-7 w-9 rounded border border-dashed border-foreground" />
          <dd>
            <span className="font-bold">Dashed border</span>: AI suggestion, not
            yet reviewed
          </dd>
        </div>
      </dl>
      <div className="flex flex-col items-start gap-4 lg:flex-row">
        <div
          className={`${card} max-w-full min-w-0 flex-1 overflow-x-auto p-4`}
        >
          <table className="border-collapse text-xs">
            <thead>
              <tr>
                <td className="sticky left-0 bg-card" />
                {matrix.ppas.map((col) => (
                  <th
                    key={col.id}
                    scope="col"
                    aria-label={ppaLabel(col)}
                    title={ppaLabel(col)}
                    className="w-10 border p-1 align-bottom font-medium"
                  >
                    <span className="block max-h-40 overflow-hidden text-ellipsis whitespace-nowrap [writing-mode:vertical-rl]">
                      {ppaLabel(col)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.ppas.map((row) => (
                <tr key={row.id}>
                  <th
                    scope="row"
                    title={ppaLabel(row)}
                    className="sticky left-0 z-10 w-64 max-w-64 truncate border bg-card p-1 text-left font-medium"
                  >
                    {ppaLabel(row)}
                  </th>
                  {matrix.ppas.map((col) => {
                    if (row.id === col.id) {
                      return (
                        <td key={col.id} className="h-8 border bg-muted" />
                      );
                    }
                    const cell = cells.get(`${row.id}-${col.id}`);
                    return (
                      <td
                        key={col.id}
                        className="h-8 w-10 border p-0 text-center"
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
                            className={`h-full w-full hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring aria-pressed:ring-2 aria-pressed:ring-primary ${VERDICT_STYLE[cell.verdict]} ${cell.status === "suggested" ? "border border-dashed border-foreground" : ""}`}
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
      className="flex w-full flex-col gap-3 rounded-lg border p-4 text-sm lg:w-96 lg:shrink-0"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-semibold">{cell.verdict}</h2>
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      <p className="text-muted-foreground">{STATUS_LABELS[cell.status]}</p>
      <ul className="flex flex-col gap-1">
        <li>{a ? ppaLabel(a) : "Unknown PPA"}</li>
        <li>{b ? ppaLabel(b) : "Unknown PPA"}</li>
      </ul>
      <p>{cell.reason}</p>
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
