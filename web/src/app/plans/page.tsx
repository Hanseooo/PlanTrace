"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QueryStates } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { apiGet, apiPostForm, type Schemas } from "@/lib/api";
import {
  FILE_RULE,
  POLL_MS,
  STATUS_LABELS,
  isUploadablePdf,
  keepFile,
} from "@/lib/plan-upload";

type PlanType = Schemas["Plan"]["type"];

// Keyed by the generated union, so tsc fails if a plan type is missing.
const PLAN_TYPE_OPTIONS: Record<PlanType, true> = {
  CLUP: true,
  CDP: true,
  LDIP: true,
  AIP: true,
  LDRRMP: true,
  LCCAP: true,
  Other: true,
};
const PLAN_TYPES = Object.keys(PLAN_TYPE_OPTIONS);

const field = "flex flex-col gap-1 text-sm";
const input = "h-8 rounded-lg border bg-background px-2";

export default function PlansPage() {
  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: () => apiGet<Schemas["Plan"][]>("/plans"),
    // S2-06: keep the list fresh while any plan is extracting.
    refetchInterval: (q) =>
      q.state.data?.some((p) => p.status === "extracting") ? POLL_MS : false,
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Plans</h1>
      <UploadForm />
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
                    {STATUS_LABELS[plan.status]}
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

/** S2-01 to S2-04: the upload form. Values stay put on every error. */
function UploadForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [type, setType] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const upload = useMutation({
    mutationFn: (form: FormData) =>
      apiPostForm<Schemas["Plan"]>("/plans", form),
    onSuccess: (plan, form) => {
      keepFile(plan.id, form.get("file") as File);
      queryClient.setQueryData(["plans", String(plan.id)], plan);
      void queryClient.invalidateQueries({ queryKey: ["plans"], exact: true });
      router.push(`/plans/${plan.id}`);
    },
  });

  const startYear = Number.parseInt(start, 10);
  const endYear = Number.parseInt(end, 10);
  const ready =
    file !== null &&
    type !== "" &&
    Number.isInteger(startYear) &&
    Number.isInteger(endYear) &&
    startYear <= endYear;
  // After success the page is leaving; keep the form locked until it does.
  const busy = upload.isPending || upload.isSuccess;

  function chooseFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    if (picked && !isUploadablePdf(picked)) {
      e.target.value = "";
      setFile(null);
      setFileError(FILE_RULE);
      return;
    }
    setFile(picked);
    setFileError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    const form = new FormData();
    form.set("file", file);
    form.set("type", type);
    form.set("period_start", String(startYear));
    form.set("period_end", String(endYear));
    upload.mutate(form);
  }

  return (
    <form
      aria-labelledby="upload-heading"
      className="rounded-lg border p-4"
      onSubmit={submit}
    >
      <h2 id="upload-heading" className="mb-3 font-medium">
        Upload a plan
      </h2>
      <fieldset disabled={busy} className="flex flex-wrap items-end gap-3">
        <label className={field}>
          PDF file
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="text-sm"
            onChange={chooseFile}
            aria-describedby="upload-file-error"
          />
        </label>
        <label className={field}>
          Plan type
          <select
            className={input}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
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
          <input
            type="number"
            className={`${input} w-24`}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className={field}>
          End year
          <input
            type="number"
            className={`${input} w-24`}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <Button type="submit" disabled={!ready}>
          {busy ? "Uploading…" : "Upload"}
        </Button>
      </fieldset>
      <div id="upload-file-error" className="mt-2 text-sm">
        {fileError && (
          <p role="alert" className="text-destructive">
            {fileError}
          </p>
        )}
        {Number.isInteger(startYear) &&
          Number.isInteger(endYear) &&
          startYear > endYear && (
            <p className="text-muted-foreground">
              The start year must be no later than the end year.
            </p>
          )}
        {upload.isError && (
          <p role="alert" className="text-destructive">
            Upload failed. {upload.error.message}
          </p>
        )}
      </div>
    </form>
  );
}
