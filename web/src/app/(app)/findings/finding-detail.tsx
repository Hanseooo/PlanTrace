"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SourcePanel, usePage } from "@/components/source-panel";
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
import {
  ArrowRight,
  Check,
  Copy,
  GitBranch,
  Lightbulb,
  MapPinned,
  NotebookPen,
  Scale,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { card } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { apiPatch, pesos, years, type Schemas } from "@/lib/api";

type Finding = Schemas["Finding"];
type FindingPpa = Schemas["FindingPpa"];
type FindingUpdate = Schemas["FindingUpdate"];

export const CHECK_LABELS: Record<Finding["check"], string> = {
  duplicate: "Duplicate",
  orphan: "Orphan",
  ccc: "CCC",
  zone: "Zone",
};

export const CHECK_ICONS: Record<Finding["check"], LucideIcon> = {
  duplicate: Copy,
  orphan: GitBranch,
  ccc: Scale,
  zone: MapPinned,
};

// RS-04: an unreviewed finding is labelled as the AI's suggestion.
export const STATUS_LABELS: Record<Finding["status"], string> = {
  suggested: "AI suggestion",
  confirmed: "Confirmed",
  rejected: "Rejected",
};

export const STATUS_TONES = {
  suggested: "info",
  confirmed: "success",
  rejected: "neutral",
} as const satisfies Record<Finding["status"], string>;

/** S4-18 to S4-20: both PPAs side by side, the reason, sources, review actions. */
export function FindingDetail({
  finding,
  barangayName,
}: {
  finding: Finding;
  barangayName: (code: string) => string;
}) {
  const queryClient = useQueryClient();
  const [source, setSource] = useState<{
    pageId: number;
    opener: HTMLElement;
  } | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const acceptsParent = finding.check === "orphan" && finding.ppa_b !== null;
  const Icon = CHECK_ICONS[finding.check];
  // No optimistic update (S3 Q6): the list changes when the PATCH returns.
  const update = useMutation({
    mutationFn: (body: FindingUpdate) =>
      apiPatch<Finding>(`/findings/${finding.id}`, body),
    onSuccess: (saved, body) => {
      queryClient.setQueryData<Finding[]>(["findings"], (old) =>
        old?.map((f) => (f.id === saved.id ? saved : f)),
      );
      if (body.status === "confirmed")
        toast.success(
          acceptsParent ? "Parent accepted" : "Finding confirmed",
          acceptsParent
            ? "The AIP project is now linked to its CDP parent."
            : "It stays on the list as a real issue.",
        );
      else if (body.status === "rejected")
        toast.info("Finding rejected", "You can confirm it again later.");
      else toast.success("Note saved");
    },
    onError: (e) => toast.error("Couldn't save the review", e.message),
  });
  const pendingStatus = update.isPending ? update.variables.status : undefined;
  const { ppa_a, ppa_b } = finding;

  return (
    <div className="flex w-full flex-col items-start gap-4 lg:flex-row">
      <section
        aria-label="Finding detail"
        className={`${card} flex w-full min-w-0 flex-1 animate-fade-up flex-col gap-5 p-5 sm:p-6`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_20px_-8px_var(--primary)]">
            <Icon aria-hidden className="size-5" />
          </span>
          <h2 className="text-xl font-bold">
            {CHECK_LABELS[finding.check]} finding
            {finding.verdict && `: ${finding.verdict}`}
          </h2>
          <StatusBadge tone={STATUS_TONES[finding.status]}>
            {STATUS_LABELS[finding.status]}
          </StatusBadge>
        </div>
        <div className="relative grid gap-4 sm:grid-cols-2">
          <PpaCard ppa={ppa_a} barangayName={barangayName} />
          {ppa_b && (
            <span
              aria-hidden
              className="absolute top-1/2 left-1/2 z-10 hidden size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-card bg-ink font-heading text-xs font-bold text-ink-foreground sm:flex"
            >
              {finding.check === "orphan" ? (
                <ArrowRight className="size-4" />
              ) : (
                "vs"
              )}
            </span>
          )}
          {ppa_b ? (
            <PpaCard
              ppa={ppa_b}
              barangayName={barangayName}
              heading={
                finding.check === "orphan" ? (
                  <>
                    Suggested parent
                    {finding.status === "suggested" && (
                      <span className="ml-2 font-normal text-muted-foreground">
                        AI suggestion
                      </span>
                    )}
                  </>
                ) : undefined
              }
            />
          ) : (
            <p className="flex items-center rounded-2xl border border-dashed p-4 text-muted-foreground">
              {finding.check === "orphan"
                ? "No suggested parent"
                : "No second PPA: this finding is against the zoning map."}
            </p>
          )}
        </div>
        {finding.check === "duplicate" && ppa_b && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-2xl border border-warning/25 bg-warning-soft/50 p-4">
            <dt className="text-muted-foreground">Cost difference</dt>
            <dd className="font-bold">
              {ppa_a.cost === null || ppa_b.cost === null
                ? "not stated"
                : pesos.format(Math.abs(ppa_a.cost - ppa_b.cost))}
            </dd>
            <dt className="text-muted-foreground">Years</dt>
            <dd>
              {years(ppa_a.year_start, ppa_a.year_end)} vs{" "}
              {years(ppa_b.year_start, ppa_b.year_end)}
            </dd>
          </dl>
        )}
        <div className="flex gap-3 rounded-2xl border border-primary/20 bg-secondary/60 p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-card text-primary">
            <Lightbulb aria-hidden className="size-5" />
          </span>
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-bold">Why this was flagged</p>
            <p>{finding.reason}</p>
          </div>
        </div>
        <NoteEditor
          note={finding.note}
          saving={update.isPending}
          onSave={(note, done) => update.mutate({ note }, { onSuccess: done })}
        />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sources</span>
          {finding.page_ids.length === 0
            ? "No source page"
            : finding.page_ids.map((pageId) => (
                <SourceButton
                  key={pageId}
                  pageId={pageId}
                  onOpen={(id, opener) => setSource({ pageId: id, opener })}
                />
              ))}
        </div>
        <div className="-mx-5 -mb-5 flex flex-col gap-3 rounded-b-3xl border-t bg-muted/40 px-5 py-4 sm:-mx-6 sm:-mb-6 sm:px-6">
          <p className="text-sm text-muted-foreground">
            Is this a real problem? Confirm it to keep it on the list, or reject
            it if it is a false alarm.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="lg"
              disabled={update.isPending}
              onClick={() => update.mutate({ status: "confirmed" })}
            >
              <Check aria-hidden />
              {acceptsParent
                ? pendingStatus === "confirmed"
                  ? "Accepting…"
                  : "Accept parent"
                : pendingStatus === "confirmed"
                  ? "Confirming…"
                  : "Confirm"}
            </Button>
            <AlertDialog open={rejecting} onOpenChange={setRejecting}>
              <AlertDialogTrigger
                render={<Button variant="destructive" size="lg" />}
                disabled={update.isPending}
              >
                <X aria-hidden />
                {pendingStatus === "rejected" ? "Rejecting…" : "Reject"}
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogMedia className="bg-destructive/10 text-destructive">
                    <X aria-hidden />
                  </AlertDialogMedia>
                  <AlertDialogTitle>Reject this finding?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {acceptsParent
                      ? "An accepted parent link is rejected too. "
                      : ""}
                    You can confirm it again later.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-white shadow-none hover:bg-destructive/90"
                    onClick={() => {
                      setRejecting(false);
                      update.mutate({ status: "rejected" });
                    }}
                  >
                    Reject
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        {update.isError && (
          <p role="alert" className="text-sm text-destructive">
            Couldn&apos;t save: {update.error.message}
          </p>
        )}
      </section>
      {source && (
        <SourcePanel
          pageId={source.pageId}
          highlight={[ppa_a.code, ppa_a.title, ppa_b?.code, ppa_b?.title]}
          returnFocusTo={source.opener}
          onClose={() => setSource(null)}
        />
      )}
    </div>
  );
}

/** S4-19: Add note opens a textarea; Save or Ctrl+Enter saves, Escape or Cancel closes. */
function NoteEditor({
  note,
  saving,
  onSave,
}: {
  note: string | null;
  saving: boolean;
  onSave: (note: string, done: () => void) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const editing = draft !== null;
  const toggle = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  // Closing the editor puts focus back on "Add note" / "Edit note" (RS-07).
  useEffect(() => {
    if (wasEditing.current && !editing) toggle.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  if (editing) {
    const save = () => onSave(draft, () => setDraft(null));
    return (
      <div className="flex w-full flex-col gap-2">
        <label htmlFor="finding-note" className="text-sm font-medium">
          Note
        </label>
        <textarea
          id="finding-note"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setDraft(null);
            } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              if (!saving) save();
            }
          }}
          rows={3}
          placeholder="Why you confirmed or rejected this, or what to check next"
          className="w-full rounded-2xl border border-input bg-background p-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30"
        />
        <div className="flex gap-2">
          <Button size="sm" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDraft(null)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {note && (
        <p className="rounded-2xl bg-muted/60 px-3 py-2 text-sm whitespace-pre-wrap">
          Note: {note}
        </p>
      )}
      <Button
        ref={toggle}
        size="sm"
        variant="outline"
        onClick={() => setDraft(note ?? "")}
      >
        <NotebookPen aria-hidden />
        {note ? "Edit note" : "Add note"}
      </Button>
    </div>
  );
}

/** The page number comes from the page, so the button fetches it (as on the plan page). */
export function SourceButton({
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

function PpaCard({
  ppa,
  barangayName,
  heading,
}: {
  ppa: FindingPpa;
  barangayName: (code: string) => string;
  heading?: React.ReactNode;
}) {
  const rows: [string, string][] = [
    ["Title", ppa.title ?? "—"],
    ["Office", ppa.office ?? "—"],
    ["Barangays", ppa.barangays.map(barangayName).join(", ") || "—"],
    ["Cost", ppa.cost === null ? "—" : pesos.format(ppa.cost)],
    ["Years", years(ppa.year_start, ppa.year_end)],
  ];
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-lg bg-secondary px-2 py-1 font-heading text-xs font-extrabold tracking-wide text-secondary-foreground">
          {ppa.plan_type}
        </span>
        {ppa.code && (
          <span className="text-xs font-bold text-muted-foreground">
            {ppa.code}
          </span>
        )}
      </div>
      {heading && <h3 className="font-bold">{heading}</h3>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd
              className={cn(
                label === "Title" && "font-bold",
                label === "Cost" && "tabular-nums",
              )}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
