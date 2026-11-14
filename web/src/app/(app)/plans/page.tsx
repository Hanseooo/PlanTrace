"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  CircleCheckBig,
  FileStack,
  FileUp,
  Hourglass,
  ListChecks,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { cn } from "cn";
import { card } from "@/components/page-header";
import { PageHeader } from "@/components/page-header";
import { QueryStates } from "@/components/query-states";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { toast } from "@/components/toast";
import { Button, buttonVariants } from "@/components/ui/button";
import { apiGet, apiPostForm, type Schemas } from "@/lib/api";
import {
  FILE_RULE,
  POLL_MS,
  STATUS_LABELS,
  STATUS_TONES,
  isUploadablePdf,
  keepFile,
} from "@/lib/plan-upload";

type Plan = Schemas["Plan"];
type PlanType = Plan["type"];

// Keyed by the generated union, so tsc fails if a plan type is missing.
// Each type keeps one colour everywhere, so a planner learns them at a glance.
const PLAN_TYPE_STYLE: Record<PlanType, string> = {
  CLUP: "bg-[oklch(0.95_0.04_290)] text-[oklch(0.42_0.19_290)]",
  CDP: "bg-[oklch(0.95_0.035_15)] text-[oklch(0.47_0.17_15)]",
  LDIP: "bg-[oklch(0.95_0.035_60)] text-[oklch(0.47_0.12_60)]",
  AIP: "bg-[oklch(0.95_0.03_250)] text-[oklch(0.45_0.15_255)]",
  LDRRMP: "bg-[oklch(0.95_0.045_155)] text-[oklch(0.44_0.12_155)]",
  LCCAP: "bg-[oklch(0.95_0.04_195)] text-[oklch(0.44_0.09_200)]",
  Other: "bg-muted text-muted-foreground",
};
const PLAN_TYPES = Object.keys(PLAN_TYPE_STYLE);

const field = "flex flex-col gap-1.5 text-sm font-bold";
const hint = "text-xs font-normal text-muted-foreground";
const input =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-base font-normal transition-colors outline-none hover:border-primary/40 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30";

export default function PlansPage() {
  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: () => apiGet<Plan[]>("/plans"),
    // S2-06: keep the list fresh while any plan is extracting.
    refetchInterval: (q) =>
      q.state.data?.some((p) => p.status === "extracting") ? POLL_MS : false,
  });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Plans"
        description="Every plan the city has added. Upload a new one, or open a plan to check its PPAs."
        actions={
          <Link
            href="/findings"
            className={buttonVariants({ variant: "ink", size: "lg" })}
          >
            <ListChecks aria-hidden />
            Go to findings
          </Link>
        }
      />
      <PlanStats plans={plans.data} />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section
          aria-labelledby="plan-library-heading"
          className={`${card} flex min-w-0 flex-col gap-4 p-5 sm:p-6`}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="plan-library-heading" className="text-xl font-bold">
              Plan library
            </h2>
            <p className="text-sm text-muted-foreground">
              Open a plan to review its PPAs
            </p>
          </div>
          <QueryStates
            query={plans}
            what="plans"
            isEmpty={(data) => data.length === 0}
            empty="No plans yet. Upload your first plan with the form on this page."
          >
            {(data) => <PlanTable plans={data} />}
          </QueryStates>
        </section>
        <UploadForm />
      </div>
    </div>
  );
}

/** Four KPI tiles from the same plans query, so they cost no extra request. */
function PlanStats({ plans }: { plans: Plan[] | undefined }) {
  const count = (status: Plan["status"]) =>
    plans?.filter((p) => p.status === status).length;
  const ready = count("ready");
  const failed = count("failed");
  const extracting = count("extracting");
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        label="Plans loaded"
        value={plans?.length}
        hint="Across every office"
        icon={FileStack}
      />
      <StatCard
        label="Confirmed"
        value={count("confirmed")}
        hint="Used when checks run"
        icon={CircleCheckBig}
        tone="success"
        delay={60}
      />
      <StatCard
        label="Needs review"
        value={ready}
        hint={ready ? "Open and confirm" : "Nothing waiting"}
        icon={Hourglass}
        tone="warning"
        delay={120}
      />
      <StatCard
        label="Reading or failed"
        value={
          extracting === undefined || failed === undefined
            ? undefined
            : extracting + failed
        }
        hint={failed ? `${failed} need a retry` : "All uploads read"}
        icon={TriangleAlert}
        tone={failed ? "danger" : "info"}
        delay={180}
      />
    </div>
  );
}

function PlanTable({ plans }: { plans: Plan[] }) {
  return (
    <div className="-mx-5 overflow-x-auto sm:-mx-6">
      <table className="w-full min-w-[40rem] text-left">
        <thead className="text-xs tracking-wide text-muted-foreground uppercase">
          <tr className="border-y bg-muted/50">
            <th className="px-5 py-3 font-bold sm:px-6">Type</th>
            <th className="px-3 py-3 font-bold">Title</th>
            <th className="px-3 py-3 font-bold">Period</th>
            <th className="px-5 py-3 font-bold sm:px-6">Status</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => (
            <tr
              key={plan.id}
              className="group border-b transition-colors last:border-b-0 hover:bg-secondary/40"
            >
              <td className="px-5 py-4 sm:px-6">
                <span
                  className={cn(
                    "inline-flex min-w-16 justify-center rounded-lg px-2 py-1 font-heading text-xs font-extrabold tracking-wide",
                    PLAN_TYPE_STYLE[plan.type],
                  )}
                >
                  {plan.type}
                </span>
              </td>
              <td className="px-3 py-4">
                <Link
                  href={`/plans/${plan.id}`}
                  className="inline-flex items-center gap-1 rounded-md font-bold text-foreground underline-offset-4 outline-none group-hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/40"
                >
                  {plan.title}
                  <ChevronRight
                    aria-hidden
                    className="size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </Link>
              </td>
              <td className="px-3 py-4 whitespace-nowrap text-muted-foreground tabular-nums">
                {plan.period_start}–{plan.period_end}
              </td>
              <td className="px-5 py-4 sm:px-6">
                <StatusBadge tone={STATUS_TONES[plan.status]}>
                  {STATUS_LABELS[plan.status]}
                </StatusBadge>
                {plan.error && (
                  <span className="mt-1 block max-w-60 text-sm text-destructive">
                    {plan.error}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const sizeFormat = new Intl.NumberFormat("en", {
  style: "unit",
  unit: "kilobyte",
  maximumFractionDigits: 0,
});

/** S2-01 to S2-04: the upload form. Values stay put on every error. */
function UploadForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [type, setType] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const upload = useMutation({
    mutationFn: (form: FormData) => apiPostForm<Plan>("/plans", form),
    onSuccess: (plan, form) => {
      keepFile(plan.id, form.get("file") as File);
      queryClient.setQueryData(["plans", String(plan.id)], plan);
      void queryClient.invalidateQueries({ queryKey: ["plans"], exact: true });
      toast.success(
        "Plan uploaded",
        "PlanTrace is reading the PDF. The page updates by itself.",
      );
      router.push(`/plans/${plan.id}`);
    },
    onError: (e) => toast.error("Upload failed", e.message),
  });

  const startYear = Number.parseInt(start, 10);
  const endYear = Number.parseInt(end, 10);
  const yearsBackwards =
    Number.isInteger(startYear) &&
    Number.isInteger(endYear) &&
    startYear > endYear;
  const ready =
    file !== null &&
    type !== "" &&
    Number.isInteger(startYear) &&
    Number.isInteger(endYear) &&
    !yearsBackwards;
  // After success the page is leaving; keep the form locked until it does.
  const busy = upload.isPending || upload.isSuccess;

  function pick(picked: File | null) {
    if (picked && !isUploadablePdf(picked)) {
      setFile(null);
      setFileError(FILE_RULE);
      return false;
    }
    setFile(picked);
    setFileError(null);
    return true;
  }

  function chooseFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (!pick(e.target.files?.[0] ?? null)) e.target.value = "";
  }

  function drop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) pick(dropped);
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
      className={`${card} flex flex-col gap-5 p-5 sm:p-6 xl:sticky xl:top-28`}
      onSubmit={submit}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_20px_-8px_var(--primary)]">
          <Upload aria-hidden className="size-5" />
        </span>
        <div>
          <h2 id="upload-heading" className="text-xl font-bold">
            Upload a plan
          </h2>
          <p className="text-sm text-muted-foreground">
            The Upload button turns on once all four fields are filled in.
          </p>
        </div>
      </div>
      <fieldset disabled={busy} className="flex flex-col gap-4">
        <label
          className={field}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={drop}
        >
          PDF file
          <span
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center font-normal transition-colors has-[:focus-visible]:border-primary has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/30",
              dragging
                ? "border-primary bg-secondary"
                : file
                  ? "border-success/50 bg-success-soft/50"
                  : "border-input bg-muted/40 hover:border-primary/50 hover:bg-secondary/50",
            )}
          >
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={chooseFile}
              aria-describedby="upload-file-hint upload-file-error"
            />
            <FileUp
              aria-hidden
              className={cn(
                "size-7",
                file ? "text-success" : "text-primary",
              )}
            />
            {file ? (
              <span className="flex flex-col">
                <span className="font-bold break-all">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {sizeFormat.format(file.size / 1024)} · click to change
                </span>
              </span>
            ) : (
              <span>
                <span className="font-bold text-primary">Choose a PDF</span>{" "}
                or drag it here
              </span>
            )}
          </span>
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
        <div className="grid grid-cols-2 gap-3">
          <label className={field}>
            Start year
            <input
              type="number"
              className={input}
              value={start}
              onChange={(e) => setStart(e.target.value)}
              placeholder="2026"
              aria-invalid={yearsBackwards || undefined}
              aria-describedby="upload-years-hint"
            />
          </label>
          <label className={field}>
            End year
            <input
              type="number"
              className={input}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              placeholder="2031"
              aria-invalid={yearsBackwards || undefined}
              aria-describedby="upload-years-hint"
            />
          </label>
        </div>
        <span id="upload-years-hint" className={`${hint} -mt-2`}>
          {yearsBackwards ? (
            <span className="font-bold text-destructive">
              The start year must be no later than the end year.
            </span>
          ) : (
            "The years the plan covers"
          )}
        </span>
        <Button type="submit" size="lg" disabled={!ready} className="w-full">
          <Upload aria-hidden />
          {busy ? "Uploading…" : "Upload"}
        </Button>
      </fieldset>
      <div id="upload-file-error" className="text-sm empty:hidden">
        {fileError && (
          <p role="alert" className="font-bold text-destructive">
            {fileError}
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
