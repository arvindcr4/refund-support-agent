import type {
  ChatTurn,
  CustomerSummary,
  StateResponse,
  StreamEvent,
} from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export async function getCustomers(): Promise<CustomerSummary[]> {
  const res = await fetch(`${API_BASE}/api/customers`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /api/customers -> ${res.status}`);
  return res.json();
}

export async function getState(signal?: AbortSignal): Promise<StateResponse> {
  const res = await fetch(`${API_BASE}/api/state`, {
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error(`GET /api/state -> ${res.status}`);
  return res.json();
}

export async function resetDemo(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/reset`, { method: "POST" });
  if (!res.ok) throw new Error(`POST /api/reset -> ${res.status}`);
}

/**
 * POST to /api/chat and parse the SSE stream.
 */
export async function streamChat(
  message: string,
  history: ChatTurn[],
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`POST /api/chat -> ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const flush = (rawRecord: string) => {
    // Extract the data payload from the SSE record.
    const dataLines: string[] = [];
    for (const line of rawRecord.split("\n")) {
      const trimmed = line.replace(/\r$/, "");
      if (trimmed.startsWith("data:")) {
        dataLines.push(trimmed.slice(5).trimStart());
      }
    }
    if (dataLines.length === 0) return;
    const dataStr = dataLines.join("\n");
    if (!dataStr || dataStr === "[DONE]") return;
    try {
      const parsed = JSON.parse(dataStr) as StreamEvent;
      onEvent(parsed);
    } catch {
      // Ignore non-JSON keep-alives.
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE records are separated by a double newline.
    let sep = buffer.indexOf("\n\n");
    while (sep !== -1) {
      const record = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      flush(record);
      sep = buffer.indexOf("\n\n");
    }
  }

  // Flush any trailing record.
  if (buffer.trim()) flush(buffer);
}
