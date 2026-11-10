import { acceptFix, newRow, runPoint, trackStats, workout } from "@openphysio/core";
import type { LocationObject } from "expo-location";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { markPlannedDone } from "../lib/logdb";

/** The unfinished GPS run, if any (survives an app kill: its points are already saved). */
export async function activeRun() {
  const [w] = await db
    .select()
    .from(workout)
    .where(
      and(
        eq(workout.type, "run"),
        eq(workout.source, "gps"),
        isNull(workout.endedAt),
        isNull(workout.deletedAt),
      ),
    )
    .orderBy(desc(workout.startedAt))
    .limit(1);
  return w;
}

export async function startRun(plannedSessionId?: string) {
  const row = {
    ...newRow(),
    type: "run" as const,
    startedAt: Date.now(),
    source: "gps" as const,
    plannedSessionId: plannedSessionId ?? null,
  };
  await db.insert(workout).values(row);
  return (await activeRun())!;
}

/** Saves fixes as they arrive; poor-accuracy fixes are dropped. */
export async function savePoints(workoutId: string, locations: LocationObject[]) {
  const rows = locations
    .filter((l) => acceptFix(l.coords.accuracy))
    .map((l) => ({
      ...newRow(),
      workoutId,
      t: l.timestamp,
      lat: l.coords.latitude,
      lon: l.coords.longitude,
      alt: l.coords.altitude,
    }));
  if (rows.length) await db.insert(runPoint).values(rows);
}

export const runPoints = (workoutId: string) =>
  db
    .select({ t: runPoint.t, lat: runPoint.lat, lon: runPoint.lon })
    .from(runPoint)
    .where(and(eq(runPoint.workoutId, workoutId), isNull(runPoint.deletedAt)))
    .orderBy(asc(runPoint.t));

export const discardRun = (id: string) =>
  db
    .update(workout)
    .set({ deletedAt: Date.now(), updatedAt: Date.now() })
    .where(eq(workout.id, id));

/** Saves distance and moving time from the points. Returns false (and discards the run) when there is nothing to save. avgHr stays null. */
export async function finishRun(w: {
  id: string;
  plannedSessionId: string | null;
}): Promise<boolean> {
  const points = await runPoints(w.id);
  const s = trackStats(points);
  if (points.length < 2 || s.distanceM <= 0) {
    await discardRun(w.id);
    return false;
  }
  await db
    .update(workout)
    .set({
      endedAt: points.at(-1)!.t,
      durationS: Math.round(s.movingS),
      distanceM: Math.round(s.distanceM),
      updatedAt: Date.now(),
    })
    .where(eq(workout.id, w.id));
  if (w.plannedSessionId) await markPlannedDone(w.plannedSessionId);
  return true;
}
