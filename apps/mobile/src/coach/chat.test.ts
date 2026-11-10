import { expect, test } from "vitest";
import { buildRequest, formatCitations, mapError, sendChat, MAX_MESSAGES, type Citation } from "./chat.ts";

const c = (id: string): Citation => ({ id, title: `T ${id}`, url: `https://x/${id}`, grade: "A" });

test("request ends with the trimmed user turn and starts with a user turn when capped", () => {
  const hist = Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? ("assistant" as const) : ("user" as const), content: `m${i}` }));
  const { messages } = buildRequest(hist, "  hi ");
  expect(messages.at(-1)).toEqual({ role: "user", content: "hi" });
  expect(messages.length).toBeLessThanOrEqual(MAX_MESSAGES);
  expect(messages[0].role).toBe("user");
});

test("status maps to error kind", () => {
  expect([0, 503, 401, 502, 400].map(mapError)).toEqual(["offline", "aiNotConfigured", "badToken", "other", "other"]);
});

test("citations numbered by first use, unknown ids kept, unmarked ones still listed", () => {
  const r = formatCitations("Go easy [b] then [a] and [b] [zzz].", [c("a"), c("b"), c("d")]);
  expect(r.text).toBe("Go easy [1] then [2] and [1] [zzz].");
  expect(r.chips.map((x) => x.label)).toEqual(["T b (A)", "T a (A)", "T d (A)"]);
});

test("sendChat covers not configured, offline, 503 and success", async () => {
  const cfg = { url: "http://h/", token: "t" };
  const msgs = [{ role: "user" as const, content: "x" }];
  expect(await sendChat(undefined, msgs)).toEqual({ ok: false, error: "notConfigured" });
  expect(await sendChat(cfg, msgs, (() => Promise.reject(new Error("net"))) as typeof fetch)).toEqual({ ok: false, error: "offline" });
  expect(await sendChat(cfg, msgs, (async () => new Response("{}", { status: 503 })) as typeof fetch)).toEqual({ ok: false, error: "aiNotConfigured" });
  let seen = "";
  const ok = (async (u: string, init: RequestInit) => {
    seen = u + (init.headers as Record<string, string>).authorization;
    return new Response(JSON.stringify({ text: "hi", citations: [], redFlag: true }));
  }) as unknown as typeof fetch;
  expect(await sendChat(cfg, msgs, ok)).toEqual({ ok: true, reply: { text: "hi", citations: [], redFlag: true, proposals: [], refusals: [] } });
  expect(seen).toBe("http://h/api/coach/chatBearer t");
});

test("proposals and refusals from the server reach the reply", async () => {
  const body = { text: "t", proposals: [{ change: { kind: "move" }, session: { id: "s" } }], refusals: ["refused: x"] };
  const f = (async () => new Response(JSON.stringify(body))) as unknown as typeof fetch;
  const r = await sendChat({ url: "http://s", token: "t" }, [{ role: "user", content: "q" }], f);
  expect(r).toMatchObject({ ok: true, reply: { proposals: body.proposals, refusals: ["refused: x"] } });
});
