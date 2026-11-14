"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QueryStates } from "@/components/query-states";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  ApiError,
  apiGet,
  apiPostForm,
  pesos,
  years,
  type Schemas,
} from "@/lib/api";
import {
  FILE_RULE,
  POLL_MS,
  STATUS_LABELS,
  isUploadablePdf,
  keepFile,
  keptFile,
} from "@/lib/plan-upload";

type Plan = Schemas["Plan"];

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

const isNotFound = (e: unknown) => e instanceof ApiError && e.status === 404;

export default function PlanPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const plan = useQuery({
    queryKey: ["plans", id],
    queryFn: () => apiGet<Plan>(`/plans/${id}`),
    // S2-05: poll while extracting. A failed poll keeps the last data, so polling
    // resumes on the next interval (S2-09).
    refetchInterval: (q) =>
      q.state.data?.status === "extracting" ? POLL_MS : false,
    retry: (count, error) => !isNotFound(error) && count < 1,
  });
  const status = plan.data?.status;

  // The status changed (e.g. extracting → ready): refresh the list's copy too.
  const lastStatus = useRef(status);
  useEffect(() => {
    if (lastStatus.current && status && lastStatus.current !== status) {
      void queryClient.invalidateQueries({ queryKey: ["plans"], exact: true });
      void queryClient.invalidateQueries({ queryKey: ["plans", id, "ppas"] });
    }
    lastStatus.current = status;
  }, [status, id, queryClient]);

  return (
    <div className="flex flex-col items-start gap-4">
      <Link href="/plans" className={buttonVariants({ variant: "outline" })}>
        Back to plans
      </Link>
      <h1 className="text-2xl font-semibold">PPA table</h1>
      {isNotFound(plan.error) ? (
        <p role="alert">Plan not found.</p>
      ) : (
        <QueryStates
          query={plan}
          what="the plan"
          isEmpty={() => false}
          empty={null}
        >
          {(data) => <PlanBody plan={data} />}
        </QueryStates>
      )}
    </div>
  );
}

function PlanBody({ plan }: { plan: Plan }) {
  return (
    <div className="flex w-full flex-col items-start gap-4">
      <p className="text-muted-foreground">{plan.title}</p>
      {plan.status === "extracting" && (
        <p role="status">
          Extracting PPAs. This takes about a minute. You can leave this page.
        </p>
      )}
      {plan.status === "failed" && <FailedPlan plan={plan} />}
      {plan.status === "ready" && (
        <p role="status" className="font-medium">
          {STATUS_LABELS.ready}
        </p>
      )}
      {(plan.status === "ready" || plan.status === "confirmed") && (
        <PpaTable planId={plan.id} />
      )}
    </div>
  );
}

/** S2-05, S2-07: why it failed, and Retry with the kept file or a new pick. */
function FailedPlan({ plan }: { plan: Plan }) {
  const queryClient = useQueryClient();
  const [fileError, setFileError] = useState<string | null>(null);
  const file = keptFile(plan.id);

  const retry = useMutation({
    mutationFn: (pdf: File) => {
      const form = new FormData();
      form.set("file", pdf);
      return apiPostForm<Plan>(`/plans/${plan.id}/retry`, form);
    },
    onSuccess: (next, pdf) => {
      keepFile(plan.id, pdf);
      // Back to extracting, so the page's poll starts again.
      queryClient.setQueryData(["plans", String(plan.id)], next);
    },
  });

  function chooseFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    if (!isUploadablePdf(picked)) {
      e.target.value = "";
      setFileError(FILE_RULE);
      return;
    }
    setFileError(null);
    retry.mutate(picked);
  }

  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2 rounded-lg border border-destructive/40 p-4"
    >
      <p className="font-medium">{STATUS_LABELS.failed}</p>
      {plan.error && <p>{plan.error}</p>}
      {file ? (
        <Button
          variant="outline"
          disabled={retry.isPending}
          onClick={() => retry.mutate(file)}
        >
          {retry.isPending ? "Retrying…" : "Retry"}
        </Button>
      ) : (
        <label className="flex flex-col gap-1 text-sm">
          Choose the file again
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="text-sm"
            disabled={retry.isPending}
            onChange={chooseFile}
          />
        </label>
      )}
      {retry.isPending && !file && <p role="status">Retrying…</p>}
      {fileError && <p className="text-destructive">{fileError}</p>}
      {retry.isError && (
        <p className="text-destructive">
          Retry failed. {retry.error.message}
        </p>
      )}
    </div>
  );
}

function PpaTable({ planId }: { planId: number }) {
  const ppas = useQuery({
    queryKey: ["plans", String(planId), "ppas"],
    queryFn: () => apiGet<Schemas["Ppa"][]>(`/plans/${planId}/ppas`),
  });

  return (
    <QueryStates
      query={ppas}
      what="PPAs"
      isEmpty={(data) => data.length === 0}
      empty="No PPAs found. Add rows by hand."
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
  );
}
