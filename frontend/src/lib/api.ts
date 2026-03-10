const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

// ── Chat API ───────────────────────────────────────────────────────────────

export interface Citation {
  // Backward-compat keys
  source: string;
  chunk_id: number;
  snippet: string;
  // Rich metadata for UI source cards
  display_title: string;
  display_url: string | null;
  source_type: string;          // "website" | "pdf" | "markdown" | "txt"
  section_heading: string | null;
  page_number: number | null;
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
  followups: string[];
}

export async function sendMessage(message: string): Promise<ChatResponse> {
  const res = await fetch(`${BACKEND_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }

  return res.json() as Promise<ChatResponse>;
}

// ── Admin API ──────────────────────────────────────────────────────────────

export interface Source {
  id: number;
  type: string;
  name: string;
  url: string | null;
  enabled: boolean;
  tags: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_fetched_at: string | null;
  doc_status: string | null;
  doc_error: string | null;
  chunk_count: number | null;
}

export interface IngestionRun {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: string;
  summary: Record<string, unknown>;
}

async function adminFetch(
  token: string,
  path: string,
  options: RequestInit = {}
): Promise<unknown> {
  const res = await fetch(`${BACKEND_URL}/admin${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export const adminApi = {
  listSources: (token: string) =>
    adminFetch(token, "/sources") as Promise<Source[]>,

  addUrl: (token: string, name: string, url: string) =>
    adminFetch(token, "/sources/url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, url }),
    }),

  uploadPdf: (token: string, name: string, file: File) => {
    const form = new FormData();
    form.append("name", name);
    form.append("file", file);
    return adminFetch(token, "/sources/pdf", { method: "POST", body: form });
  },

  toggleEnabled: (token: string, id: number, enabled: boolean) =>
    adminFetch(token, `/sources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    }),

  deleteSource: (token: string, id: number) =>
    adminFetch(token, `/sources/${id}`, { method: "DELETE" }),

  ingestAll: (token: string) =>
    adminFetch(token, "/ingest/run", { method: "POST" }),

  ingestOne: (token: string, id: number) =>
    adminFetch(token, `/ingest/source/${id}`, { method: "POST" }),

  listRuns: (token: string) =>
    adminFetch(token, "/ingest/runs") as Promise<IngestionRun[]>,
};
