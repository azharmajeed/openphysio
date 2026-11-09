import { fileURLToPath } from "node:url";
import { coachNote, injury, newRow } from "@openphysio/core";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { expect, test, vi } from "vitest";
import type { AiProvider, ChatInput } from "../ai/index.ts";
import { mockProvider } from "../ai/mock.ts";
import { createApp } from "../app.ts";
import { MAX_TURNS } from "./coach.ts";
import { detectRedFlag } from "./redflags.ts";

const migrationsFolder = fileURLToPath(
  new URL("../../../../packages/core/drizzle", import.meta.url),
);
const mem = () => {
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder });
  return db;
};
const post = (app: ReturnType<typeof createApp>, content: string) =>
  app.request("/api/coach/chat", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer t" },
    body: JSON.stringify({ messages: [{ role: "user", content }] }),
  });
type Reply = {
  text: string;
  citations: { id: string; title: string; url: string; grade: string }[];
  redFlag: boolean;
};

test("red flags trigger on many phrasings", () => {
  for (const s of [
    "I have chest pain when I run",
    "I fainted after my set",
    "felt like I'd pass out",
    "numbness spreading down my leg",
    "tingling in both feet",
    "my knee pain wakes me up at night",
    "night pain in my shin",
    "my ankle swelled up suddenly",
    "sudden swelling in the knee",
    "I can't bear weight on my foot",
    "I cannot put weight on it",
    "unable to walk since the fall",
    "I have a fever and my joints hurt",
    "knee pain and a high temperature",
    "I've lost bladder control",
    "sudden severe headache",
  ])
    expect(detectRedFlag(s), s).toBe(true);
});

test("negations and benign messages do not trigger", () => {
  for (const s of [
    "no chest pain, just sore quads",
    "I did not faint, just tired",
    "without any numbness or tingling in my leg",
    "I never get night pain",
    "no fever, knee pain is mild",
    "knee hurts but no swelling overnight",
    "what should I eat after a run?",
    "how do I progress squats with a sore knee?",
  ])
    expect(detectRedFlag(s), s).toBe(false);
  // negation applies per clause: the second symptom still triggers
  expect(detectRedFlag("no chest pain, but I fainted")).toBe(true);
});

test("red flag bypasses the model and returns the stop reply", async () => {
  const chat = vi.fn();
  const db = mem();
  const app = createApp({ token: "t", db, ai: { ...mockProvider, chat } });
  const r = (await (await post(app, "I have chest pain")).json()) as Reply;
  expect(chat).not.toHaveBeenCalled();
  expect(r).toMatchObject({ redFlag: true, citations: [] });
  expect(r.text).toMatch(/stop training/i);
  expect((await db.select().from(coachNote))[0]!.body).toMatch(/red flag/);
});

test("mock tool loop reads DB, injuries always in system prompt, coach_note saved", async () => {
  const db = mem();
  await db
    .insert(injury)
    .values({ ...newRow(), bodyArea: "knee", description: "patellar tendon", status: "active" });
  const seen: ChatInput[] = [];
  const spy: AiProvider = {
    ...mockProvider,
    chat: (i) => (seen.push(structuredClone(i)), mockProvider.chat(i)),
  };
  const r = (await (
    await post(createApp({ token: "t", db, ai: spy }), "plan? [tool:get_injuries]")
  ).json()) as Reply;
  expect(r.redFlag).toBe(false);
  expect(seen).toHaveLength(2); // tool call turn, then final
  for (const i of seen) expect(i.system).toContain("patellar tendon");
  expect(JSON.stringify(seen[1]!.messages)).toContain("patellar tendon"); // tool result fed back
  const notes = await db.select().from(coachNote);
  expect(notes).toHaveLength(1);
  expect(notes[0]!.body).toContain("read: get_injuries");
});

test("every tool runs against an empty DB", async () => {
  const db = mem();
  for (const t of [
    "get_profile",
    "get_injuries",
    "get_plan",
    "get_logs",
    "get_recovery",
    "search_knowledge",
  ]) {
    const r = await post(createApp({ token: "t", db }), `[tool:${t}]`);
    expect(r.status, t).toBe(200);
  }
});

test("tool loop stops after 5 model turns", async () => {
  const chat = vi.fn<AiProvider["chat"]>(async () => ({
    text: "",
    toolCalls: [{ id: "x", name: "get_profile", input: {} }],
  }));
  const r = (await (
    await post(createApp({ token: "t", db: mem(), ai: { ...mockProvider, chat } }), "hi")
  ).json()) as Reply;
  expect(chat).toHaveBeenCalledTimes(MAX_TURNS);
  expect(r.text).toMatch(/could not finish/);
});

test("citations resolve to title/url/grade; unknown ids dropped", async () => {
  const ai: AiProvider = {
    ...mockProvider,
    chat: async () => ({
      text: "Build load gradually [src-ioc-load-2016] and [src-made-up] see [src-ioc-load-2016] and [1].",
      toolCalls: [],
    }),
  };
  const r = (await (
    await post(createApp({ token: "t", db: mem(), ai }), "how to ramp up?")
  ).json()) as Reply;
  expect(r.citations).toEqual([
    {
      id: "src-ioc-load-2016",
      title: "IOC consensus on load in sport and injury risk",
      url: "https://nih.brage.unit.no/nih-xmlui/handle/11250/2408720",
      grade: "A",
    },
  ]);
});

test("validation and auth", async () => {
  const app = createApp({ token: "t", db: mem() });
  const bad = await app.request("/api/coach/chat", {
    method: "POST",
    headers: { authorization: "Bearer t" },
    body: JSON.stringify({ messages: [{ role: "assistant", content: "x" }] }),
  });
  expect(bad.status).toBe(400);
  const noAuth = await app.request("/api/coach/chat", { method: "POST", body: "{}" });
  expect(noAuth.status).toBe(401);
});
