import { fileURLToPath } from "node:url";
import { newRow, painEntry, plannedSession, setLog, workout } from "@openphysio/core";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { expect, test } from "vitest";
import { addCheckIn } from "./checkins.ts";
import { loadPlay } from "./playdb.ts";

const migrationsFolder = fileURLToPath(new URL("../../../../packages/core/drizzle", import.meta.url));
const mem = () => {
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder });
  return db;
};
const at = (d: string, h = 10) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00`).getTime();
// 2026-11-16 is a Monday; the default rules start weeks on Monday.
const MON = "2026-11-16";
const TUE = "2026-11-17";
const line = { exerciseId: "squat", sets: 2 };

async function seed(db: ReturnType<typeof mem>) {
  const mkPlan = (id: string, date: string) => ({ ...newRow(1), id, date, title: id, type: "lower_strength" as const, warmup: [], items: [line] });
  await db.insert(plannedSession).values([mkPlan("p1", MON), mkPlan("p2", TUE)] as never);
  return db;
}
const finish = async (db: ReturnType<typeof mem>, id: string, planId: string, date: string, nSets: number, extra = {}) => {
  await db.insert(workout).values({ ...newRow(1), id, type: "strength", startedAt: at(date), endedAt: at(date, 11), plannedSessionId: planId, source: "manual", ...extra } as never);
  for (let i = 0; i < nSets; i++) await db.insert(setLog).values({ ...newRow(at(date, 10)), workoutId: id, exerciseId: "squat", setIndex: i, reps: 5 } as never);
};

test("seeded week: finished planned session earns points and counts toward the streak", async () => {
  const db = await seed(mem());
  await finish(db, "w1", "p1", MON, 2);
  const p = await loadPlay(db, MON, []);
  expect(p.ledgerToday.map((e) => e.event).sort()).toEqual(["plannedSessionCompleted", "setLogged", "setLogged"]);
  expect(p.thisWeek).toMatchObject({ done: 1, planned: 2 });
  expect(p.thisWeek.points).toBe(p.ledgerToday.reduce((n, e) => n + e.points, 0));
  expect(p.streak.current).toBe(0); // 1 of 2 planned: below the threshold
  await finish(db, "w2", "p2", TUE, 2);
  expect((await loadPlay(db, TUE, [])).streak.current).toBe(1);
});

test("check-in is recorded once per week and earns points once", async () => {
  expect(addCheckIn([], "2026-11-18", 1)).toEqual(["2026-11-18"]);
  expect(addCheckIn(["2026-11-18"], "2026-11-20", 1)).toEqual(["2026-11-18"]);
  expect(addCheckIn(["2026-11-18"], "2026-11-23", 1)).toEqual(["2026-11-18", "2026-11-23"]);
  const db = await seed(mem());
  const once = await loadPlay(db, "2026-11-18", ["2026-11-18"]);
  expect(once.ledgerToday.filter((e) => e.event === "weeklyCheckIn")).toHaveLength(1);
});

test("unfinished and deleted workouts earn nothing", async () => {
  const db = await seed(mem());
  await finish(db, "open", "p1", MON, 2, { endedAt: null });
  await finish(db, "gone", "p2", TUE, 2, { deletedAt: 5 });
  const p = await loadPlay(db, TUE, []);
  expect(p.thisWeek).toMatchObject({ done: 0, points: 0 });
  expect((await loadPlay(db, MON, [])).ledgerToday).toEqual([]);
});

test("a pain answer still earns", async () => {
  const db = await seed(mem());
  await db.insert(painEntry).values({ ...newRow(1), score: 2, kind: "dull", bodyArea: "knee", at: at(MON) } as never);
  expect((await loadPlay(db, MON, [])).ledgerToday.map((e) => e.event)).toEqual(["painCheckAnswered"]);
});
