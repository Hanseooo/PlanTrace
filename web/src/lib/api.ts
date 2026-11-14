import type { components } from "./api-types";

// API shapes come only from the generated types (CODING_STANDARDS section 1).
export type Schemas = components["schemas"];

// Baked in at build time: set it before `next build` (issue #5 Guidance).
export const API_URL = process.env.NEXT_PUBLIC_API_URL;

/** An API answer that wasn't 2xx. `status` tells a 404 from other errors (S2-09). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Send one request. Errors carry a message the screen can show. */
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_URL) throw new Error("NEXT_PUBLIC_API_URL is not set.");
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new Error("Can't reach the PlanTrace API. Check that it is running.");
  }
  if (!res.ok) {
    // FastAPI's HTTPException body is {"detail": "<message>"}; show it when present.
    const body: unknown = await res.json().catch(() => null);
    const detail =
      body && typeof body === "object" && "detail" in body ? body.detail : null;
    throw new ApiError(
      typeof detail === "string"
        ? `${detail}.`
        : `The PlanTrace API answered ${res.status}.`,
      res.status,
    );
  }
  return (await res.json()) as T;
}

/** GET a JSON body from the API. */
export function apiGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path);
}

/** POST a multipart form (an upload) and read the JSON answer. */
export function apiPostForm<T>(path: string, form: FormData): Promise<T> {
  return apiFetch<T>(path, { method: "POST", body: form });
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
