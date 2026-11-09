import { exercises } from "@openphysio/catalog";
import { describe, expect, test } from "vitest";
import { SPIKE_FACTOR } from "../safety/index.ts";
import type { NewPlannedSession } from "../types/index.ts";
import {
  generateBlock,
  STARTER,
  type GenerateBlockInput,
  type PlanHistory,
  type PlannedSessionRow,
} from "./generate.ts";

const START = "2026-11-09"; // Monday
const startMs = Date.parse(`${START}T12:00:00Z`);
const empty: PlanHistory = { runs: [], plyoContacts: [], hardSetsByMuscle: {} };
const byId = new Map(exercises.map((e) => [e.id, e]));

const gen = (o: Partial<GenerateBlockInput> = {}) =>
  generateBlock({
    profile: { equipment: ["band", "dumbbell", "gym"], poolDays: [2, 0] },
    injuries: [],
    exercises,
    history: empty,
    startDate: START,
    seed: 7,
    now: 1,
    ...o,
  });

const week = (rows: PlannedSessionRow[], w: number) =>
  rows.filter((r) => {
    const d = (Date.parse(`${r.date}T12:00:00Z`) - startMs) / 86_400_000;
    return d >= w * 7 && d < w * 7 + 7;
  });
const dow = (r: PlannedSessionRow) => new Date(`${r.date}T12:00:00Z`).getUTCDay();
const blocks = (rows: PlannedSessionRow[], b: string) =>
  rows.filter((r) => r.items.some((i) => i.block === b));
const days = (rows: PlannedSessionRow[], b: string) =>
  new Set(blocks(rows, b).map((r) => r.date)).size;
const all = (rows: PlannedSessionRow[]) => rows.flatMap((r) => [...r.warmup, ...r.items]);

describe("generateBlock", () => {
  const rows = gen();

  test("rows are insertable planned_session rows covering 28 days", () => {
    const row: NewPlannedSession = rows[0]!;
    expect(row.status).toBe("planned");
    expect(rows.every((r) => r.id && r.deletedAt === null)).toBe(true);
    expect(
      Math.max(...rows.map((r) => Date.parse(r.date))) - Date.parse(START),
    ).toBeLessThanOrEqual(27 * 86_400_000);
  });

  test("AC-3: weekly counts", () => {
    for (let w = 0; w < 4; w++) {
      const wk = week(rows, w);
      expect(
        wk.filter((r) => r.type === "run"),
        `w${w} runs`,
      ).toHaveLength(3);
      const swims = wk.filter((r) => r.type === "swim").length;
      expect(swims).toBeGreaterThanOrEqual(1);
      expect(swims).toBeLessThanOrEqual(2);
      expect(
        wk.filter((r) => r.type === "plyo"),
        `w${w} plyo`,
      ).toHaveLength(2);
      expect(days(wk, "back_core")).toBeGreaterThanOrEqual(2);
      expect(days(wk, "lower_strength") + days(wk, "upper_strength")).toBeGreaterThanOrEqual(2);
      expect(
        wk.every((r) => r.warmup.length > 0),
        "warm-up everywhere",
      ).toBe(true);
    }
  });

  test("run kinds: easy, quality, long", () => {
    const ids = week(rows, 0).flatMap((r) =>
      r.type === "run" ? r.items.map((i) => i.exerciseId) : [],
    );
    expect(ids).toEqual(["run_intervals", "run_long", "run_easy"]);
  });

  test("weeks 1-3 build, week 4 deloads", () => {
    const vol = (w: number) =>
      week(rows, w).reduce(
        (n, r) => n + r.items.reduce((m, i) => m + i.sets * (i.block === "run" ? i.amount : 1), 0),
        0,
      );
    expect(vol(3)).toBeLessThan(vol(2) * 0.8);
    const long = (w: number) =>
      Math.max(
        ...week(rows, w).flatMap((r) =>
          r.items.filter((i) => i.block === "run").map((i) => i.distanceM!),
        ),
      );
    expect(long(1)).toBeGreaterThan(long(0));
    expect(long(2)).toBeGreaterThan(long(1));
    expect(long(3)).toBeLessThan(long(2) * 0.7);
  });

  test("deterministic per seed, rotates choices, differs across seeds", () => {
    const strip = (rs: PlannedSessionRow[]) => JSON.stringify(rs.map((r) => ({ ...r, id: 0 })));
    expect(strip(gen())).toBe(strip(gen()));
    expect(strip(gen({ seed: 8 }))).not.toBe(strip(gen({ seed: 7 })));
    const lower = (w: number) =>
      week(rows, w)
        .find((r) => r.title.startsWith("Lower"))!
        .items.map((i) => i.exerciseId)
        .join();
    expect(lower(0)).not.toBe(lower(1));
  });

  test("every exercise passes the injury filter (knee injury)", () => {
    const r = gen({ injuries: [{ status: "active", avoidAreas: ["knee"], deletedAt: null }] });
    expect(r.length).toBeGreaterThan(0);
    for (const i of all(r))
      expect(byId.get(i.exerciseId)!.avoidIf, i.exerciseId).not.toContain("knee");
    // low back too, and a resolved injury is ignored
    const r2 = gen({
      injuries: [
        { status: "recovering", avoidAreas: ["lower_back"], deletedAt: null },
        { status: "resolved", avoidAreas: ["knee"], deletedAt: null },
      ],
    });
    for (const i of all(r2)) expect(byId.get(i.exerciseId)!.avoidIf).not.toContain("lower_back");
    expect(all(r2).some((i) => i.exerciseId.startsWith("run_"))).toBe(true);
  });

  test("spike guard: history max 8 km caps long run at 8.8 km, and each run stays within 1.1 x prior max", () => {
    const r = gen({
      history: { ...empty, runs: [{ at: startMs - 5 * 86_400_000, distanceM: 8000 }] },
    });
    const runs = r.flatMap((x) =>
      x.type === "run"
        ? [{ at: Date.parse(`${x.date}T12:00:00Z`), d: x.items[0]!.distanceM! }]
        : [],
    );
    expect(Math.max(...runs.slice(0, 3).map((x) => x.d))).toBeLessThanOrEqual(8800);
    let prior = 8000;
    for (const x of runs) {
      expect(x.d).toBeLessThanOrEqual(prior * SPIKE_FACTOR + 1e-6);
      prior = Math.max(prior, x.d);
    }
  });

  test("no history: starter caps for runs and foot contacts", () => {
    for (const i of all(rows))
      if (i.block === "run")
        expect(i.distanceM!).toBeLessThanOrEqual(STARTER.runDistanceM * 1.1 ** 2);
    const first = week(rows, 0).filter((r) => r.type === "plyo");
    for (const s of first) {
      const c = s.items.reduce((n, i) => n + i.footContacts!, 0);
      expect(c).toBeGreaterThan(0);
      expect(c).toBeLessThanOrEqual(80);
    }
    expect(
      Math.max(
        ...week(rows, 0)
          .filter((r) => r.type === "run")
          .map((r) => r.items[0]!.distanceM!),
      ),
    ).toBeLessThanOrEqual(6000);
  });

  test("plyo contacts and hard sets respect history", () => {
    const at = startMs - 3 * 86_400_000;
    const r = gen({
      history: {
        runs: [],
        plyoContacts: [{ at, contacts: 30 }],
        hardSetsByMuscle: { quads: [{ at, sets: 2 }] },
      },
    });
    const contacts = r
      .filter((x) => x.type === "plyo")
      .map((x) => x.items.reduce((n, i) => n + i.footContacts!, 0));
    expect(contacts[0]).toBeLessThanOrEqual(33);
    let prior = 33;
    for (const c of contacts) {
      expect(c).toBeLessThanOrEqual(Math.floor(Math.max(30, prior) * 1.1 + 1e-9));
      prior = Math.max(prior, c);
    }
    const quads = r
      .filter((x) => x.title.startsWith("Lower"))
      .map((x) =>
        x.items.filter((i) => i.muscles.includes("quads")).reduce((n, i) => n + i.sets, 0),
      );
    expect(quads[0]).toBeLessThanOrEqual(2);
  });

  test("swims land on poolDays (fallback Tue/Sun)", () => {
    const swim = (r: PlannedSessionRow[]) => new Set(r.filter((x) => x.type === "swim").map(dow));
    expect(swim(gen({ profile: { equipment: [], poolDays: [1, 5] } }))).toEqual(new Set([1, 5]));
    expect(swim(gen({ profile: { equipment: [], poolDays: [] } }))).toEqual(new Set([2, 0]));
  });

  test("equipment: home-only never schedules gym exercises; gym only on the gym day", () => {
    const home = gen({ profile: { equipment: ["band", "dumbbell"], poolDays: [2, 0] } });
    expect(home.some((r) => r.type === "gym")).toBe(false);
    for (const i of all(home))
      expect(
        byId.get(i.exerciseId)!.equipment.some((q) => q !== "gym"),
        i.exerciseId,
      ).toBe(true);
    const none = gen({ profile: { equipment: [], poolDays: [] } });
    for (const i of all(none))
      expect(byId.get(i.exerciseId)!.equipment.includes("bodyweight"), i.exerciseId).toBe(true);
    const withGym = gen();
    expect(withGym.some((r) => r.type === "gym")).toBe(true);
    for (const r of withGym.filter((x) => x.type !== "gym"))
      for (const i of all([r]))
        expect(
          byId.get(i.exerciseId)!.equipment.some((q) => q !== "gym"),
          i.exerciseId,
        ).toBe(true);
  });

  test("print example week", () => {
    const lines = week(rows, 0).map((r) => {
      const fmt = (i: (typeof r.items)[number]) =>
        i.block === "run"
          ? `${i.exerciseId} ${i.amount}min (~${(i.distanceM! / 1000).toFixed(1)}km)`
          : i.footContacts
            ? `${i.exerciseId} ${i.sets}x${i.amount} (${i.footContacts} contacts)`
            : `${i.exerciseId} ${i.sets}x${i.amount}${i.unit === "reps" ? "" : i.unit[0]}`;
      return `${r.date} ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dow(r)]} [${r.type}] ${r.title}\n    warmup: ${r.warmup.map((i) => i.exerciseId).join(", ")}\n    ${r.items.map(fmt).join("; ")}`;
    });
    console.log(`EXAMPLE WEEK 1\n${lines.join("\n")}`);
  });
});
