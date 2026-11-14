"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { PageHeader, card } from "@/components/page-header";
import { QueryStates } from "@/components/query-states";
import { buttonVariants } from "@/components/ui/button";
import { API_URL, apiGet, type Schemas } from "@/lib/api";

type Matrix = Schemas["CccMatrix"];
type Cell = Schemas["CccCell"];

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

export default function CccPage() {
  const matrix = useQuery({
    queryKey: ["ccc"],
    queryFn: () => apiGet<Matrix>("/ccc"),
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="CCC matrix"
        description="Every pair of projects that share a place, and how they affect each other. Read across a row and down a column to find a pair."
        actions={
          <a
            href={`${API_URL}/ccc/export`}
            download
            className={buttonVariants({ variant: "outline" })}
          >
            <Download aria-hidden />
            Export CCC matrix (.xlsx)
          </a>
        }
      />
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
      </dl>
      <QueryStates
        query={matrix}
        what="the CCC matrix"
        isEmpty={(data) => data.ppas.length === 0}
        empty={
          <p>
            Checks haven&apos;t been run yet, so the matrix is empty. Run checks
            from{" "}
            <Link href="/findings" className="underline underline-offset-4">
              Findings
            </Link>
            .
          </p>
        }
      >
        {(data) => <MatrixTable matrix={data} />}
      </QueryStates>
    </div>
  );
}

function MatrixTable({ matrix }: { matrix: Matrix }) {
  // A pair is listed once; show it in both triangles.
  const cells = new Map<string, Cell>();
  for (const c of matrix.cells) {
    cells.set(`${c.ppa_a}-${c.ppa_b}`, c);
    cells.set(`${c.ppa_b}-${c.ppa_a}`, c);
  }
  const label = (p: Matrix["ppas"][number]) =>
    `${p.plan_type}: ${p.title ?? "Untitled PPA"}`;

  return (
    <div className={`${card} w-full overflow-x-auto p-4`}>
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <td />
            {matrix.ppas.map((col) => (
              <th
                key={col.id}
                scope="col"
                className="w-12 max-w-12 border bg-muted/60 p-2 text-left align-bottom font-medium [writing-mode:vertical-rl]"
              >
                {label(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.ppas.map((row) => (
            <tr key={row.id}>
              <th
                scope="row"
                className="max-w-72 border bg-muted/60 p-2 text-left font-medium"
              >
                {label(row)}
              </th>
              {matrix.ppas.map((col) => {
                // Status handling (AC-33) and the cell detail (AC-34) come with S5.
                const cell = cells.get(`${row.id}-${col.id}`);
                return (
                  <td
                    key={col.id}
                    aria-label={
                      cell
                        ? `${cell.verdict}: ${label(row)} × ${label(col)}`
                        : undefined
                    }
                    title={
                      cell
                        ? `${cell.verdict}: ${label(row)} × ${label(col)}`
                        : undefined
                    }
                    className={`h-10 w-12 border text-center ${
                      cell
                        ? VERDICT_STYLE[cell.verdict]
                        : row.id === col.id
                          ? "bg-muted"
                          : ""
                    }`}
                  >
                    {cell && VERDICT_SHORT[cell.verdict]}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
