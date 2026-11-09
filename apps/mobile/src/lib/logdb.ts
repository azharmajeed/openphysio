import type { Equipment, Exercise } from "@openphysio/catalog";
import { injury, newRow, painEntry, profile, setLog, workout, type BodyArea, type PainKind } from "@openphysio/core";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db";
import { LOGGABLE_TYPES, type LoggableType, type SetDraft } from "./log";

const live = <T extends { deletedAt: unknown }>(t: T) => isNull(t.deletedAt as never);

export async function activeWorkout() {
  const [w] = await db
    .select()
    .from(workout)
    .where(and(isNull(workout.endedAt), isNull(workout.deletedAt), inArray(workout.type, [...LOGGABLE_TYPES])))
    .orderBy(desc(workout.startedAt))
    .limit(1);
  return w;
}

export async function startWorkout(type: LoggableType) {
  const row = { ...newRow(), type, startedAt: Date.now(), source: "manual" as const };
  await db.insert(workout).values(row);
  return row.id;
}

export const workoutSets = (workoutId: string) =>
  db.select().from(setLog).where(and(eq(setLog.workoutId, workoutId), live(setLog))).orderBy(setLog.updatedAt);

export async function addSet(workoutId: string, e: Exercise, d: SetDraft, setIndex: number) {
  const timed = e.unit !== "reps";
  await db.insert(setLog).values({
    ...newRow(),
    workoutId,
    exerciseId: e.id,
    setIndex,
    reps: timed ? null : d.reps,
    loadKg: d.loadKg || null,
    rpe: d.rpe,
    durationS: timed ? d.durationS : null,
    footContacts: e.footContactsPerRep && !timed ? e.footContactsPerRep * d.reps : null,
  });
}

export const undoSet = (id: string) => db.update(setLog).set({ deletedAt: Date.now(), updatedAt: Date.now() }).where(eq(setLog.id, id));

export async function finishWorkout(workoutId: string, startedAt: number) {
  const now = Date.now();
  await db.update(workout).set({ endedAt: now, durationS: Math.round((now - startedAt) / 1000), updatedAt: now }).where(eq(workout.id, workoutId));
}

export const discardWorkout = (id: string) => db.update(workout).set({ deletedAt: Date.now(), updatedAt: Date.now() }).where(eq(workout.id, id));

export const savePain = (p: { workoutId: string; exerciseId: string; bodyArea: BodyArea; score: number; kind: PainKind }) =>
  db.insert(painEntry).values({ ...newRow(), ...p, at: Date.now() });

export async function history() {
  const ws = await db
    .select()
    .from(workout)
    .where(and(live(workout), inArray(workout.type, [...LOGGABLE_TYPES])))
    .orderBy(desc(workout.startedAt))
    .limit(30);
  const sets = ws.length ? await db.select().from(setLog).where(and(inArray(setLog.workoutId, ws.map((w) => w.id)), live(setLog))) : [];
  return ws
    .filter((w) => w.endedAt != null)
    .map((w) => ({ ...w, sets: sets.filter((s) => s.workoutId === w.id) }));
}

export async function loadContext() {
  const [p] = await db.select().from(profile).limit(1);
  const injuries = await db.select().from(injury).where(isNull(injury.deletedAt));
  return { equipment: (p?.equipment ?? []) as Equipment[], injuries };
}
