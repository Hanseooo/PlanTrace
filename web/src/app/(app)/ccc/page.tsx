"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Lightbulb, ListChecks } from "lucide-react";
import { cn } from "cn";
import { PageHeader, card } from "@/components/page-header";
import { QueryStates } from "@/components/query-states";
import { usePage } from "@/components/source-panel";
import { StatusBadge } from "@/components/status-badge";
import { toast } from "@/components/toast";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { API_URL, apiGet, type Schemas } from "@/lib/api";
import { STATUS_LABELS, STATUS_TONES } from "../findings/finding-detail";

type Matrix = Schemas["CccMatrix"];
type Cell = Schemas["CccCell"];
type MatrixPpa = Matrix["ppas"][number];

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

const label = (p: MatrixPpa) => `${p.plan_type}: ${p.title ?? "Untitled PPA"}`;

export default function CccPage() {
  const matrix = useQuery({
    queryKey: ["ccc"],
    queryFn: () => apiGet<Matrix>("/ccc"),
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="CCC matrix"
        description="Every pair of projects that share a place, and how they affect each other. Read across a row and down a column to find a pair, and click a letter for the reason."
        actions={
          <a
            href={`${API_URL}/ccc/export`}
            download
            onClick={() =>
              toast.info(
                "Export started",
                "Your browser is downloading the matrix as an Excel file.",
              )
            }
            className={buttonVariants({ size: "lg" })}
          >
            <Download aria-hidden />
            Export CCC matrix (.xlsx)
          </a>
        }
      />
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
      </dl>
      <QueryStates
        query={matrix}
        what="the CCC matrix"
        isEmpty={(data) => data.ppas.length === 0}
        empty={
          <div className="flex flex-col items-center gap-3">
            <p>
              Checks haven&apos;t been run yet, so the matrix is empty. Run
              checks from Findings first.
            </p>
            <Link href="/findings" className={buttonVariants()}>
              <ListChecks aria-hidden />
              Go to findings
            </Link>
          </div>
        }
      >
        {(data) => <MatrixTable matrix={data} />}
      </QueryStates>
    </div>
  );
}

function MatrixTable({ matrix }: { matrix: Matrix }) {
  const [open, setOpen] = useState<{
    cell: Cell;
    row: MatrixPpa;
    col: MatrixPpa;
  } | null>(null);
  // A pair is listed once; show it in both triangles.
  const cells = new Map<string, Cell>();
  for (const c of matrix.cells) {
    cells.set(`${c.ppa_a}-${c.ppa_b}`, c);
    cells.set(`${c.ppa_b}-${c.ppa_a}`, c);
  }
  const conflicts = matrix.cells.filter((c) => c.verdict === "Conflict").length;

  return (
    <div className={`${card} flex w-full animate-fade-up flex-col gap-4 p-4 sm:p-6`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-heading text-lg font-bold">
          {matrix.ppas.length} PPAs · {matrix.cells.length} pairs compared
        </p>
        <p className="text-sm text-muted-foreground">
          {conflicts} {conflicts === 1 ? "conflict" : "conflicts"} · blank
          means the pair wasn&apos;t a candidate
        </p>
      </div>
      <div className="w-full overflow-x-auto rounded-2xl border">
        <table className="border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <td className="sticky left-0 z-10 border-r border-b bg-card" />
              {matrix.ppas.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  className="h-56 w-12 max-w-12 border-r border-b bg-muted/50 p-2 text-left align-bottom text-xs font-bold [writing-mode:vertical-rl] last:border-r-0"
                >
                  {label(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.ppas.map((row) => (
              <tr key={row.id} className="group">
                <th
                  scope="row"
                  className="sticky left-0 z-10 max-w-72 min-w-56 border-r border-b bg-card p-2.5 text-left text-xs font-bold group-hover:bg-secondary"
                >
                  {label(row)}
                </th>
                {matrix.ppas.map((col) => {
                  // Status handling (AC-33) comes with S5.
                  const cell = cells.get(`${row.id}-${col.id}`);
                  const name = cell
                    ? `${cell.verdict}: ${label(row)} × ${label(col)}`
                    : undefined;
                  return (
                    <td
                      key={col.id}
                      aria-label={name}
                      title={name}
                      className={cn(
                        "h-12 w-12 border-r border-b p-1 text-center last:border-r-0",
                        !cell && row.id === col.id && "bg-muted",
                      )}
                    >
                      {cell && (
                        <button
                          type="button"
                          aria-label={`Open ${name}`}
                          onClick={() => setOpen({ cell, row, col })}
                          className={cn(
                            "flex size-10 cursor-pointer items-center justify-center rounded-xl font-heading transition-transform duration-150 outline-none hover:scale-110 hover:shadow-card focus-visible:ring-3 focus-visible:ring-ring/50",
                            VERDICT_STYLE[cell.verdict],
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
      <CellDialog pair={open} onClose={() => setOpen(null)} />
    </div>
  );
}

/** AC-34: a cell's verdict, reason and source pages, in a modal. */
function CellDialog({
  pair,
  onClose,
}: {
  pair: { cell: Cell; row: MatrixPpa; col: MatrixPpa } | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={pair !== null} onOpenChange={(next) => !next && onClose()}>
      {pair && (
        <DialogContent>
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "flex h-9 w-11 items-center justify-center rounded-xl font-heading",
                  VERDICT_STYLE[pair.cell.verdict],
                )}
              >
                {VERDICT_SHORT[pair.cell.verdict]}
              </span>
              <StatusBadge tone={STATUS_TONES[pair.cell.status]}>
                {STATUS_LABELS[pair.cell.status]}
              </StatusBadge>
            </div>
            <DialogTitle>{pair.cell.verdict}</DialogTitle>
            <DialogDescription>
              In this pair, {VERDICT_HELP[pair.cell.verdict]}.
            </DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-2">
            {[pair.row, pair.col].map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-2xl border bg-muted/40 p-3"
              >
                <span className="rounded-lg bg-secondary px-2 py-1 font-heading text-xs font-extrabold text-secondary-foreground">
                  {p.plan_type}
                </span>
                <span className="font-bold">{p.title ?? "Untitled PPA"}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-3 rounded-2xl border border-primary/20 bg-secondary/60 p-4">
            <Lightbulb aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-bold">Why</p>
              <p>{pair.cell.reason}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Sources</span>
            {pair.cell.page_ids.length === 0
              ? "No source page"
              : pair.cell.page_ids.map((id) => <PageChip key={id} pageId={id} />)}
          </div>
          <DialogFooter>
            <DialogClose render={<Button />}>Done</DialogClose>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}

function PageChip({ pageId }: { pageId: number }) {
  const page = usePage(pageId);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground tabular-nums">
      <FileText aria-hidden className="size-3.5" />
      {page.isError
        ? "page unavailable"
        : page.data
          ? `p. ${page.data.page_no}`
          : "p. …"}
    </span>
  );
}
