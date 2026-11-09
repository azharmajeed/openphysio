import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { expect, test, vi } from "vitest";
import { createApp } from "../app.ts";
import { anthropicProvider } from "./anthropic.ts";
import { createProvider } from "./index.ts";
import { mockProvider } from "./mock.ts";

const user = (content: string) => [{ role: "user" as const, content }];

test("mock: canned reply, tool call on [tool:x], extract from required keys", async () => {
  expect((await mockProvider.chat({ messages: user("hi") })).text).toContain("hi");
  const r = await mockProvider.chat({ messages: user("do [tool:get_injuries]") });
  expect(r.toolCalls).toEqual([{ id: "mock_get_injuries", name: "get_injuries", input: {} }]);
  expect(await mockProvider.extract({ input: "x", schema: { required: ["a", "b"] } })).toEqual({
    a: "",
    b: "",
  });
});

const stub = (body: unknown, status = 200) =>
  vi.fn<(u: string, i?: RequestInit) => Promise<Response>>(
    async () => new Response(JSON.stringify(body), { status }),
  );

test("anthropic chat: request shape and tool_use parsing", async () => {
  const f = stub({
    content: [
      { type: "text", text: "ok" },
      { type: "tool_use", id: "tu1", name: "t", input: { a: 1 } },
    ],
  });
  const p = anthropicProvider({ apiKey: "k", model: "m", fetch: f as unknown as typeof fetch });
  const tools = [{ name: "t", description: "d", input_schema: { type: "object" } }];
  const r = await p.chat({ system: "s", messages: user("hi"), tools });
  expect(r).toEqual({ text: "ok", toolCalls: [{ id: "tu1", name: "t", input: { a: 1 } }] });
  const [url, init] = f.mock.calls[0]!;
  expect(url).toBe("https://api.anthropic.com/v1/messages");
  expect(init?.headers).toMatchObject({
    "x-api-key": "k",
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  });
  expect(JSON.parse(init!.body as string)).toMatchObject({
    model: "m",
    system: "s",
    tools,
    messages: user("hi"),
  });
});

test("anthropic extract: forced tool call and required-key check", async () => {
  const schema = { type: "object", required: ["a"] };
  const f = stub({ content: [{ type: "tool_use", id: "x", name: "extract", input: { a: 1 } }] });
  const p = anthropicProvider({ apiKey: "k", model: "m", fetch: f as unknown as typeof fetch });
  expect(await p.extract({ input: "i", schema })).toEqual({ a: 1 });
  expect(JSON.parse(f.mock.calls[0]![1]!.body as string).tool_choice).toEqual({
    type: "tool",
    name: "extract",
  });
  const bad = stub({ content: [{ type: "tool_use", id: "x", name: "extract", input: {} }] });
  await expect(
    anthropicProvider({ apiKey: "k", model: "m", fetch: bad as unknown as typeof fetch }).extract({
      input: "i",
      schema,
    }),
  ).rejects.toThrow(/missing keys: a/);
});

test("POST /api/ai/chat: auth, mock reply, 503 without key, no network", async () => {
  const net = vi.fn();
  vi.stubGlobal("fetch", net);
  const post = (app: ReturnType<typeof createApp>, auth = true) =>
    app.request("/api/ai/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(auth ? { authorization: "Bearer t" } : {}),
      },
      body: JSON.stringify({ messages: user("hello") }),
    });
  const db = drizzle(new Database(":memory:"));
  const mock = createApp({
    token: "t",
    db,
    ai: createProvider({ aiProvider: "mock", anthropicApiKey: "", aiModel: "m" }),
  });
  expect((await post(mock, false)).status).toBe(401);
  const ok = await post(mock);
  expect(ok.status).toBe(200);
  expect(((await ok.json()) as { text: string }).text).toContain("hello");
  const nokey = createApp({
    token: "t",
    db,
    ai: createProvider({ aiProvider: "anthropic", anthropicApiKey: "", aiModel: "m" }),
  });
  const r = await post(nokey);
  expect(r.status).toBe(503);
  expect(((await r.json()) as { error: string }).error).toMatch(/ANTHROPIC_API_KEY/);
  expect(net).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
