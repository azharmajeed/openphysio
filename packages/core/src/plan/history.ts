import type { PlanHistory } from "./generate.ts";

/** What buildHistory needs to know about an exercise; the catalogue supplies it (core does not import the catalogue). */
export type HistoryLookup = (id: string) => { primaryMuscles: readonly string[]; countsTowardLoad: boolean } | undefined;

/**
 * Plan history from logged rows. Hard set = a set with rpe >= 7 or no rpe, on an exercise that counts toward load;
 * it counts for each of the exercise's primaryMuscles, one entry per workout and muscle.
 */
export function buildHistory(
  workouts: readonly { id: string; type: string; startedAt: number; distanceM: number | null }[],
  sets: readonly { workoutId: string; exerciseId: string; rpe: number | null; footContacts: number | null }[],
  lookup: HistoryLookup,
): PlanHistory {
  const h: PlanHistory = { runs: [], plyoContacts: [], hardSetsByMuscle: {} };
  for (const w of workouts) {
    if (w.type === "run" && w.distanceM) h.runs.push({ at: w.startedAt, distanceM: w.distanceM });
    const mine = sets.filter((s) => s.workoutId === w.id);
    const contacts = mine.reduce((n, s) => n + (s.footContacts ?? 0), 0);
    if (contacts > 0) h.plyoContacts.push({ at: w.startedAt, contacts });
    const perMuscle: Record<string, number> = {};
    for (const s of mine) {
      const e = lookup(s.exerciseId);
      if (!e || !e.countsTowardLoad || (s.rpe != null && s.rpe < 7)) continue;
      for (const m of e.primaryMuscles) perMuscle[m] = (perMuscle[m] ?? 0) + 1;
    }
    for (const [m, n] of Object.entries(perMuscle)) (h.hardSetsByMuscle[m] ??= []).push({ at: w.startedAt, sets: n });
  }
  return h;
}
