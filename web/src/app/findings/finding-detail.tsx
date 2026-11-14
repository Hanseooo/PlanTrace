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
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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

// RS-04: an unreviewed finding is labelled as the AI's suggestion.
export const STATUS_LABELS: Record<Finding["status"], string> = {
  suggested: "AI suggestion",
  confirmed: "Confirmed",
  rejected: "Rejected",
};

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
  // No optimistic update (S3 Q6): the list changes when the PATCH returns.
  const update = useMutation({
    mutationFn: (body: FindingUpdate) =>
      apiPatch<Finding>(`/findings/${finding.id}`, body),
    onSuccess: (saved) =>
      queryClient.setQueryData<Finding[]>(["findings"], (old) =>
        old?.map((f) => (f.id === saved.id ? saved : f)),
      ),
  });
  const pendingStatus = update.isPending ? update.variables.status : undefined;
  const { ppa_a, ppa_b } = finding;
  const acceptsParent = finding.check === "orphan" && ppa_b !== null;

  return (
    <div className="flex w-full flex-col items-start gap-4 lg:flex-row">
      <section
        aria-label="Finding detail"
        className="flex w-full min-w-0 flex-1 flex-col gap-4"
      >
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-lg font-semibold">
            {CHECK_LABELS[finding.check]} finding
            {finding.verdict && `: ${finding.verdict}`}
          </h2>
          <span className="rounded-md bg-muted px-2 py-0.5 text-sm">
            {STATUS_LABELS[finding.status]}
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <PpaCard ppa={ppa_a} barangayName={barangayName} />
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
            <p className="text-muted-foreground">
              {finding.check === "orphan"
                ? "No suggested parent"
                : "No second PPA: this finding is against the zoning map."}
            </p>
          )}
        </div>
        {finding.check === "duplicate" && ppa_b && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Cost difference</dt>
            <dd>
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
        <p>{finding.reason}</p>
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
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={update.isPending}
            onClick={() => update.mutate({ status: "confirmed" })}
          >
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
              render={<Button variant="destructive" />}
              disabled={update.isPending}
            >
              {pendingStatus === "rejected" ? "Rejecting…" : "Reject"}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
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
                  variant="destructive"
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
        {update.isError && (
          <p role="alert" className="text-sm text-destructive">
            Couldn&apos;t save: {update.error.message}
          </p>
        )}
      </section>
      {source && (
        <SourcePanel
          pageId={source.pageId}
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
          className="w-full rounded-lg border bg-background p-2 text-sm"
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
      {note && <p className="text-sm whitespace-pre-wrap">Note: {note}</p>}
      <Button
        ref={toggle}
        size="sm"
        variant="outline"
        onClick={() => setDraft(note ?? "")}
      >
        {note ? "Edit note" : "Add note"}
      </Button>
    </div>
  );
}

/** The page number comes from the page, so the button fetches it (as on the plan page). */
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
      aria-label={pageNo === undefined ? "Source page" : `Source page ${pageNo}`}
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
    ["Plan", ppa.plan_type],
    ["Title", ppa.title ?? "—"],
    ["Office", ppa.office ?? "—"],
    ["Barangays", ppa.barangays.map(barangayName).join(", ") || "—"],
    ["Cost", ppa.cost === null ? "—" : pesos.format(ppa.cost)],
    ["Years", years(ppa.year_start, ppa.year_end)],
  ];
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
      {heading && <h3 className="font-medium">{heading}</h3>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
