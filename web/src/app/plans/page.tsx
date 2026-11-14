"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, ListChecks, SquarePen, Upload } from "lucide-react";
import { PageHeader, card } from "@/components/page-header";
import { QueryStates } from "@/components/query-states";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { apiGet, apiPostForm, type Schemas } from "@/lib/api";
import {
  FILE_RULE,
  POLL_MS,
  STATUS_LABELS,
  STATUS_TONES,
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

const field = "flex flex-col gap-1.5 text-sm font-medium";
const hint = "text-xs font-normal text-muted-foreground";
const input =
  "h-10 rounded-lg border border-input bg-background px-3 text-base font-normal outline-none focus-visible:ring-3 focus-visible:ring-ring/40";

// The whole job in three steps, so a first-time user knows where they are.
const STEPS = [
  {
    icon: FileUp,
    title: "1. Upload a plan",
    body: "Add a plan as a PDF. PlanTrace reads it and lists its programs, projects and activities (PPAs).",
  },
  {
    icon: SquarePen,
    title: "2. Check and confirm",
    body: "Open the plan, fix anything read wrong, then press Confirm plan.",
  },
  {
    icon: ListChecks,
    title: "3. Review findings",
    body: "Go to Findings and press Run checks to spot repeated projects and projects that don't connect.",
  },
] as const;

export default function PlansPage() {
  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: () => apiGet<Schemas["Plan"][]>("/plans"),
    // S2-06: keep the list fresh while any plan is extracting.
    refetchInterval: (q) =>
      q.state.data?.some((p) => p.status === "extracting") ? POLL_MS : false,
  });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Plans"
        description="Every plan the city has added. Upload a new one, or open a plan to check its PPAs."
      />
      <ol
        aria-label="How PlanTrace works"
        className="grid gap-3 md:grid-cols-3"
      >
        {STEPS.map(({ icon: Icon, title, body }) => (
          <li key={title} className={`${card} flex gap-3 p-4`}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <Icon aria-hidden className="size-5" />
            </span>
            <div className="flex flex-col gap-0.5">
              <p className="font-bold">{title}</p>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          </li>
        ))}
      </ol>
      <UploadForm />
      <QueryStates
        query={plans}
        what="plans"
        isEmpty={(data) => data.length === 0}
        empty="No plans yet. Upload your first plan with the form above."
      >
        {(data) => (
          <div className={`${card} overflow-x-auto`}>
            <table className="w-full text-left">
              <thead className="border-b bg-muted/60 text-sm text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-bold">Type</th>
                  <th className="px-4 py-3 font-bold">Title</th>
                  <th className="px-4 py-3 font-bold">Period</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((plan) => (
                  <tr
                    key={plan.id}
                    className="border-b transition-colors last:border-b-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-secondary px-2 py-0.5 text-sm font-bold text-secondary-foreground">
                        {plan.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/plans/${plan.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {plan.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {plan.period_start}–{plan.period_end}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={STATUS_TONES[plan.status]}>
                        {STATUS_LABELS[plan.status]}
                      </StatusBadge>
                      {plan.error && (
                        <span className="mt-1 block text-sm text-destructive">
                          {plan.error}
                        </span>
                      )}
                    </td>
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
      className={`${card} p-5`}
      onSubmit={submit}
    >
      <h2
        id="upload-heading"
        className="flex items-center gap-2 text-xl font-bold"
      >
        <Upload aria-hidden className="size-5 text-primary" />
        Upload a plan
      </h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        Fill in all four fields. The Upload button turns on once they are all
        filled in.
      </p>
      <fieldset
        disabled={busy}
        className="flex flex-wrap items-start gap-x-5 gap-y-4"
      >
        <label className={field}>
          PDF file
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="text-sm font-normal file:mr-3 file:h-10 file:cursor-pointer file:rounded-lg file:border file:border-input file:bg-secondary file:px-3 file:font-medium file:text-secondary-foreground"
            onChange={chooseFile}
            aria-describedby="upload-file-hint upload-file-error"
          />
          <span id="upload-file-hint" className={hint}>
            {FILE_RULE}
          </span>
        </label>
        <label className={field}>
          Plan type
          <select
            className={input}
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-describedby="upload-type-hint"
          >
            <option value="" disabled>
              Choose a type
            </option>
            {PLAN_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <span id="upload-type-hint" className={hint}>
            For example CDP or AIP
          </span>
        </label>
        <label className={field}>
          Start year
          <input
            type="number"
            className={`${input} w-24`}
            value={start}
            onChange={(e) => setStart(e.target.value)}
            placeholder="2026"
            aria-describedby="upload-years-hint"
          />
        </label>
        <label className={field}>
          End year
          <input
            type="number"
            className={`${input} w-24`}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            placeholder="2030"
            aria-describedby="upload-years-hint"
          />
          <span id="upload-years-hint" className={hint}>
            The years the plan covers
          </span>
        </label>
        <Button type="submit" size="lg" disabled={!ready} className="mt-6">
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
