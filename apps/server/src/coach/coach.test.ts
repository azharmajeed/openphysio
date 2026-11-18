import { fileURLToPath } from "node:url";
import { coachNote, injury, newRow, plannedSession, setLog, workout } from "@openphysio/core";
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
}, 30_000); // six app setups with migrations: slow when the machine is busy

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

// --- A3: propose_plan_change ---
type Proposed = Reply & {
  proposals: { change: { kind: string; from: string; to: string; sessionId: string }; session: { items: { exerciseId: string; sets: number }[] } }[];
  refusals: string[];
};
const item = (exerciseId: string, sets: number, muscles = ["quads"]) => ({
  exerciseId, block: "main", sets, amount: 10, unit: "reps", restSec: 60, notes: "", muscles,
});
function seed(db: ReturnType<typeof mem>) {
  const row = { ...newRow(), date: "2099-01-05", type: "gym" as const, title: "Legs", warmup: [], items: [item("goblet_squat", 3)], status: "planned" as const };
  db.insert(plannedSession).values(row).run();
  return row.id;
}
/** Stub model: first turn emits the propose call, second turn answers. */
async function propose(db: ReturnType<typeof mem>, input: Record<string, unknown>) {
  let n = 0;
  const ai: AiProvider = {
    ...mockProvider,
    chat: async () =>
      n++ === 0
        ? { text: "", toolCalls: [{ id: "p1", name: "propose_plan_change", input: { reason: "because", ...input } }] }
        : { text: "ok", toolCalls: [] },
  };
  return (await (await post(createApp({ token: "t", db, ai }), "change my plan")).json()) as Proposed;
}
const sessionItems = (db: ReturnType<typeof mem>) => db.select().from(plannedSession).all()[0]!.items;

test("valid proposal is returned for confirmation and changes nothing on the server", async () => {
  const db = mem();
  const sessionId = seed(db);
  const r = await propose(db, { kind: "swap", sessionId, exerciseId: "goblet_squat", toExerciseId: "terminal_knee_extension" });
  expect(r.refusals).toEqual([]);
  expect(r.proposals).toHaveLength(1);
  expect(r.proposals[0]!.change).toMatchObject({ kind: "swap", sessionId, from: "goblet squat", to: "terminal knee extension" });
  expect(r.proposals[0]!.session.items[0]!.exerciseId).toBe("terminal_knee_extension");
  expect(sessionItems(db)[0]!.exerciseId).toBe("goblet_squat");
  const v = await propose(db, { kind: "volume", sessionId, exerciseId: "goblet_squat", sets: 4 });
  expect(v.proposals[0]!.change).toMatchObject({ kind: "volume", from: "3 x 10 reps", to: "4 x 10 reps" });
  const m = await propose(db, { kind: "move", sessionId, toDate: "2099-01-06" });
  expect(m.proposals[0]!.change).toMatchObject({ kind: "move", from: "2099-01-05", to: "2099-01-06" });
});

test("injury-breaking proposal is refused with a reason", async () => {
  const db = mem();
  const sessionId = seed(db);
  db.insert(injury).values({ ...newRow(), bodyArea: "knee", avoidAreas: ["knee"], status: "active" }).run();
  const r = await propose(db, { kind: "swap", sessionId, exerciseId: "goblet_squat", toExerciseId: "leg_press" });
  expect(r.proposals).toEqual([]);
  expect(r.refusals[0]).toMatch(/^refused: leg press is not safe with your injury/);
  // easing the already-planned exercise is still allowed
  const down = await propose(db, { kind: "volume", sessionId, exerciseId: "goblet_squat", sets: 2 });
  expect(down.proposals).toHaveLength(1);
});

test("spike-breaking proposal is refused with the percentage over the 30-day max", async () => {
  const db = mem();
  const sessionId = seed(db);
  const w = { ...newRow(), type: "gym" as const, startedAt: Date.now() - 2 * 864e5 };
  db.insert(workout).values(w).run();
  for (let i = 0; i < 3; i++)
    db.insert(setLog).values({ ...newRow(), workoutId: w.id, exerciseId: "goblet_squat", setIndex: i, rpe: 8 }).run();
  const r = await propose(db, { kind: "volume", sessionId, exerciseId: "goblet_squat", sets: 6 });
  expect(r.proposals).toEqual([]);
  expect(r.refusals[0]).toBe("refused: exceeds your 30-day max by 100% (quads sets; the limit is 10% above it)");
  expect(sessionItems(db)[0]!.sets).toBe(3);
});

test("bad proposals are refused and the reason goes back to the model", async () => {
  const db = mem();
  const sessionId = seed(db);
  const seen: ChatInput[] = [];
  const ai: AiProvider = {
    ...mockProvider,
    chat: async (i) => {
      seen.push(structuredClone(i));
      return seen.length === 1
        ? { text: "", toolCalls: [{ id: "p1", name: "propose_plan_change", input: { kind: "move", sessionId, toDate: "2001-01-01", reason: "x" } }] }
        : { text: "ok", toolCalls: [] };
    },
  };
  const r = (await (await post(createApp({ token: "t", db, ai }), "move it")).json()) as Proposed;
  expect(r.refusals).toEqual(["refused: that date is in the past"]);
  expect(JSON.stringify(seen[1]!.messages)).toContain("refused: that date is in the past");
  for (const bad of [{ kind: "swap", sessionId: "nope" }, { kind: "swap", sessionId, exerciseId: "goblet_squat", toExerciseId: "zzz" }, { kind: "volume", sessionId, exerciseId: "goblet_squat", sets: -1 }]) {
    const b = await propose(db, bad);
    expect(b.proposals).toEqual([]);
    expect(b.refusals[0]).toMatch(/^refused: /);
  }
});
