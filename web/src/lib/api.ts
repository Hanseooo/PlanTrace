import type { components } from "./api-types";

// API shapes come only from the generated types (CODING_STANDARDS section 1).
export type Schemas = components["schemas"];

// Baked in at build time: set it before `next build` (issue #5 Guidance).
export const API_URL = process.env.NEXT_PUBLIC_API_URL;

/** GET a JSON body from the API. Errors carry a message the screen can show. */
export async function apiGet<T>(path: string): Promise<T> {
  if (!API_URL) throw new Error("NEXT_PUBLIC_API_URL is not set.");
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`);
  } catch {
    throw new Error("Can't reach the PlanTrace API. Check that it is running.");
  }
  if (!res.ok) throw new Error(`The PlanTrace API answered ${res.status}.`);
  return (await res.json()) as T;
}

export const pesos = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

export function years(start: number | null, end: number | null): string {
  if (start === null) return "—";
  return end === null || end === start ? `${start}` : `${start}–${end}`;
}
