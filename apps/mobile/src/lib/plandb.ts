import { exercises, goals } from "@openphysio/catalog";
import { generateBlock, injury, newRow, plannedSession, profile, setLog, workout, type PlanItem, type PlanWarning, type PlannedSessionRow } from "@openphysio/core";
import { and, eq, gte, inArray, isNull } from "drizzle-orm";
import Storage from "expo-sqlite/kv-store";
import { db } from "../db";
import { markPlannedDone } from "./logdb";
import { addDays, buildHistory, ymd } from "./plan";

const WARN_KEY = "plan.warnings";
const HISTORY_DAYS = 60;
const CHUNK = 10;

export type Planned = Omit<typeof plannedSession.$inferSelect, "warmup" | "items"> & { warmup: PlanItem[]; items: PlanItem[] };
const live = isNull(plannedSession.deletedAt);

export const allPlanned = (): Promise<Planned[]> =>
  db.select().from(plannedSession).where(live).orderBy(plannedSession.date, plannedSession.updatedAt) as unknown as Promise<Planned[]>;

export const getPlanned = async (id: string) => (await allPlanned()).find((p) => p.id === id);

/** Warnings from the last generation, kept so they stay visible. */
export const savedWarnings = (): PlanWarning[] => {
  try {
    return JSON.parse(Storage.getItemSync(WARN_KEY) ?? "[]") as PlanWarning[];
  } catch {
    return [];
  }
};

/** Builds the next 4-week block from profile, injuries, catalogue and logged history, then replaces the open planned sessions from the start date on. */
export async function generatePlan(now = new Date()): Promise<{ count: number; warnings: PlanWarning[] }> {
  const [p] = await db.select().from(profile).limit(1);
  if (!p) throw new Error("Complete your profile first");
  const injuries = await db.select().from(injury).where(isNull(injury.deletedAt));
  const since = now.getTime() - HISTORY_DAYS * 86_400_000;
  const ws = (await db.select().from(workout).where(and(isNull(workout.deletedAt), gte(workout.startedAt, since)))).filter((w) => w.endedAt != null);
  const sets = ws.length ? await db.select().from(setLog).where(and(inArray(setLog.workoutId, ws.map((w) => w.id)), isNull(setLog.deletedAt))) : [];
  const today = ymd(now);
  // A session already done today stays; the new block starts tomorrow.
  const doneToday = (await allPlanned()).some((s) => s.date === today && s.status === "done");
  const startDate = doneToday ? addDays(today, 1) : today;

  const { sessions, warnings } = generateBlock({
    profile: p,
    injuries,
    exercises,
    goals,
    history: buildHistory(ws, sets),
    startDate,
    seed: now.getTime() % 2 ** 31,
  });
  if (!sessions.length) return { count: 0, warnings };

  await db.transaction(async (tx) => {
    await tx
      .update(plannedSession)
      .set({ deletedAt: now.getTime(), updatedAt: now.getTime() })
      .where(and(live, eq(plannedSession.status, "planned"), gte(plannedSession.date, startDate)));
    for (let i = 0; i < sessions.length; i += CHUNK) await tx.insert(plannedSession).values(sessions.slice(i, i + CHUNK) as PlannedSessionRow[] as never);
  });
  try {
    Storage.setItemSync(WARN_KEY, JSON.stringify(warnings));
  } catch {
    // warnings are still returned to the caller
  }
  return { count: sessions.length, warnings };
}

/** The unfinished workout linked to a planned session, created on first open. */
export async function workoutFor(planned: Planned) {
  const [w] = await db
    .select()
    .from(workout)
    .where(and(eq(workout.plannedSessionId, planned.id), isNull(workout.deletedAt), isNull(workout.endedAt)))
    .limit(1);
  if (w) return w;
  const row = { ...newRow(), type: planned.type, startedAt: Date.now(), source: "manual" as const, plannedSessionId: planned.id };
  await db.insert(workout).values(row);
  return row;
}

/** Run or swim logged by hand (M5 will replace this with the GPS tracker). Saves a finished workout and marks the plan done. */
export async function logQuick(planned: Planned, v: { durationS: number; distanceM: number | null; notes: string }) {
  const now = Date.now();
  await db.insert(workout).values({
    ...newRow(),
    type: planned.type,
    startedAt: now - v.durationS * 1000,
    endedAt: now,
    durationS: v.durationS,
    distanceM: v.distanceM,
    notes: v.notes.trim() || null,
    source: "manual",
    plannedSessionId: planned.id,
  });
  await markPlannedDone(planned.id);
}
