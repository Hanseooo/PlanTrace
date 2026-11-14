"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { QueryStates } from "@/components/query-states";
import { buttonVariants } from "@/components/ui/button";
import { apiGet, pesos, years, type Schemas } from "@/lib/api";

const COLUMNS = [
  "Code",
  "Title",
  "Office",
  "Sector",
  "Barangays",
  "Cost",
  "Years",
  "Status",
];

export default function PlanPpasPage() {
  const { id } = useParams<{ id: string }>();
  const ppas = useQuery({
    queryKey: ["plans", id, "ppas"],
    queryFn: () => apiGet<Schemas["Ppa"][]>(`/plans/${id}/ppas`),
  });

  return (
    <div className="flex flex-col items-start gap-4">
      <Link href="/plans" className={buttonVariants({ variant: "outline" })}>
        Back to plans
      </Link>
      <h1 className="text-2xl font-semibold">PPA table</h1>
      <QueryStates
        query={ppas}
        what="PPAs"
        isEmpty={(data) => data.length === 0}
        empty={
          <p>
            This plan has no PPAs yet.{" "}
            <Link href="/plans" className="underline underline-offset-4">
              Go back to plans
            </Link>{" "}
            and check its extraction status.
          </p>
        }
      >
        {(data) => (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-muted-foreground">
                <tr>
                  {COLUMNS.map((c) => (
                    <th key={c} className="py-2 pr-4 font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((ppa) => (
                  <tr key={ppa.id} className="border-b align-top">
                    <td className="py-2 pr-4">{ppa.code ?? "—"}</td>
                    <td className="py-2 pr-4">{ppa.title ?? "—"}</td>
                    <td className="py-2 pr-4">{ppa.office ?? "—"}</td>
                    <td className="py-2 pr-4">{ppa.sector ?? "—"}</td>
                    <td className="py-2 pr-4">
                      {ppa.barangays.join(", ") || "—"}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      {ppa.cost === null ? "—" : pesos.format(ppa.cost)}
                    </td>
                    <td className="py-2 pr-4">
                      {years(ppa.year_start, ppa.year_end)}
                    </td>
                    <td className="py-2">{ppa.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryStates>
    </div>
  );
}
