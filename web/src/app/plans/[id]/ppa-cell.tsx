"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Combobox } from "@base-ui/react/combobox";
import { apiGet, apiPatch, pesos, type Schemas } from "@/lib/api";

type Ppa = Schemas["Ppa"];
type Barangay = Schemas["Barangay"];
export type PpaField = Exclude<keyof Schemas["PpaInput"], "page_id">;
type Sector = NonNullable<Ppa["sector"]>;

// D3, the same list as `Sector` in api/app/models.py.
const SECTORS: Sector[] = [
  "housing",
  "drainage",
  "flood_control",
  "roads",
  "evacuation",
  "agriculture",
  "water_supply",
  "health",
  "education",
  "livelihood",
  "commercial",
  "industrial",
];

/** The city's barangays, for names in cells and the barangay editor (S3-10). */
export function useBarangays() {
  return useQuery({
    queryKey: ["barangays"],
    queryFn: () => apiGet<Barangay[]>("/barangays"),
    staleTime: Infinity,
  });
}

export function barangayNames(codes: string[], all: Barangay[] | undefined) {
  if (codes.length === 0) return "—";
  return codes
    .map((c) => all?.find((b) => b.psgc_code === c)?.name ?? c)
    .join(", ");
}

const DESCRIPTION_CHARS = 60;

type Value = string | number | string[] | null;
/** What the editor holds: text for every field but barangays (PSGC codes). */
type Draft = string | string[];
type Parsed = { ok: true; value: Value } | { ok: false; error: string };

function toDraft(field: PpaField, value: Value): Draft {
  if (field === "barangays") return (value as string[]) ?? [];
  return value === null ? "" : String(value);
}

function parseYear(text: string, label: string): Parsed {
  if (text === "") return { ok: true, value: null };
  if (!/^\d{4}$/.test(text))
    return { ok: false, error: `${label} must be 4 digits` };
  return { ok: true, value: Number(text) };
}

/** Client-side rules (S3-10): a wrong value is never sent. */
function parse(field: PpaField, draft: Draft, ppa: Ppa): Parsed {
  if (Array.isArray(draft)) return { ok: true, value: draft };
  const text = field === "description" ? draft : draft.trim();
  if (field === "cost") {
    if (text === "") return { ok: true, value: null };
    const cost = Number(text.replaceAll(",", ""));
    if (!Number.isFinite(cost))
      return { ok: false, error: "Cost must be a number" };
    if (cost < 0) return { ok: false, error: "Cost can't be below 0" };
    return { ok: true, value: cost };
  }
  if (field === "year_start") {
    const parsed = parseYear(text, "Start year");
    if (
      parsed.ok &&
      parsed.value !== null &&
      ppa.year_end !== null &&
      (parsed.value as number) > ppa.year_end
    )
      return { ok: false, error: "Start year can't be after the end year" };
    return parsed;
  }
  if (field === "year_end") {
    const parsed = parseYear(text, "End year");
    if (
      parsed.ok &&
      parsed.value !== null &&
      ppa.year_start !== null &&
      (parsed.value as number) < ppa.year_start
    )
      return { ok: false, error: "End year can't be before the start year" };
    return parsed;
  }
  return { ok: true, value: text.trim() === "" ? null : text };
}

function same(a: Value, b: Value) {
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((x, i) => x === b[i]);
  return a === b;
}

function show(
  field: PpaField,
  value: Value,
  barangays: Barangay[] | undefined,
): string {
  if (field === "barangays") return barangayNames(value as string[], barangays);
  if (value === null || value === "") return "—";
  if (field === "cost") return pesos.format(value as number);
  if (field === "description") {
    const text = String(value);
    return text.length > DESCRIPTION_CHARS
      ? `${text.slice(0, DESCRIPTION_CHARS).trimEnd()}…`
      : text;
  }
  return String(value);
}

/**
 * One editable PPA cell (S3-09 to S3-11). It owns open, draft, save, cancel and
 * the in-cell error; `onSaveError` puts "Couldn't save: …" on the row.
 */
export function PpaCell({
  ppa,
  field,
  label,
  rowName,
  autoOpen = false,
  onSaveError,
}: {
  ppa: Ppa;
  field: PpaField;
  /** The column, e.g. "Office". */
  label: string;
  /** The row's name for accessible names, e.g. "LCCAP-01". */
  rowName: string;
  /** Open the editor on mount, e.g. the first cell of a row just added. */
  autoOpen?: boolean;
  onSaveError: (message: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const barangays = useBarangays();
  const value = ppa[field] as Value;
  const [open, setOpen] = useState(autoOpen);
  const [draft, setDraft] = useState<Draft>(() => toDraft(field, value));
  const [error, setError] = useState<string | null>(null);
  // Enter, Escape or a click on the cell are done; the blur that follows isn't.
  const done = useRef(false);
  const cellButton = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  const name = `${label} for ${rowName}`;

  const save = useMutation({
    mutationFn: (next: Value) =>
      apiPatch<Ppa>(`/ppas/${ppa.id}`, { [field]: next }),
    onSuccess: (updated) => {
      onSaveError(null);
      queryClient.setQueryData<Ppa[]>(
        ["plans", String(ppa.plan_id), "ppas"],
        (rows) => rows?.map((r) => (r.id === updated.id ? updated : r)),
      );
    },
    onError: (e) => {
      onSaveError(`Couldn't save: ${e.message}`);
      cellButton.current?.focus();
    },
  });

  // Back on the cell after Enter or Escape closed the editor.
  useEffect(() => {
    if (!open && refocus.current) {
      refocus.current = false;
      cellButton.current?.focus();
    }
  }, [open]);

  function start() {
    done.current = false;
    setDraft(toDraft(field, value));
    setError(null);
    setOpen(true);
  }

  function cancel() {
    done.current = true;
    refocus.current = true;
    setOpen(false);
  }

  function commit(viaKey: boolean) {
    if (done.current) return;
    const parsed = parse(field, draft, ppa);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    done.current = true;
    refocus.current = viaKey;
    setOpen(false);
    if (!same(parsed.value, value)) save.mutate(parsed.value);
  }

  // Leaving the editor saves, unless focus moved within it (e.g. a chip).
  function onBlur(e: React.FocusEvent<HTMLElement>) {
    const to = e.relatedTarget as HTMLElement | null;
    if (to && to.closest(`[data-cell-editor="${name}"]`)) return;
    commit(false);
  }

  if (!open) {
    const shown = save.isPending
      ? show(field, save.variables, barangays.data)
      : show(field, value, barangays.data);
    return (
      <div className="flex flex-col gap-0.5">
        <button
          ref={cellButton}
          type="button"
          aria-label={name}
          title={
            field === "description"
              ? ((value as string | null) ?? "")
              : undefined
          }
          aria-disabled={save.isPending}
          onClick={() => !save.isPending && start()}
          className={`-mx-1 min-h-7 w-full rounded px-1 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-disabled:opacity-70 ${
            field === "cost" ? "tabular-nums" : ""
          }`}
        >
          {shown}
        </button>
        {save.isPending && (
          <span role="status" className="text-xs text-muted-foreground">
            Saving…
          </span>
        )}
      </div>
    );
  }

  const keys = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancel();
    } else if (
      e.key === "Enter" &&
      (field !== "description" || e.ctrlKey || e.metaKey)
    ) {
      e.preventDefault();
      commit(true);
    }
  };
  const inputClass =
    "w-full min-w-24 rounded border border-input bg-background px-1 py-0.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const errorId = `${ppa.id}-${field}-error`;
  const common = {
    "aria-label": name,
    "aria-invalid": error !== null,
    "aria-describedby": error ? errorId : undefined,
    autoFocus: true,
    className: inputClass,
  };

  let editor: React.ReactNode;
  if (field === "barangays") {
    editor = (
      <BarangayEditor
        name={name}
        codes={draft as string[]}
        onChange={setDraft}
        onEnter={() => commit(true)}
        onEscape={cancel}
        query={barangays}
      />
    );
  } else if (field === "description") {
    editor = (
      <textarea
        {...common}
        rows={4}
        value={draft as string}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={keys}
        className={`${inputClass} min-w-64`}
      />
    );
  } else if (field === "sector") {
    editor = (
      <select
        {...common}
        value={draft as string}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={keys}
      >
        <option value="">—</option>
        {SECTORS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    );
  } else {
    const numeric = field === "cost" || field.startsWith("year");
    editor = (
      <input
        {...common}
        type="text"
        inputMode={numeric ? "numeric" : undefined}
        value={draft as string}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={keys}
      />
    );
  }

  return (
    <div
      data-cell-editor={name}
      className="flex flex-col gap-0.5"
      onBlur={onBlur}
    >
      {editor}
      {error && (
        <span id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}

/** S3-10: Base UI Combobox, multiple, filtered by typing, chips by name. */
function BarangayEditor({
  name,
  codes,
  onChange,
  onEnter,
  onEscape,
  query,
}: {
  name: string;
  codes: string[];
  onChange: (codes: string[]) => void;
  onEnter: () => void;
  onEscape: () => void;
  query: ReturnType<typeof useBarangays>;
}) {
  const chipsRef = useRef<HTMLDivElement>(null);
  // Read in the capture phase, before the combobox handles the key, so Enter
  // picks an item and Escape closes the list while the list is open.
  const listOpen = useRef(false);

  if (query.isPending) {
    return (
      <input
        aria-label={name}
        autoFocus
        readOnly
        value="Loading barangays…"
        onKeyDown={(e) => e.key === "Escape" && onEscape()}
        className="w-full rounded border border-input px-1 py-0.5 text-sm text-muted-foreground"
      />
    );
  }
  if (query.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-1 text-xs">
        <span className="text-destructive">
          Couldn&apos;t load barangays. {query.error.message}
        </span>
        <button
          type="button"
          autoFocus
          aria-label={`Retry loading barangays for ${name}`}
          className="underline"
          onClick={() => void query.refetch()}
          onKeyDown={(e) => e.key === "Escape" && onEscape()}
        >
          Retry
        </button>
      </div>
    );
  }

  const all = query.data;
  const picked = codes
    .map((c) => all.find((b) => b.psgc_code === c))
    .filter((b): b is Barangay => b !== undefined);

  return (
    <div
      onKeyDownCapture={(e) => {
        if (listOpen.current) return;
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          onEnter();
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onEscape();
        }
      }}
    >
      <Combobox.Root
        items={all}
        multiple
        value={picked}
        onValueChange={(next) => onChange(next.map((b) => b.psgc_code))}
        onOpenChange={(open) => {
          listOpen.current = open;
        }}
        itemToStringLabel={(b) => b.name}
        isItemEqualToValue={(a, b) => a.psgc_code === b.psgc_code}
      >
        <Combobox.Chips
          ref={chipsRef}
          className="flex min-w-56 flex-wrap items-center gap-1 rounded border border-input bg-background p-1 focus-within:ring-2 focus-within:ring-ring"
        >
          <Combobox.Value>
            {(value: Barangay[]) => (
              <>
                {value.map((b) => (
                  <Combobox.Chip
                    key={b.psgc_code}
                    aria-label={b.name}
                    className="flex items-center gap-1 rounded bg-muted px-1.5 text-xs"
                  >
                    {b.name}
                    <Combobox.ChipRemove
                      aria-label={`Remove ${b.name}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </Combobox.ChipRemove>
                  </Combobox.Chip>
                ))}
                <Combobox.Input
                  aria-label={name}
                  autoFocus
                  placeholder={value.length ? "" : "Type a barangay"}
                  className="min-w-20 flex-1 bg-transparent px-1 text-sm outline-none"
                />
              </>
            )}
          </Combobox.Value>
        </Combobox.Chips>
        <Combobox.Portal>
          <Combobox.Positioner
            anchor={chipsRef}
            sideOffset={4}
            className="z-50"
            data-cell-editor={name}
          >
            <Combobox.Popup className="max-h-64 min-w-56 overflow-y-auto rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-md">
              <Combobox.Empty className="px-2 py-1 text-muted-foreground empty:hidden">
                No barangay matches.
              </Combobox.Empty>
              <Combobox.List>
                {(b: Barangay) => (
                  <Combobox.Item
                    key={b.psgc_code}
                    value={b}
                    className="flex cursor-default items-center gap-2 rounded px-2 py-1 data-highlighted:bg-muted"
                  >
                    <Combobox.ItemIndicator className="w-3">
                      ✓
                    </Combobox.ItemIndicator>
                    {b.name}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </div>
  );
}
