import type { PlanGoal, WeightPoint } from "@openphysio/core";
import { addDays } from "./plan";

const WEEK_MS = 7 * 86_400_000;

export type Metric =
  | { kind: "run" }
  | { kind: "swim" }
  | { kind: "plyo" }
  | { kind: "strength"; muscles: string[] };

/**
 * Which trend cards the profile's goals call for, read from the goals' demands (no goal ids):
 * run demand -> run, swim workoutType -> swim, plyo demand -> plyo, strength demands -> hard sets per their muscles.
 */
export function metricsFor(goals: readonly PlanGoal[], profileGoalIds: readonly string[]): Metric[] {
  const demands = goals.filter((g) => profileGoalIds.includes(g.id)).flatMap((g) => g.demands);
  const out: Metric[] = [];
  if (demands.some((d) => d.kind === "run")) out.push({ kind: "run" });
  if (demands.some((d) => d.workoutType === "swim")) out.push({ kind: "swim" });
  if (demands.some((d) => d.kind === "plyo")) out.push({ kind: "plyo" });
  const muscles = [...new Set(demands.filter((d) => d.kind === "strength").flatMap((d) => d.muscles ?? []))];
  if (muscles.length) out.push({ kind: "strength", muscles });
  return out;
}

/** Totals for `weeks` rolling 7-day windows ending at `now`, oldest first. */
export function weeklyTotals(items: { at: number; value: number }[], now: number, weeks = 8): number[] {
  const out = new Array<number>(weeks).fill(0);
  for (const { at, value } of items) {
    const ago = Math.floor((now - at) / WEEK_MS);
    if (at <= now && ago < weeks) out[weeks - 1 - ago]! += value;
  }
  return out;
}

/** Fastest average pace (s/km) over runs of at least `minM`. Whole-run average: workouts keep no 5 km split. */
export function bestPace(runs: { distanceM: number | null; durationS: number | null }[], minM = 5000): number | null {
  const paces = runs.flatMap((r) => (r.distanceM && r.durationS && r.distanceM >= minM ? [r.durationS / (r.distanceM / 1000)] : []));
  return paces.length ? Math.min(...paces) : null;
}

/** One kg per day (the latest entry that day) for the last `days` days, oldest first. */
export function weightSeries(entries: { date: string; kg: number; updatedAt: number }[], today: string, days = 14): WeightPoint[] {
  const from = addDays(today, 1 - days);
  const byDate = new Map<string, { kg: number; updatedAt: number }>();
  for (const e of entries) {
    if (e.date < from || e.date > today) continue;
    const prev = byDate.get(e.date);
    if (!prev || e.updatedAt >= prev.updatedAt) byDate.set(e.date, e);
  }
  return [...byDate].map(([date, v]) => ({ date, kg: v.kg })).sort((a, b) => a.date.localeCompare(b.date));
}
