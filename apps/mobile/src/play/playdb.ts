import { playRules } from "@openphysio/catalog";
import { computeLedger, computeStreak, painEntry, plannedSession, setLog, workout, type LedgerEntry, type PlayInput, type StreakResult } from "@openphysio/core";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

// Takes the db as an argument so tests can pass better-sqlite3; the app passes the expo one.
type Db = BaseSQLiteDatabase<"sync" | "async", unknown>;

export type Play = { streak: StreakResult; thisWeek: StreakResult["thisWeek"]; ledgerToday: LedgerEntry[] };

/** Points are recomputed from the logs every time; nothing is stored. Deleted rows are filtered by the engine. */
export async function loadPlay(db: Db, today: string, checkIns: readonly string[]): Promise<Play> {
  const input: PlayInput = {
    planned: (await db.select().from(plannedSession)) as unknown as PlayInput["planned"],
    workouts: await db.select().from(workout),
    sets: await db.select().from(setLog),
    pain: await db.select().from(painEntry),
    checkIns,
    rules: playRules,
  };
  const streak = computeStreak({ ...input, today });
  return { streak, thisWeek: streak.thisWeek, ledgerToday: computeLedger(input).filter((e) => e.date === today) };
}
