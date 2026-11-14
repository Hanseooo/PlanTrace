"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { QueryStates } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { apiGet, type Schemas } from "@/lib/api";

const PLAN_TYPES = [
  "CLUP",
  "CDP",
  "LDIP",
  "AIP",
  "LDRRMP",
  "LCCAP",
  "Other",
] as const satisfies readonly Schemas["Plan"]["type"][];

const field = "flex flex-col gap-1 text-sm";
const input = "h-8 rounded-lg border bg-background px-2";

export default function PlansPage() {
  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: () => apiGet<Schemas["Plan"][]>("/plans"),
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Plans</h1>

      {/* Display only until upload lands (S2): every control is disabled. */}
      <form aria-labelledby="upload-heading" className="rounded-lg border p-4">
        <h2 id="upload-heading" className="mb-1 font-medium">
          Upload a plan
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Upload isn&apos;t available yet.
        </p>
        <fieldset disabled className="flex flex-wrap items-end gap-3">
          <label className={field}>
            PDF file
            <input type="file" accept="application/pdf" className="text-sm" />
          </label>
          <label className={field}>
            Plan type
            <select className={input} defaultValue="">
              <option value="" disabled>
                Choose a type
              </option>
              {PLAN_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className={field}>
            Start year
            <input type="number" className={`${input} w-24`} />
          </label>
          <label className={field}>
            End year
            <input type="number" className={`${input} w-24`} />
          </label>
          <Button type="submit">Upload</Button>
        </fieldset>
      </form>

      <QueryStates
        query={plans}
        what="plans"
        isEmpty={(data) => data.length === 0}
        empty="No plans yet. Upload your first plan with the form above."
      >
        {(data) => (
          <table className="w-full text-left text-sm">
            <thead className="border-b text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">Title</th>
                <th className="py-2 pr-4 font-medium">Period</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((plan) => (
                <tr key={plan.id} className="border-b">
                  <td className="py-2 pr-4">{plan.type}</td>
                  <td className="py-2 pr-4">
                    <Link
                      href={`/plans/${plan.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {plan.title}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">
                    {plan.period_start}–{plan.period_end}
                  </td>
                  <td className="py-2">
                    {plan.status}
                    {plan.error && (
                      <span className="block text-destructive">
                        {plan.error}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </QueryStates>
    </div>
  );
}
