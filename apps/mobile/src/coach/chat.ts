export type Msg = { role: "user" | "assistant"; content: string };
export type Citation = { id: string; title: string; url: string; grade: "A" | "B" | "C" };
import type { AdaptChange, PlannedSessionRow } from "@openphysio/core";

/** A change the server already checked against injuries and the load cap. Nothing is saved until Apply. */
export type Proposal = { change: AdaptChange; session: PlannedSessionRow };
export type Reply = { text: string; citations: Citation[]; redFlag: boolean; proposals: Proposal[]; refusals: string[] };
export type ChatError = "notConfigured" | "offline" | "aiNotConfigured" | "badToken" | "other";
export type ChatResult = { ok: true; reply: Reply } | { ok: false; error: ChatError };

/** The server keeps no chat state, so the whole (capped) conversation goes each time. */
export const MAX_MESSAGES = 30;

export function buildRequest(history: Msg[], userText: string) {
  const messages = [...history, { role: "user" as const, content: userText.trim() }].slice(-MAX_MESSAGES);
  // Drop a leading assistant turn left by the cap so the conversation starts with the user.
  while (messages[0]?.role === "assistant") messages.shift();
  return { messages };
}

/** HTTP status (0 = network failure) to an error kind. */
export function mapError(status: number): ChatError {
  if (status === 0) return "offline";
  if (status === 503) return "aiNotConfigured";
  if (status === 401) return "badToken";
  return "other";
}

export const ERROR_TEXT: Record<ChatError, string> = {
  notConfigured: "Coach needs your server. Set the server URL and token in Settings.",
  offline: "You are offline or the server cannot be reached. Your message was not sent. Try again when you are connected.",
  aiNotConfigured: "The AI coach is not switched on on your server yet.",
  badToken: "The server did not accept your token. Check it in Settings.",
  other: "The coach hit a problem. Please try again in a moment.",
};

/** Replaces inline [id] with [n] for resolved citations and lists them as chips; unknown ids are left alone. */
export function formatCitations(text: string, citations: Citation[]) {
  const byId = new Map(citations.map((c) => [c.id, c]));
  const used: Citation[] = [];
  const out = text.replace(/\[([^\]\s]+)\]/g, (m, id: string) => {
    const c = byId.get(id);
    if (!c) return m;
    if (!used.includes(c)) used.push(c);
    return `[${used.indexOf(c) + 1}]`;
  });
  // Citations the model did not mark inline are still shown.
  for (const c of citations) if (!used.includes(c)) used.push(c);
  return { text: out, chips: used.map((c, i) => ({ n: i + 1, label: `${c.title} (${c.grade})`, url: c.url })) };
}

export async function sendChat(
  cfg: { url: string; token: string } | undefined,
  messages: Msg[],
  doFetch: typeof fetch = fetch,
): Promise<ChatResult> {
  if (!cfg) return { ok: false, error: "notConfigured" };
  let res: Response;
  try {
    res = await doFetch(`${cfg.url.replace(/\/+$/, "")}/api/coach/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({ messages }),
    });
  } catch {
    return { ok: false, error: mapError(0) };
  }
  if (!res.ok) return { ok: false, error: mapError(res.status) };
  try {
    const j = (await res.json()) as Partial<Reply>;
    if (typeof j.text !== "string") return { ok: false, error: "other" };
    return { ok: true, reply: { text: j.text, citations: j.citations ?? [], redFlag: j.redFlag === true, proposals: j.proposals ?? [], refusals: j.refusals ?? [] } };
  } catch {
    return { ok: false, error: "other" };
  }
}
