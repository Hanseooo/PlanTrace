import type { Schemas } from "./api";

type PlanStatus = Schemas["Plan"]["status"];

/** One label per status, shared by the plans list and the plan page (S2-05, S2-06). */
export const STATUS_LABELS: Record<PlanStatus, string> = {
  extracting: "Extracting PPAs",
  ready: "Ready to confirm",
  failed: "Extraction failed",
  confirmed: "Confirmed",
};

/** The badge colour per status, shared like the labels. */
export const STATUS_TONES = {
  extracting: "busy",
  ready: "warning",
  failed: "danger",
  confirmed: "success",
} as const satisfies Record<PlanStatus, string>;

/** Poll every 2 s while extracting, else stop (S2-05, S2-06). */
export const POLL_MS = 2000;

const MAX_UPLOAD_MB = 10;
export const FILE_RULE = `PDF only, up to ${MAX_UPLOAD_MB} MB.`;

/** S2-02's browser-side check: true when the file may be uploaded. */
export function isUploadablePdf(file: File): boolean {
  const pdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  return pdf && file.size <= MAX_UPLOAD_MB * 1024 * 1024;
}

// The submitted file, kept for Retry (D2, S2-04). Module state survives
// client-side navigation; a page reload loses it, by design.
const files = new Map<number, File>();

export function keepFile(planId: number, file: File): void {
  files.set(planId, file);
}

export function keptFile(planId: number): File | undefined {
  return files.get(planId);
}
