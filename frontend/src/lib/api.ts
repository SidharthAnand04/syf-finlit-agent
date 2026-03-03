const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export interface Citation {
  source: string;
  chunk_id: number;
  snippet: string;
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
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
