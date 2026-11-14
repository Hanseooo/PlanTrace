"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { QueryStates } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { apiGet, type Schemas } from "@/lib/api";

/** One page of a plan, shared by the panel and the "p. N" buttons (SH-02). */
export function usePage(pageId: number) {
  return useQuery({
    queryKey: ["pages", pageId],
    queryFn: () => apiGet<Schemas["Page"]>(`/pages/${pageId}`),
  });
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Splits `text` so every case-insensitive match of a term is its own part. */
export function highlightParts(
  text: string,
  terms: readonly (string | null | undefined)[],
): { text: string; match: boolean }[] {
  // Longest first, so "Drainage improvement works" wins over "Drainage improvement".
  const clean = [
    ...new Set(terms.map((t) => t?.trim() ?? "").filter((t) => t.length >= 3)),
  ].sort((a, b) => b.length - a.length);
  if (clean.length === 0) return [{ text, match: false }];
  const re = new RegExp(`(${clean.map(escapeRegExp).join("|")})`, "gi");
  // split() with one capture group puts the matches at the odd indexes.
  return text
    .split(re)
    .map((part, i) => ({ text: part, match: i % 2 === 1 }))
    .filter((part) => part.text !== "");
}

/** The page text with the given terms marked, scrolled to the first mark. */
function PageText({
  text,
  highlight,
}: {
  text: string;
  highlight: readonly (string | null | undefined)[];
}) {
  const box = useRef<HTMLParagraphElement>(null);
  const parts = highlightParts(text, highlight);
  const key = parts.map((p) => p.text).join("\u0000");

  // Scroll inside the panel only, so the page itself doesn't jump.
  useEffect(() => {
    const el = box.current;
    const mark = el?.querySelector("mark");
    if (!el || !(mark instanceof HTMLElement)) return;
    // The box is position: relative, so offsetTop is measured from it.
    el.scrollTop = Math.max(0, mark.offsetTop - 48);
  }, [key]);

  return (
    <p
      ref={box}
      className="relative max-h-[70vh] overflow-y-auto text-sm whitespace-pre-wrap"
    >
      {parts.map((p, i) =>
        p.match ? (
          <mark
            key={i}
            className="rounded-sm bg-warning-soft px-0.5 font-bold text-foreground ring-1 ring-warning/40"
          >
            {p.text}
          </mark>
        ) : (
          p.text
        ),
      )}
    </p>
  );
}

/**
 * The source panel (S3-12, RS-05): one page's text beside the screen that opened
 * it, without blocking it. Focus moves in on open; Escape or Close calls
 * `onClose` and puts focus back on `returnFocusTo`. S4 and S5 reuse it.
 */
export function SourcePanel({
  pageId,
  onClose,
  returnFocusTo,
  highlight = [],
}: {
  pageId: number;
  onClose: () => void;
  /** Words to mark in the page text, e.g. the PPA's code and title. */
  highlight?: readonly (string | null | undefined)[];
  /** The control that opened the panel; it gets focus back on close. */
  returnFocusTo?: HTMLElement | null;
}) {
  const page = usePage(pageId);
  const ref = useRef<HTMLElement>(null);

  // Opening, or opening again from another control, moves focus into the panel.
  useEffect(() => {
    ref.current?.focus();
  }, [pageId, returnFocusTo]);

  function close() {
    returnFocusTo?.focus();
    onClose();
  }

  return (
    <aside
      ref={ref}
      tabIndex={-1}
      aria-label="Source page"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          close();
        }
      }}
      className="flex w-full flex-col gap-3 rounded-lg border p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring lg:sticky lg:top-4 lg:w-96 lg:shrink-0"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {page.data ? `Page ${page.data.page_no}` : "Source page"}
        </h2>
        <Button variant="outline" size="sm" onClick={close}>
          Close
        </Button>
      </div>
      <QueryStates
        query={page}
        what="the page"
        isEmpty={(data) => data.text.trim() === ""}
        empty="No text on this page."
      >
        {(data) => <PageText text={data.text} highlight={highlight} />}
      </QueryStates>
    </aside>
  );
}
