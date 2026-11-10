import { exercises } from "@openphysio/catalog";
import { describe, expect, test } from "vitest";
import { ADAPT_CONFIG, adaptNextWeek, weekWindow, type AdaptInput } from "./adapt.ts";
import type { PlanItem, PlannedSessionRow } from "./generate.ts";

const NOW = Date.parse("2026-11-15T12:00:00Z"); // last day of plan week 1
const DAY = 86_400_000;
const item = (exerciseId: string, sets = 3, muscles = ["quads"]): PlanItem => ({ exerciseId, block: "lower_strength", sets, amount: 10, unit: "reps", restSec: 75, notes: "", muscles });
const row = (id: string, date: string, status: PlannedSessionRow["status"], items: PlanItem[] = []): PlannedSessionRow =>
  ({ id, date, status, type: "gym", title: `S ${id}`, warmup: [], items, updatedAt: 1, deletedAt: null }) as PlannedSessionRow;
const week = (status: PlannedSessionRow["status"]) => [row("a", "2026-11-09", status), row("b", "2026-11-11", status), row("c", "2026-11-13", status)];
const nextWeek = [row("n1", "2026-11-16", "planned", [item("goblet_squat"), item("glute_bridge", 3, ["glutes"])]), row("n2", "2026-11-19", "planned", [item("dumbbell_lunge", 2)])];
const sets = (id: string, rpe: number | null, n = 3) => Array.from({ length: n }, () => ({ exerciseId: id, rpe, at: NOW - DAY }));
const hist = (muscle: string, v: number) => ({ runs: [], plyoContacts: [], hardSetsByMuscle: { [muscle]: [{ at: NOW - 3 * DAY, sets: v }] } });
const base: AdaptInput = { block: [...week("done"), ...nextWeek], logs: [], pain: [], recovery: [], exercises: exercises as never, history: { runs: [], plyoContacts: [], hardSetsByMuscle: {} }, now: NOW };
const run = (o: Partial<AdaptInput> = {}) => adaptNextWeek({ ...base, ...o });

describe("adaptNextWeek", () => {
  test("weekWindow finds this and next plan week, null at the end of the plan", () => {
    expect(weekWindow(base.block, "2026-11-15")?.next).toEqual({ start: "2026-11-16", end: "2026-11-22" });
    expect(weekWindow(base.block, "2026-11-20")).toBeNull();
  });

  test("nothing logged, nothing to change", () => {
    const r = run({ block: [...week("planned").map((s) => ({ ...s, date: "2026-11-20" })), ...nextWeek] });
    expect(r.sessions).toEqual([]);
  });

  test("missed sessions are noted and not stacked into next week", () => {
    const r = run({ block: [row("a", "2026-11-09", "done"), row("b", "2026-11-11", "skipped"), row("c", "2026-11-13", "planned"), ...nextWeek] });
    const keep = r.changes.filter((c) => c.kind === "keep");
    expect(keep.map((c) => c.sessionId)).toEqual(["b", "c"]);
    expect(keep[0]!.reason).toMatch(/not added/);
    expect(r.sessions).toEqual([]);
  });

  test("RPE 9 on average regresses to the catalogue easier variant; 8.5 does not", () => {
    const r = run({ logs: sets("goblet_squat", ADAPT_CONFIG.rpeHigh) });
    const c = r.changes.find((c) => c.kind === "regress")!;
    expect([c.from, c.to]).toEqual(["goblet squat", "bodyweight squat"]);
    expect(r.sessions.find((s) => s.id === "n1")!.items[0]!.exerciseId).toBe("bodyweight_squat");
    expect(r.sessions[0]!.updatedAt).toBe(NOW);
    expect(run({ logs: sets("goblet_squat", 8.5) }).changes.some((c) => c.kind === "regress")).toBe(false);
  });

  test("RPE too high with no easier version lowers sets by one", () => {
    const r = run({ logs: sets("bodyweight_squat", 10), block: [...week("done"), row("n1", "2026-11-16", "planned", [item("bodyweight_squat", 3)])] });
    expect(r.changes.find((c) => c.kind === "lower_intensity")).toMatchObject({ from: "3 sets", to: "2 sets" });
  });

  test("pain advice easier_variant regresses exercises that load that area", () => {
    const r = run({ pain: [{ bodyArea: "knee", score: 6, kind: "ache", at: NOW - DAY }] });
    expect(r.changes.filter((c) => c.kind === "regress").length).toBeGreaterThan(0);
    expect(r.changes.every((c) => c.kind !== "remove")).toBe(true);
  });

  test("pain stop removes exercises loading the area (from catalogue loads), flags it, keeps others", () => {
    const r = run({ pain: [{ bodyArea: "knee", score: 3, kind: "sharp", at: NOW - DAY }] });
    const removed = r.changes.filter((c) => c.kind === "remove");
    expect(removed.map((c) => c.exerciseId)).toEqual(expect.arrayContaining(["goblet_squat", "dumbbell_lunge"]));
    expect(removed.every((c) => c.flag && /physio/.test(c.reason))).toBe(true);
    const n1 = r.sessions.find((s) => s.id === "n1")!;
    expect(n1.items.map((i) => i.exerciseId)).toEqual(["glute_bridge"]);
  });

  test("good week with manageable RPE progresses one set within the spike guard", () => {
    const r = run({ logs: sets("goblet_squat", 7), history: hist("quads", 6) });
    expect(r.changes.find((c) => c.kind === "progress")).toMatchObject({ exerciseId: "goblet_squat", from: "3 sets", to: "4 sets", grade: "C" });
    expect(r.sessions.find((s) => s.id === "n1")!.items[0]!.sets).toBe(4);
  });

  test("progression is blocked when it would break the spike guard, or with no history", () => {
    expect(run({ logs: sets("goblet_squat", 7), history: hist("quads", 3) }).changes.some((c) => c.kind === "progress")).toBe(false);
    expect(run({ logs: sets("goblet_squat", 7) }).changes.some((c) => c.kind === "progress")).toBe(false);
  });

  test("poor completion does not progress", () => {
    const block = [row("a", "2026-11-09", "done"), row("b", "2026-11-11", "skipped"), row("c", "2026-11-13", "skipped"), ...nextWeek];
    expect(run({ block, logs: sets("goblet_squat", 7), history: hist("quads", 6) }).changes.some((c) => c.kind === "progress")).toBe(false);
  });

  test("poor sleep lowers intensity one notch, labelled grade C, and blocks progression", () => {
    const recovery = [0, 1, 2].map((d) => ({ date: new Date(NOW - d * DAY).toISOString().slice(0, 10), sleepMin: ADAPT_CONFIG.sleepLowMin - 60, restingHr: 55 }));
    const r = run({ recovery, logs: sets("goblet_squat", 7), history: hist("quads", 6) });
    const low = r.changes.filter((c) => c.kind === "lower_intensity");
    expect(low).toHaveLength(2);
    expect(low[0]).toMatchObject({ grade: "C", sourceIds: ["src-ioc-load-2016"] });
    expect(low[0]!.reason).toMatch(/slept/);
    expect(r.sessions.find((s) => s.id === "n1")!.items.map((i) => i.sets)).toEqual([2, 2]);
    expect(r.changes.some((c) => c.kind === "progress")).toBe(false);
  });

  test("resting HR spike lowers intensity; normal HR does not", () => {
    const rows = (recent: number) => Array.from({ length: 10 }, (_, d) => ({ date: new Date(NOW - d * DAY).toISOString().slice(0, 10), sleepMin: 450, restingHr: d < 3 ? recent : 50 }));
    expect(run({ recovery: rows(58) }).changes.find((c) => c.kind === "lower_intensity")?.reason).toMatch(/resting heart rate/);
    expect(run({ recovery: rows(52) }).changes.some((c) => c.kind === "lower_intensity")).toBe(false);
  });

  test("does not mutate its input", () => {
    const snap = JSON.stringify(base.block);
    run({ pain: [{ bodyArea: "knee", score: 3, kind: "sharp", at: NOW }] });
    expect(JSON.stringify(base.block)).toBe(snap);
  });
});
