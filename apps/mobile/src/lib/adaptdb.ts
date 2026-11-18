import { exercises, historyLookup, playRules } from "@openphysio/catalog";
import { adaptNextWeek, buildHistory, healthDaily, painEntry, plannedSession, setLog, workout, type AdaptResult, type PlannedSessionRow } from "@openphysio/core";
import { and, eq, gte, inArray, isNull } from "drizzle-orm";
import Storage from "expo-sqlite/kv-store";
import { db } from "../db";
import { addCheckIn } from "../play/checkins";
import { allPlanned } from "./plandb";

const REVIEWED_KEY = "adapt.reviewed";
const CHECKINS_KEY = "play.checkins";
const HISTORY_DAYS = 60;
const DAY_MS = 86_400_000;

/** What next week should change, from this week's logs, pain and recovery. */
export async function proposeNextWeek(now = Date.now()): Promise<AdaptResult> {
  const block = (await allPlanned()) as unknown as PlannedSessionRow[];
  const since = now - HISTORY_DAYS * DAY_MS;
  const ws = (await db.select().from(workout).where(and(isNull(workout.deletedAt), gte(workout.startedAt, since)))).filter((w) => w.endedAt != null);
  const sets = ws.length ? await db.select().from(setLog).where(and(inArray(setLog.workoutId, ws.map((w) => w.id)), isNull(setLog.deletedAt))) : [];
  const at = new Map(ws.map((w) => [w.id, w.startedAt]));
  const weekAgo = now - 7 * DAY_MS;
  const pain = await db.select().from(painEntry).where(and(isNull(painEntry.deletedAt), gte(painEntry.at, weekAgo)));
  const recovery = await db.select().from(healthDaily).where(isNull(healthDaily.deletedAt));
  return adaptNextWeek({
    block,
    logs: sets.map((s) => ({ exerciseId: s.exerciseId, rpe: s.rpe, at: at.get(s.workoutId)! })).filter((l) => l.at >= weekAgo),
    pain,
    recovery,
    exercises,
    history: buildHistory(ws, sets, historyLookup),
    now,
  });
}

/** Saves a confirmed coach proposal through the same path as the weekly check-in. */
export const applyProposal = (p: { change: AdaptResult["changes"][number]; session: PlannedSessionRow }, now = Date.now()) =>
  applyNextWeek({ changes: [p.change], sessions: [p.session], week: null }, now);

export const reviewedWeek = (): string | null => {
  try {
    return Storage.getItemSync(REVIEWED_KEY);
  } catch {
    return null;
  }
};
export const markReviewed = (nextStart: string) => {
  try {
    Storage.setItemSync(REVIEWED_KEY, nextStart);
  } catch {
    // the check-in just shows again
  }
};

/** Dates (YYYY-MM-DD) the weekly check-in was completed. Feeds the points engine. */
export const checkInDates = (): string[] => {
  try {
    return JSON.parse(Storage.getItemSync(CHECKINS_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
};
export const recordCheckIn = (date: string) => {
  try {
    Storage.setItemSync(CHECKINS_KEY, JSON.stringify(addCheckIn(checkInDates(), date, playRules.weekStartsOn)));
  } catch {
    // no check-in point this week
  }
};

/** Saves the changed sessions (updatedAt bumped so sync picks them up); a session left with no exercises is removed. */
export async function applyNextWeek(r: AdaptResult, now = Date.now()) {
  await db.transaction(async (tx) => {
    for (const s of r.sessions)
      await tx
        .update(plannedSession)
        .set(s.items.length ? { items: s.items, date: s.date, updatedAt: now } : { deletedAt: now, updatedAt: now })
        .where(eq(plannedSession.id, s.id));
  });
  if (r.week) markReviewed(r.week.next.start);
}
