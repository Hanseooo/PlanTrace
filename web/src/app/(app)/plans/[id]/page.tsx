"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  FileSearch,
  LoaderCircle,
  Plus,
  RotateCw,
  Trash2,
} from "lucide-react";
import { cn } from "cn";
import { PageHeader, card } from "@/components/page-header";
import { QueryStates } from "@/components/query-states";
import { StatusBadge } from "@/components/status-badge";
import { SourcePanel, usePage } from "@/components/source-panel";
import { toast } from "@/components/toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { PpaCell, ppasKey, type PpaField } from "./ppa-cell";
import {
  ApiError,
  apiDelete,
  apiGet,
  apiPost,
  apiPostForm,
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

// The editable columns (S3-09), in table order.
const FIELDS: { field: PpaField; label: string }[] = [
  { field: "code", label: "Code" },
  { field: "title", label: "Title" },
  { field: "description", label: "Description" },
  { field: "office", label: "Office" },
  { field: "sector", label: "Sector" },
  { field: "barangays", label: "Barangays" },
  { field: "cost", label: "Cost" },
  { field: "year_start", label: "Start year" },
  { field: "year_end", label: "End year" },
];
const COLUMNS = [...FIELDS.map((f) => f.label), "Status", "Source", "Actions"];
// Text columns keep a readable width; the table scrolls sideways instead.
const COLUMN_WIDTH: Partial<Record<PpaField, string>> = {
  code: "whitespace-nowrap",
  title: "min-w-52",
  description: "min-w-60",
  office: "min-w-44",
  sector: "min-w-32",
  barangays: "min-w-36",
  cost: "whitespace-nowrap",
};

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
  const planId = plan.data?.id;

  // The status changed (e.g. extracting → ready): refresh the list's copy too,
  // and tell the planner, who may be looking elsewhere on the page.
  const lastStatus = useRef(status);
  useEffect(() => {
    const before = lastStatus.current;
    if (before && status && before !== status) {
      if (before === "extracting" && status === "ready")
        toast.success(
          "Extraction finished",
          "Check each row against its source page, then confirm the plan.",
        );
      if (before === "extracting" && status === "failed")
        toast.error(
          "Extraction failed",
          "The reason is on this page, with a way to retry.",
        );
      void queryClient.invalidateQueries({ queryKey: ["plans"], exact: true });
      if (planId !== undefined)
        void queryClient.invalidateQueries({ queryKey: ppasKey(planId) });
    }
    lastStatus.current = status;
  }, [status, planId, queryClient]);

  return (
    <div className="flex flex-col items-start gap-6">
      <PageHeader
        title="PPA table"
        description="Each row is one program, project or activity (PPA) read from the plan. Click any value to fix it; press Enter to save or Escape to undo."
        back={
          <Link
            href="/plans"
            aria-label="Back to plans"
            title="Back to plans"
            className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-full border bg-card shadow-xs transition-colors outline-none hover:border-primary/40 hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            <ArrowLeft aria-hidden className="size-5" />
          </Link>
        }
      />
      {isNotFound(plan.error) ? (
        <div
          role="alert"
          className={`${card} flex w-full flex-col items-center gap-3 p-10 text-center`}
        >
          <FileSearch aria-hidden className="size-8 text-muted-foreground" />
          <p className="font-heading text-lg font-bold">Plan not found.</p>
          <p className="text-muted-foreground">
            It may have been removed, or the link is wrong. Use the back button
            to return to the plans list.
          </p>
        </div>
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

// The plan's road from upload to checks; the status picks the current step.
const STEPS = ["Upload", "Extract", "Review", "Confirm"] as const;
const STEP_OF: Record<Plan["status"], number> = {
  extracting: 1,
  failed: 1,
  ready: 2,
  confirmed: STEPS.length,
};

function PlanProgress({ status }: { status: Plan["status"] }) {
  const current = STEP_OF[status];
  return (
    <ol
      aria-label="Plan progress"
      className="flex w-full flex-wrap items-center gap-2"
    >
      {STEPS.map((step, i) => {
        const done = i < current;
        const now = i === current;
        const failed = now && status === "failed";
        return (
          <li
            key={step}
            aria-current={now ? "step" : undefined}
            className="flex items-center gap-2"
          >
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full font-heading text-xs font-bold ring-1 ring-inset",
                done && "bg-primary text-primary-foreground ring-primary",
                now &&
                  !failed &&
                  "bg-secondary text-secondary-foreground ring-primary",
                failed &&
                  "bg-destructive/10 text-destructive ring-destructive/40",
                !done && !now && "bg-card text-muted-foreground ring-border",
              )}
            >
              {done ? <Check aria-hidden className="size-4" /> : i + 1}
            </span>
            <span
              className={cn(
                "text-sm font-bold",
                done || now ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {step}
              <span className="sr-only">
                {done ? " (done)" : now ? " (current step)" : ""}
              </span>
            </span>
            {i < STEPS.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "mx-1 h-0.5 w-6 rounded-full sm:w-12",
                  done ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function PlanBody({ plan }: { plan: Plan }) {
  return (
    <div className="flex w-full flex-col items-start gap-5">
      <div
        className={`${card} flex w-full animate-fade-up flex-col gap-4 p-5 sm:p-6`}
      >
        <p className="font-heading text-xl font-extrabold tracking-tight sm:text-2xl">
          {plan.title}
        </p>
        <PlanProgress status={plan.status} />
      </div>
      {plan.status === "extracting" && (
        <div
          className={`${card} flex w-full items-center gap-4 border-primary/30 bg-secondary/70 p-5`}
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-card">
            <LoaderCircle
              aria-hidden
              className="size-6 animate-spin text-primary"
            />
          </span>
          <p role="status">
            Extracting PPAs. This takes about a minute. You can leave this page.
          </p>
        </div>
      )}
      {plan.status === "failed" && <FailedPlan plan={plan} />}
      {plan.status === "ready" && (
        <div
          className={`${card} flex w-full flex-wrap items-center justify-between gap-4 border-warning/30 bg-warning-soft/60 p-5`}
        >
          <div className="flex flex-col items-start gap-2">
            <p role="status">
              <StatusBadge tone="warning">{STATUS_LABELS.ready}</StatusBadge>
            </p>
            <p className="max-w-2xl text-sm">
              Read through the rows below and fix anything wrong. When they look
              right, confirm the plan so the checks can use it.
            </p>
          </div>
          <ConfirmPlan planId={plan.id} />
        </div>
      )}
      {plan.status === "confirmed" && (
        <div
          className={`${card} flex w-full flex-wrap items-center gap-3 border-success/25 bg-success-soft/50 p-4`}
        >
          <p role="status">
            <StatusBadge tone="success">Confirmed</StatusBadge>
          </p>
          <p className="text-sm">
            This plan is used when you run checks on the{" "}
            <Link
              href="/findings"
              className="font-bold text-primary underline underline-offset-4"
            >
              Findings
            </Link>{" "}
            page.
          </p>
        </div>
      )}
      {(plan.status === "ready" || plan.status === "confirmed") && (
        <PpaTable planId={plan.id} />
      )}
    </div>
  );
}

type Ppa = Schemas["Ppa"];

/** S3-15: confirm a ready plan and its rows; disabled with no rows. */
function ConfirmPlan({ planId }: { planId: number }) {
  const queryClient = useQueryClient();
  const ppas = useQuery({
    queryKey: ppasKey(planId),
    queryFn: () => apiGet<Ppa[]>(`/plans/${planId}/ppas`),
  });
  const noRows = ppas.data?.length === 0;
  const confirm = useMutation({
    mutationFn: () => apiPost<Plan>(`/plans/${planId}/confirm`),
    onSuccess: (next) => {
      queryClient.setQueryData(["plans", String(planId)], next);
      void queryClient.invalidateQueries({ queryKey: ["plans"], exact: true });
      void queryClient.invalidateQueries({ queryKey: ppasKey(planId) });
      toast.success("Plan confirmed", "Its PPAs now go into the checks.");
    },
    onError: (e) => toast.error("Couldn't confirm the plan", e.message),
  });
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        size="lg"
        disabled={!ppas.data || noRows || confirm.isPending}
        aria-describedby={noRows ? "confirm-hint" : undefined}
        onClick={() => confirm.mutate()}
      >
        {confirm.isPending ? (
          <LoaderCircle aria-hidden className="animate-spin" />
        ) : (
          <Check aria-hidden />
        )}
        {confirm.isPending ? "Confirming…" : "Confirm plan"}
      </Button>
      {noRows && (
        <span id="confirm-hint" className="text-sm text-muted-foreground">
          Add a row first
        </span>
      )}
      {confirm.isError && (
        <span role="alert" className="text-sm text-destructive">
          Couldn&apos;t confirm. {confirm.error.message}
        </span>
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
      toast.info("Retrying extraction", "PlanTrace is reading the PDF again.");
      // Back to extracting, so the page's poll starts again.
      queryClient.setQueryData(["plans", String(plan.id)], next);
    },
    onError: (e) => toast.error("Retry failed", e.message),
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
      className="flex w-full flex-col items-start gap-3 rounded-3xl border border-destructive/25 bg-destructive/5 p-5"
    >
      <StatusBadge tone="danger">{STATUS_LABELS.failed}</StatusBadge>
      {plan.error && <p>{plan.error}</p>}
      {file ? (
        <Button
          variant="outline"
          disabled={retry.isPending}
          onClick={() => retry.mutate(file)}
        >
          <RotateCw
            aria-hidden
            className={retry.isPending ? "animate-spin" : undefined}
          />
          {retry.isPending ? "Retrying…" : "Retry"}
        </Button>
      ) : (
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Choose the file again
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="text-sm font-normal file:mr-3 file:h-10 file:cursor-pointer file:rounded-xl file:border-0 file:bg-secondary file:px-4 file:font-bold file:text-secondary-foreground"
            disabled={retry.isPending}
            onChange={chooseFile}
          />
        </label>
      )}
      {retry.isPending && !file && <p role="status">Retrying…</p>}
      {fileError && <p className="text-destructive">{fileError}</p>}
      {retry.isError && (
        <p className="text-destructive">Retry failed. {retry.error.message}</p>
      )}
    </div>
  );
}

/** S3-12: the page number comes from the page, so the button fetches it. */
function SourceButton({
  pageId,
  onOpen,
}: {
  pageId: number;
  onOpen: (pageId: number, opener: HTMLElement) => void;
}) {
  const page = usePage(pageId);
  const pageNo = page.data?.page_no;
  return (
    <Button
      variant="secondary"
      size="xs"
      className="rounded-full px-2.5 tabular-nums"
      aria-label={
        pageNo === undefined ? "Source page" : `Source page ${pageNo}`
      }
      onClick={(e) => onOpen(pageId, e.currentTarget)}
    >
      {pageNo === undefined ? "p. …" : `p. ${pageNo}`}
    </Button>
  );
}

function PpaTable({ planId }: { planId: number }) {
  const [source, setSource] = useState<{
    pageId: number;
    opener: HTMLElement;
    /** The row whose Source button opened the panel. */
    ppaId: number;
  } | null>(null);
  const queryClient = useQueryClient();
  const ppas = useQuery({
    queryKey: ppasKey(planId),
    queryFn: () => apiGet<Ppa[]>(`/plans/${planId}/ppas`),
  });
  // S3-13: the added row opens its first cell's editor.
  const [addedId, setAddedId] = useState<number | null>(null);
  const add = useMutation({
    mutationFn: () => apiPost<Ppa>(`/plans/${planId}/ppas`),
    onSuccess: (row) => {
      queryClient.setQueryData<Ppa[]>(ppasKey(planId), (rows) => [
        ...(rows ?? []),
        row,
      ]);
      setAddedId(row.id);
    },
    onError: (e) => toast.error("Couldn't add a row", e.message),
  });
  const addRow = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        disabled={add.isPending}
        onClick={() => add.mutate()}
      >
        <Plus aria-hidden />
        {add.isPending ? "Adding…" : "Add row"}
      </Button>
      {add.isError && (
        <span role="alert" className="text-sm text-destructive">
          Couldn&apos;t add a row. {add.error.message}
        </span>
      )}
    </div>
  );

  return (
    <QueryStates
      query={ppas}
      what="PPAs"
      isEmpty={(data) => data.length === 0}
      empty={
        <div className="flex flex-col items-center gap-3">
          <p>No PPAs found. Add rows by hand.</p>
          {addRow}
        </div>
      }
    >
      {(data) => (
        <div className="flex w-full flex-col items-start gap-4 lg:flex-row">
          <div className="flex w-full min-w-0 flex-1 flex-col items-start gap-3">
            <div className={`${card} w-full overflow-x-auto`}>
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/50 text-xs tracking-wide text-muted-foreground uppercase">
                  <tr>
                    {COLUMNS.map((c) => (
                      <th
                        key={c}
                        className="px-3 py-3.5 font-bold whitespace-nowrap first:pl-5 last:pr-5"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((ppa, i) => (
                    <PpaRow
                      key={ppa.id}
                      ppa={ppa}
                      rowName={ppa.code ?? ppa.title ?? `row ${i + 1}`}
                      autoOpen={ppa.id === addedId}
                      onOpenSource={(pageId, opener) =>
                        setSource({ pageId, opener, ppaId: ppa.id })
                      }
                      onDeleted={() => {
                        // S3-14: the panel closes with the row that opened it.
                        if (source?.ppaId === ppa.id) setSource(null);
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              {addRow}
              <p className="text-sm text-muted-foreground">
                {data.length} {data.length === 1 ? "PPA" : "PPAs"} in this plan
              </p>
            </div>
          </div>
          {source && (
            <SourcePanel
              pageId={source.pageId}
              highlight={(() => {
                const row = data.find((p) => p.id === source.ppaId);
                return [row?.code, row?.title];
              })()}
              returnFocusTo={source.opener}
              onClose={() => setSource(null)}
            />
          )}
        </div>
      )}
    </QueryStates>
  );
}

/** One PPA row: an editable cell per field, and the row's save error (S3-11). */
function PpaRow({
  ppa,
  rowName,
  autoOpen,
  onOpenSource,
  onDeleted,
}: {
  ppa: Ppa;
  rowName: string;
  /** Open the first cell's editor on mount (a row just added). */
  autoOpen: boolean;
  onOpenSource: (pageId: number, opener: HTMLElement) => void;
  onDeleted: () => void;
}) {
  // One slot per cell, so one cell's save doesn't clear another's error.
  const [saveErrors, setSaveErrors] = useState<
    Partial<Record<PpaField, string>>
  >({});
  const errors = FIELDS.flatMap(({ field }) => saveErrors[field] ?? []);
  const saveError = errors.length ? errors.join(" ") : null;
  return (
    <>
      <tr
        className={`align-top transition-colors hover:bg-secondary/30 ${saveError ? "" : "border-b last:border-b-0"}`}
      >
        {FIELDS.map(({ field, label }) => (
          <td
            key={field}
            className={cn("px-3 py-2.5 first:pl-5", COLUMN_WIDTH[field])}
          >
            <PpaCell
              ppa={ppa}
              field={field}
              label={label}
              rowName={rowName}
              autoOpen={autoOpen && field === FIELDS[0].field}
              onSaveError={(message) =>
                setSaveErrors((e) => ({ ...e, [field]: message ?? undefined }))
              }
            />
          </td>
        ))}
        <td className="px-3 py-2.5">
          <span
            className={`inline-block rounded-full px-2.5 py-1 text-xs leading-none font-bold ring-1 ring-inset ${
              ppa.status === "confirmed"
                ? "bg-success-soft text-success ring-success/20"
                : "bg-warning-soft text-warning ring-warning/25"
            }`}
          >
            {ppa.status}
          </span>
        </td>
        <td className="px-3 py-2.5">
          {ppa.page_id === null ? (
            "—"
          ) : (
            <SourceButton pageId={ppa.page_id} onOpen={onOpenSource} />
          )}
        </td>
        <td className="px-3 py-1.5 pr-5">
          <DeletePpa ppa={ppa} rowName={rowName} onDeleted={onDeleted} />
        </td>
      </tr>
      {saveError && (
        <tr className="border-b">
          <td colSpan={COLUMNS.length} className="px-5 pb-3">
            <p
              role="alert"
              className="rounded-xl bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {saveError}
            </p>
          </td>
        </tr>
      )}
    </>
  );
}

/** S3-14, RS-06: delete a row after an AlertDialog confirms it. */
function DeletePpa({
  ppa,
  rowName,
  onDeleted,
}: {
  ppa: Ppa;
  rowName: string;
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const remove = useMutation({
    mutationFn: () => apiDelete(`/ppas/${ppa.id}`),
    onSuccess: () => {
      setOpen(false);
      onDeleted();
      queryClient.setQueryData<Ppa[]>(ppasKey(ppa.plan_id), (rows) =>
        rows?.filter((r) => r.id !== ppa.id),
      );
      toast.success("Row deleted", `${rowName} is no longer in this plan.`);
    },
    onError: (e) => toast.error("Couldn't delete the row", e.message),
  });
  const what = `Delete PPA ${rowName}`;
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (remove.isPending) return;
        if (next) remove.reset();
        setOpen(next);
      }}
    >
      <AlertDialogTrigger
        aria-label={what}
        title={what}
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          />
        }
      >
        <Trash2 aria-hidden className="size-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Trash2 aria-hidden />
          </AlertDialogMedia>
          <AlertDialogTitle>
            {what}? This can&apos;t be undone.
          </AlertDialogTitle>
          <AlertDialogDescription>
            The row and its edits leave this plan. Findings that use it change
            on the next run.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {remove.isError && (
          <p role="alert" className="text-sm text-destructive">
            Couldn&apos;t delete. {remove.error.message}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white shadow-none hover:bg-destructive/90"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            <Trash2 aria-hidden />
            {remove.isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
