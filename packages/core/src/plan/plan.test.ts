import { readFileSync } from "node:fs";
import { exercises, goals } from "@openphysio/catalog";
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

const AZHAR = {
  goals: ["run_faster_longer", "swim_more", "jump_higher", "stronger_back"],
  sports: ["running", "swimming"],
  equipment: ["band", "dumbbell", "gym"],
  poolDays: [2, 0],
};
const KNEE = [{ status: "active" as const, avoidAreas: ["knee" as const], deletedAt: null }];

const gen = (o: Partial<GenerateBlockInput> = {}) =>
  generateBlock({
    profile: AZHAR,
    injuries: [],
    exercises,
    goals,
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

  test("run roles: quality, long, easy, picked by role from the catalogue", () => {
    const role = (id: string) => byId.get(id)!.role;
    const roles = week(rows, 0).flatMap((r) =>
      r.type === "run" ? r.items.map((i) => role(i.exerciseId)) : [],
    );
    expect(roles.sort()).toEqual(["easy", "long", "quality"]);
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
    const r = gen({ injuries: KNEE });
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
    expect(r2.some((x) => x.type === "run")).toBe(true);
  });

  test("knee injury: low-impact alternatives replace runs, with reasons", () => {
    const r = gen({ injuries: KNEE });
    expect(r.some((x) => x.type === "run")).toBe(false);
    const subs = week(r, 0).filter((x) => x.title.includes("instead of"));
    expect(subs).toHaveLength(3);
    for (const x of subs) {
      expect(x.items[0]!.notes).toMatch(/fits your injuries or equipment/);
      expect(x.items.every((i) => i.block === "conditioning")).toBe(true);
    }
  });

  test("achilles injury: plyos are replaced by lower-body strength, with a reason", () => {
    const r = gen({
      injuries: [{ status: "active", avoidAreas: ["achilles"], deletedAt: null }],
    });
    expect(r.some((x) => x.type === "plyo")).toBe(false);
    const subs = week(r, 0).filter((x) => x.title.includes("instead of plyometrics"));
    expect(subs).toHaveLength(2);
    expect(subs.every((x) => x.items.every((i) => i.block === "lower_strength"))).toBe(true);
  });

  test("gain_weight only, gym, no pool: strength week, no runs, swims or plyos", () => {
    const r = gen({
      profile: { goals: ["gain_weight"], sports: [], equipment: ["gym", "dumbbell"], poolDays: [] },
    });
    const wk = week(r, 0);
    expect(wk.length).toBeGreaterThanOrEqual(5);
    expect(wk.every((x) => x.type === "gym")).toBe(true);
    expect(wk.some((x) => ["run", "swim", "plyo"].includes(x.type))).toBe(false);
    expect(blocks(wk, "upper_strength").length).toBe(2);
    expect(blocks(wk, "lower_strength").length).toBe(2);
  });

  test("a goal added in a fixture changes the week with no code change", () => {
    const extra = {
      id: "fake_goal",
      label: "Fake",
      demands: [
        {
          id: "fake_core",
          title: "Extra core",
          sessionType: "back_core",
          kind: "strength" as const,
          perWeek: [3, 3] as const,
          impact: "low" as const,
          muscles: ["abdominals", "lower_back"],
        },
      ],
    };
    const base = gen({ goals: [...goals, extra] });
    const more = gen({
      goals: [...goals, extra],
      profile: { ...AZHAR, goals: [...AZHAR.goals, "fake_goal"] },
    });
    expect(week(more, 0).filter((x) => x.title === "Extra core")).toHaveLength(3);
    expect(base.some((x) => x.title === "Extra core")).toBe(false);
    // unknown goal ids are ignored, no goals = no sessions
    expect(gen({ profile: { ...AZHAR, goals: ["nope"] } })).toEqual([]);
  });

  test("scheduling rules: <=2 a day, no high-impact on neighbouring days (week wraps), trainingDays kept", () => {
    const high = new Set(
      goals.flatMap((g) => g.demands.filter((d) => d.impact === "high").map((d) => d.title)),
    );
    for (const seed of [1, 2, 3, 4, 5]) {
      const r = gen({
        seed,
        profile: { ...AZHAR, goals: goals.map((g) => g.id), trainingDays: [1, 2, 3, 4, 5, 6] },
      });
      const wk = week(r, 0);
      const perDay = new Map<number, number>();
      for (const x of wk) perDay.set(dow(x), (perDay.get(dow(x)) ?? 0) + 1);
      expect(Math.max(...perDay.values())).toBeLessThanOrEqual(2);
      expect(perDay.has(0)).toBe(false);
      const hi = wk.filter((x) => high.has(x.title)).map(dow);
      for (const a of hi)
        for (const b of hi)
          if (a !== b) expect(Math.min((a - b + 7) % 7, (b - a + 7) % 7)).toBeGreaterThan(1);
    }
  });

  test("generate.ts holds no catalogue ids and no weekday names", () => {
    const src = readFileSync(new URL("./generate.ts", import.meta.url), "utf8");
    for (const e of exercises) expect(src.includes(`"${e.id}"`), e.id).toBe(false);
    for (const g of goals) expect(src.includes(`"${g.id}"`), g.id).toBe(false);
    expect(src).not.toMatch(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(day)?\b/);
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

  test("pool sessions land on poolDays; with a pool but no days set, any day", () => {
    const swim = (r: PlannedSessionRow[]) => new Set(r.filter((x) => x.type === "swim").map(dow));
    expect(swim(gen({ profile: { ...AZHAR, poolDays: [1, 5] } }))).toEqual(new Set([1, 5]));
    expect(swim(gen({ profile: { ...AZHAR, poolDays: [] } })).size).toBe(0); // no pool access
    expect(
      swim(gen({ profile: { ...AZHAR, poolDays: [], equipment: ["pool"] } })).size,
    ).toBeGreaterThan(0);
  });

  test("equipment: home-only never schedules gym exercises; gym only on the gym day", () => {
    const home = gen({ profile: { ...AZHAR, equipment: ["band", "dumbbell"] } });
    expect(home.some((r) => r.type === "gym")).toBe(false);
    for (const i of all(home))
      expect(
        byId.get(i.exerciseId)!.equipment.some((q) => q !== "gym"),
        i.exerciseId,
      ).toBe(true);
    const none = gen({ profile: { ...AZHAR, equipment: [], poolDays: [] } });
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

  test("no history: week 1 has no advanced plyo or strength, week 3 can", () => {
    const advanced = new Set([
      "box_jump",
      "depth_drop_landing",
      "broad_jump",
      "lateral_bound",
      "single_leg_hop",
      "skater_hop",
      "nordic_curl",
    ]);
    const ids = (w: number) => new Set(all(week(rows, w)).map((i) => i.exerciseId));
    for (const w of [0, 1])
      for (const id of advanced) expect(ids(w).has(id), `w${w} ${id}`).toBe(false);
    const any = [0, 1, 2].some((s) => {
      const r = gen({ seed: s });
      return [2, 3].some((w) => [...all(week(r, w))].some((i) => advanced.has(i.exerciseId)));
    });
    expect(any).toBe(true);
    // with plyo history, no staging
    const hist = gen({
      history: { ...empty, plyoContacts: [{ at: startMs - 86_400_000, contacts: 60 }] },
    });
    expect(hist.length).toBeGreaterThan(0);
  });

  test("print example weeks", () => {
    const fmt = (i: PlannedSessionRow["items"][number]) =>
      i.block === "run"
        ? `${i.exerciseId} ${i.amount}min (~${(i.distanceM! / 1000).toFixed(1)}km)`
        : i.footContacts
          ? `${i.exerciseId} ${i.sets}x${i.amount} (${i.footContacts} contacts)`
          : `${i.exerciseId} ${i.sets}x${i.amount}${i.unit === "reps" ? "" : i.unit[0]}`;
    const show = (title: string, r: PlannedSessionRow[]) =>
      console.log(
        `${title}\n` +
          week(r, 0)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(
              (x) =>
                `${x.date} ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dow(x)]} [${x.type}] ${x.title}\n    warmup: ${x.warmup.map((i) => i.exerciseId).join(", ")}\n    ${x.items.map(fmt).join("; ")}${x.items[0]!.notes.startsWith("No ") ? `\n    note: ${x.items[0]!.notes}` : ""}`,
            )
            .join("\n"),
      );
    show("AZHAR-LIKE WEEK 1", rows);
    show(
      "GAIN-WEIGHT-ONLY GYM WEEK 1",
      gen({
        profile: {
          goals: ["gain_weight"],
          sports: [],
          equipment: ["gym", "dumbbell"],
          poolDays: [],
        },
      }),
    );
    show("KNEE-INJURY WEEK 1", gen({ injuries: KNEE }));
  });
});
