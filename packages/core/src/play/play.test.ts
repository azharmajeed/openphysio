import { describe, expect, test } from "vitest";
import { computeLedger, computeStreak, weekStart, type PlayInput, type PlayRules } from "./index.ts";

const rules: PlayRules = {
  points: { plannedSessionCompleted: 10, setLogged: 1, painCheckAnswered: 2, weeklyCheckIn: 5, unplannedSessionLogged: 3 },
  dailyCap: 25,
  streak: { threshold: 0.8 },
  weekStartsOn: 1,
};
const toDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const at = (date: string, h = 9, m = 0) => Date.parse(`${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);

// 2026-11-16 is a Monday.
const MON = "2026-11-16";
const TUE = "2026-11-17";

const base = (o: Partial<PlayInput> = {}): PlayInput => ({ planned: [], workouts: [], sets: [], pain: [], checkIns: [], rules, toDate, ...o });
const plan = (id: string, date: string, sets = 3) => ({ id, date, items: [{ exerciseId: "squat", sets }] });
const wo = (id: string, date: string, plannedSessionId: string | null = null, h = 9) => ({ id, startedAt: at(date, h), endedAt: at(date, h + 1), plannedSessionId });
const set = (workoutId: string, exerciseId: string, setIndex: number, date: string, h = 9, m = 5) => ({ workoutId, exerciseId, setIndex, updatedAt: at(date, h, m) });
const total = (l: { points: number }[]) => l.reduce((n, e) => n + e.points, 0);

describe("farming guards", () => {
  test("duplicate set logs earn once", () => {
    const sets = [set("w1", "squat", 0, MON), set("w1", "squat", 0, MON, 9, 6), set("w1", "squat", 0, MON, 9, 7)];
    const l = computeLedger(base({ planned: [plan("p1", MON)], workouts: [wo("w1", MON, "p1")], sets }));
    expect(l.filter((e) => e.event === "setLogged")).toHaveLength(1);
  });

  test("duplicate workouts on one planned session earn the session once", () => {
    const l = computeLedger(
      base({
        planned: [plan("p1", MON)],
        workouts: [wo("w1", MON, "p1"), wo("w2", MON, "p1", 12)],
        sets: [set("w1", "squat", 0, MON), set("w2", "squat", 0, MON, 12)],
      }),
    );
    expect(l.filter((e) => e.event === "plannedSessionCompleted")).toHaveLength(1);
  });

  test("re-logging the same sets in a second workout cannot exceed the plan", () => {
    const sets = [0, 1, 2].flatMap((i) => [set("w1", "squat", i, MON), set("w2", "squat", i, MON, 12)]);
    const l = computeLedger(base({ planned: [plan("p1", MON)], workouts: [wo("w1", MON, "p1"), wo("w2", MON, "p1", 12)], sets }));
    expect(l.filter((e) => e.event === "setLogged")).toHaveLength(3);
  });

  test("sets beyond the plan earn nothing", () => {
    const sets = [0, 1, 2, 3, 4, 5].map((i) => set("w1", "squat", i, MON));
    const l = computeLedger(base({ planned: [plan("p1", MON, 3)], workouts: [wo("w1", MON, "p1")], sets }));
    expect(l.filter((e) => e.event === "setLogged")).toHaveLength(3);
  });

  test("an exercise that is not in the plan earns nothing", () => {
    const l = computeLedger(base({ planned: [plan("p1", MON)], workouts: [wo("w1", MON, "p1")], sets: [set("w1", "deadlift", 0, MON)] }));
    expect(l.filter((e) => e.event === "setLogged")).toHaveLength(0);
  });

  test("edits after the fact (later updatedAt, same set) change nothing", () => {
    const a = computeLedger(base({ planned: [plan("p1", MON)], workouts: [wo("w1", MON, "p1")], sets: [set("w1", "squat", 0, MON)] }));
    const b = computeLedger(base({ planned: [plan("p1", MON)], workouts: [wo("w1", MON, "p1")], sets: [set("w1", "squat", 0, MON, 20)] }));
    expect(b).toEqual(a);
  });

  test("an empty start-stop workout does not complete a planned session", () => {
    const l = computeLedger(base({ planned: [plan("p1", MON)], workouts: [wo("w1", MON, "p1")] }));
    expect(l).toEqual([]);
  });

  test("unplanned sessions earn only unplannedSessionLogged, once per day", () => {
    const l = computeLedger(
      base({
        workouts: [wo("w1", MON), wo("w2", MON, null, 12)],
        sets: [set("w1", "squat", 0, MON), set("w2", "squat", 0, MON, 12)],
      }),
    );
    expect(l.map((e) => e.event)).toEqual(["unplannedSessionLogged"]);
    expect(total(l)).toBe(3);
  });

  test("a deleted planned session counts the workout as unplanned", () => {
    const l = computeLedger(
      base({ planned: [{ ...plan("p1", MON), deletedAt: 1 }], workouts: [wo("w1", MON, "p1")], sets: [set("w1", "squat", 0, MON)] }),
    );
    expect(l.map((e) => e.event)).toEqual(["unplannedSessionLogged"]);
  });

  test("one check-in per week, one pain check per workout", () => {
    const pain = [0, 1, 2].map((i) => ({ id: `n${i}`, workoutId: "w1", score: 2, kind: "ache" as const, at: at(MON, 9, 10 + i) }));
    const l = computeLedger(base({ checkIns: [MON, TUE, "2026-11-22"], pain }));
    expect(l.filter((e) => e.event === "weeklyCheckIn")).toHaveLength(1);
    expect(l.filter((e) => e.event === "painCheckAnswered")).toHaveLength(1);
  });

  test("unfinished and deleted workouts earn nothing", () => {
    const sets = [set("w1", "squat", 0, MON), set("w2", "squat", 0, MON, 12)];
    const l = computeLedger(
      base({
        planned: [plan("p1", MON), plan("p2", MON)],
        workouts: [{ ...wo("w1", MON, "p1"), endedAt: null }, { ...wo("w2", MON, "p2", 12), deletedAt: 5 }],
        sets,
      }),
    );
    expect(l).toEqual([]);
  });

  test("deleted sets earn nothing", () => {
    const l = computeLedger(base({ planned: [plan("p1", MON)], workouts: [wo("w1", MON, "p1")], sets: [{ ...set("w1", "squat", 0, MON), deletedAt: 9 }] }));
    expect(l).toEqual([]);
  });
});

describe("pain stop", () => {
  const stop = (workoutId: string | null, date: string, h: number, m: number, kind: "sharp" | "ache" = "sharp") => ({
    id: `pain-${workoutId}-${h}${m}`,
    workoutId,
    score: 6,
    kind,
    at: at(date, h, m),
  });

  test("sets after the stop earn nothing, sets before still do; no session completion", () => {
    const sets = [set("w1", "squat", 0, MON, 9, 5), set("w1", "squat", 1, MON, 9, 20), set("w1", "squat", 2, MON, 9, 25)];
    const l = computeLedger(base({ planned: [plan("p1", MON)], workouts: [wo("w1", MON, "p1")], sets, pain: [stop("w1", MON, 9, 15)] }));
    expect(l.filter((e) => e.event === "setLogged")).toHaveLength(1);
    expect(l.some((e) => e.event === "plannedSessionCompleted")).toBe(false);
    expect(l.some((e) => e.event === "painCheckAnswered")).toBe(true); // honest reporting still earns
  });

  test("a later workout the same day earns nothing, the next day does", () => {
    const l = computeLedger(
      base({
        planned: [plan("p1", MON), plan("p2", TUE)],
        workouts: [wo("w1", MON, null, 9), wo("w2", MON, "p1", 15), wo("w3", TUE, "p2")],
        sets: [set("w2", "squat", 0, MON, 15), set("w3", "squat", 0, TUE)],
        pain: [stop("w1", MON, 9, 30)],
      }),
    );
    expect(l.filter((e) => e.date === MON && e.event !== "painCheckAnswered")).toEqual([]);
    expect(l.filter((e) => e.date === TUE).map((e) => e.event)).toEqual(["plannedSessionCompleted", "setLogged"]);
  });

  test("a pain entry without a workout still blocks later workouts that day", () => {
    const l = computeLedger(base({ workouts: [wo("w1", MON, null, 15)], sets: [set("w1", "squat", 0, MON, 15)], pain: [stop(null, MON, 8, 0)] }));
    expect(l.some((e) => e.event === "unplannedSessionLogged")).toBe(false);
  });

  test("an ache at or under the continue threshold is not a stop", () => {
    const l = computeLedger(
      base({ planned: [plan("p1", MON)], workouts: [wo("w1", MON, "p1")], sets: [set("w1", "squat", 1, MON, 9, 20)], pain: [{ ...stop("w1", MON, 9, 15, "ache"), score: 3 }] }),
    );
    expect(l.some((e) => e.event === "plannedSessionCompleted")).toBe(true);
    expect(l.some((e) => e.event === "setLogged")).toBe(true);
  });

  test("a deleted pain entry is not a stop", () => {
    const l = computeLedger(base({ workouts: [wo("w1", MON, null, 15)], sets: [set("w1", "squat", 0, MON, 15)], pain: [{ ...stop(null, MON, 8, 0), deletedAt: 1 }] }));
    expect(l.some((e) => e.event === "unplannedSessionLogged")).toBe(true);
  });
});

describe("daily cap", () => {
  test("caps points per local date, in time order, with a partial last entry", () => {
    const sets = Array.from({ length: 20 }, (_, i) => set("w1", "squat", i, MON, 9, 5 + (i % 50)));
    const l = computeLedger(base({ planned: [plan("p1", MON, 20)], workouts: [wo("w1", MON, "p1")], sets }));
    expect(total(l)).toBe(25); // session 10 + 15 of 20 sets
    expect(l.filter((e) => e.event === "setLogged")).toHaveLength(15);
  });

  test("the cap applies per date", () => {
    const l = computeLedger(
      base({
        planned: [plan("p1", MON, 30), plan("p2", TUE, 30)],
        workouts: [wo("w1", MON, "p1"), wo("w2", TUE, "p2")],
        sets: [...Array.from({ length: 30 }, (_, i) => set("w1", "squat", i, MON)), ...Array.from({ length: 30 }, (_, i) => set("w2", "squat", i, TUE))],
      }),
    );
    expect(total(l.filter((e) => e.date === MON))).toBe(25);
    expect(total(l.filter((e) => e.date === TUE))).toBe(25);
  });
});

describe("determinism", () => {
  test("same logs in any order give the same ledger, with stable ids", () => {
    const input = base({
      planned: [plan("p1", MON), plan("p2", TUE)],
      workouts: [wo("w1", MON, "p1"), wo("w2", TUE, "p2")],
      sets: [0, 1, 2].flatMap((i) => [set("w1", "squat", i, MON), set("w2", "squat", i, TUE)]),
      checkIns: [MON],
    });
    const a = computeLedger(input);
    const b = computeLedger({ ...input, workouts: [...input.workouts].reverse(), sets: [...input.sets].reverse(), planned: [...input.planned].reverse() });
    expect(b).toEqual(a);
    expect(computeLedger(input)).toEqual(a);
    expect(new Set(a.map((e) => e.id)).size).toBe(a.length);
  });
});

describe("streak", () => {
  const today = "2026-11-30"; // Monday of week 3 (weeks start 16th, 23rd, 30th)
  const done = (n: number, week: string) => {
    const days = Array.from({ length: n }, (_, i) => toDate(Date.parse(`${week}T00:00:00Z`) + i * 86_400_000));
    return {
      planned: days.map((d, i) => plan(`${week}-p${i}`, d)),
      workouts: days.map((d, i) => wo(`${week}-w${i}`, d, `${week}-p${i}`)),
      sets: days.map((d, i) => set(`${week}-w${i}`, "squat", 0, d)),
    };
  };
  const merge = (...xs: ReturnType<typeof done>[]) => ({
    planned: xs.flatMap((x) => x.planned),
    workouts: xs.flatMap((x) => x.workouts),
    sets: xs.flatMap((x) => x.sets),
  });
  const plannedOnly = (n: number, week: string) => ({ ...done(n, week), workouts: [], sets: [] });

  test("weekStart honours weekStartsOn", () => {
    expect(weekStart("2026-11-22", 1)).toBe("2026-11-16"); // Sunday belongs to the Monday week
    expect(weekStart("2026-11-22", 0)).toBe("2026-11-22");
  });

  test("consecutive full weeks build a streak", () => {
    const r = computeStreak({ ...base(merge(done(3, "2026-11-16"), done(3, "2026-11-23"))), today });
    expect(r.current).toBe(2);
    expect(r.best).toBe(2);
    expect(r.thisWeek).toMatchObject({ weekStart: "2026-11-30", done: 0, planned: 0 });
  });

  test("threshold edge: 4 of 5 counts (0.8), 3 of 5 breaks", () => {
    const wk = (n: number) => {
      const d = done(5, "2026-11-16");
      return { planned: d.planned, workouts: d.workouts.slice(0, n), sets: d.sets.slice(0, n) };
    };
    expect(computeStreak({ ...base(wk(4)), today: "2026-11-23" }).current).toBe(1);
    expect(computeStreak({ ...base(wk(3)), today: "2026-11-23" }).current).toBe(0);
  });

  test("a missed week breaks the streak, best is kept", () => {
    const m = merge(done(3, "2026-11-02"), done(3, "2026-11-09"), plannedOnly(3, "2026-11-16"), done(3, "2026-11-23"));
    const r = computeStreak({ ...base(m), today });
    expect(r.best).toBe(2);
    expect(r.current).toBe(1);
  });

  test("a week with no planned sessions counts and never breaks the streak", () => {
    const r = computeStreak({ ...base(merge(done(3, "2026-11-09"), done(3, "2026-11-23"))), today });
    expect(r.current).toBe(3); // 9th, empty 16th, 23rd
  });

  test("the running week never breaks a streak", () => {
    const r = computeStreak({ ...base(merge(done(3, "2026-11-23"), plannedOnly(3, "2026-11-30"))), today });
    expect(r.current).toBe(1);
    expect(r.thisWeek).toMatchObject({ done: 0, planned: 3 });
  });

  test("a pain-stop week that missed the threshold is frozen, not broken", () => {
    const missed = plannedOnly(3, "2026-11-16");
    const pain = [{ id: "n1", workoutId: null, score: 7, kind: "giving_way" as const, at: at("2026-11-17") }];
    const m = merge(done(3, "2026-11-09"), missed, done(3, "2026-11-23"));
    const r = computeStreak({ ...base({ ...m, pain }), today });
    expect(r.current).toBe(2); // frozen week neither counts nor breaks
    const noPain = computeStreak({ ...base(m), today });
    expect(noPain.current).toBe(1);
  });

  test("a pain stop in another week does not freeze a clean miss", () => {
    const m = merge(done(3, "2026-11-09"), plannedOnly(3, "2026-11-16"), done(3, "2026-11-23"));
    const pain = [{ id: "n1", workoutId: null, score: 7, kind: "sharp" as const, at: at("2026-11-26") }]; // other week
    expect(computeStreak({ ...base({ ...m, pain }), today }).current).toBe(1);
  });

  test("this week's points are summed from the ledger", () => {
    const r = computeStreak({ ...base(done(2, "2026-11-30")), today: "2026-12-02" });
    expect(r.thisWeek).toMatchObject({ done: 2, planned: 2, points: 2 * 11 });
  });
});
