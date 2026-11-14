"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { ArrowLeft, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { card } from "@/components/page-header";
import { QueryStates } from "@/components/query-states";
import { StatusBadge } from "@/components/status-badge";
import { SourcePanel, usePage } from "@/components/source-panel";
import { Button, buttonVariants } from "@/components/ui/button";
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

  // The status changed (e.g. extracting → ready): refresh the list's copy too.
  const lastStatus = useRef(status);
  useEffect(() => {
    if (lastStatus.current && status && lastStatus.current !== status) {
      void queryClient.invalidateQueries({ queryKey: ["plans"], exact: true });
      if (planId !== undefined)
        void queryClient.invalidateQueries({ queryKey: ppasKey(planId) });
    }
    lastStatus.current = status;
  }, [status, planId, queryClient]);

  return (
    <div className="flex flex-col items-start gap-6">
      <Link href="/plans" className={buttonVariants({ variant: "outline" })}>
        <ArrowLeft aria-hidden />
        Back to plans
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">PPA table</h1>
        <p className="text-muted-foreground">
          Each row is one program, project or activity (PPA) read from the plan.
          Click any value to fix it; press Enter to save or Escape to undo.
        </p>
      </div>
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
    <div className="flex w-full flex-col items-start gap-5">
      <p className="text-xl font-bold">{plan.title}</p>
      {plan.status === "extracting" && (
        <div
          className={`${card} flex items-center gap-3 border-primary/30 bg-secondary p-4`}
        >
          <LoaderCircle
            aria-hidden
            className="size-6 shrink-0 animate-spin text-primary"
          />
          <p role="status">
            Extracting PPAs. This takes about a minute. You can leave this page.
          </p>
        </div>
      )}
      {plan.status === "failed" && <FailedPlan plan={plan} />}
      {plan.status === "ready" && (
        <div
          className={`${card} flex w-full flex-wrap items-center justify-between gap-4 border-warning/30 bg-warning-soft/60 p-4`}
        >
          <div className="flex flex-col gap-1">
            <p role="status">
              <StatusBadge tone="warning">{STATUS_LABELS.ready}</StatusBadge>
            </p>
            <p className="text-sm">
              Read through the rows below and fix anything wrong. When they look
              right, confirm the plan so the checks can use it.
            </p>
          </div>
          <ConfirmPlan planId={plan.id} />
        </div>
      )}
      {plan.status === "confirmed" && (
        <div className="flex flex-wrap items-center gap-3">
          <p role="status">
            <StatusBadge tone="success">Confirmed</StatusBadge>
          </p>
          <p className="text-sm text-muted-foreground">
            This plan is used when you run checks on the Findings page.
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
    },
  });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="lg"
        disabled={!ppas.data || noRows || confirm.isPending}
        aria-describedby={noRows ? "confirm-hint" : undefined}
        onClick={() => confirm.mutate()}
      >
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
      className="flex flex-col items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4"
    >
      <StatusBadge tone="danger">{STATUS_LABELS.failed}</StatusBadge>
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
      variant="link"
      size="sm"
      className="h-auto px-0"
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
        <div className="flex flex-col items-start gap-2">
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
                <thead className="border-b bg-muted/60 text-muted-foreground">
                  <tr>
                    {COLUMNS.map((c) => (
                      <th
                        key={c}
                        className="px-3 py-3 font-bold whitespace-nowrap"
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
            {addRow}
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
        className={`align-top transition-colors hover:bg-muted/40 ${saveError ? "" : "border-b"}`}
      >
        {FIELDS.map(({ field, label }) => (
          <td key={field} className="px-3 py-2">
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
        <td className="px-3 py-2">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
              ppa.status === "confirmed"
                ? "bg-success-soft text-success"
                : "bg-warning-soft text-warning"
            }`}
          >
            {ppa.status}
          </span>
        </td>
        <td className="px-3 py-2">
          {ppa.page_id === null ? (
            "—"
          ) : (
            <SourceButton pageId={ppa.page_id} onOpen={onOpenSource} />
          )}
        </td>
        <td className="px-3 py-2">
          <DeletePpa ppa={ppa} rowName={rowName} onDeleted={onDeleted} />
        </td>
      </tr>
      {saveError && (
        <tr className="border-b">
          <td colSpan={COLUMNS.length} className="px-3 pb-2">
            <p role="alert" className="text-sm text-destructive">
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
    },
  });
  const what = `Delete PPA ${rowName}`;
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (remove.isPending) return;
        if (next) remove.reset();
        setOpen(next);
      }}
    >
      <AlertDialog.Trigger
        aria-label={what}
        className={buttonVariants({ variant: "destructive", size: "sm" })}
      >
        <Trash2 aria-hidden />
        Delete
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/40" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border bg-card p-6 shadow-lg">
          <AlertDialog.Title className="text-lg font-semibold">
            {what}? This can&apos;t be undone.
          </AlertDialog.Title>
          {remove.isError && (
            <p role="alert" className="text-sm text-destructive">
              Couldn&apos;t delete. {remove.error.message}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <AlertDialog.Close
              disabled={remove.isPending}
              className={buttonVariants({ variant: "outline" })}
            >
              Cancel
            </AlertDialog.Close>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              {remove.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
