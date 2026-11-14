"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { QueryStates } from "@/components/query-states";
import { buttonVariants } from "@/components/ui/button";
import { API_URL, apiGet, type Schemas } from "@/lib/api";

type Matrix = Schemas["CccMatrix"];
type Cell = Schemas["CccCell"];

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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-semibold">CCC matrix</h1>
        <a
          href={`${API_URL}/ccc/export`}
          download
          className={buttonVariants({ variant: "outline" })}
        >
          Export CCC matrix (.xlsx)
        </a>
      </div>
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
    <div className="w-full overflow-x-auto">
      <table className="border-collapse text-xs">
        <thead>
          <tr>
            <td />
            {matrix.ppas.map((col) => (
              <th
                key={col.id}
                scope="col"
                className="w-12 max-w-12 border p-1 align-bottom font-medium [writing-mode:vertical-rl]"
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
                className="max-w-64 border p-1 text-left font-medium"
              >
                {label(row)}
              </th>
              {matrix.ppas.map((col) => {
                const cell = cells.get(`${row.id}-${col.id}`);
                // AC-33: a rejected verdict shows blank.
                const shown = cell && cell.status !== "rejected" ? cell : null;
                return (
                  <td
                    key={col.id}
                    aria-label={
                      shown
                        ? `${shown.verdict}: ${label(row)} × ${label(col)}`
                        : undefined
                    }
                    title={shown?.reason}
                    className="h-8 w-12 border text-center"
                  >
                    {shown && VERDICT_SHORT[shown.verdict]}
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
