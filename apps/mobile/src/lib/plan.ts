import { getExercise, type Exercise } from "@openphysio/catalog";
import type { PlanHistory, PlanItem } from "@openphysio/core";
import { draftFor, type SetDraft } from "./log";

const pad = (n: number) => String(n).padStart(2, "0");
/** Local calendar date, YYYY-MM-DD (the format planned_session.date uses). */
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return ymd(d);
};

const PALETTE = ["#2563eb", "#059669", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#65a30d", "#dc2626", "#4f46e5"];
/** Same type string, same colour; no type-to-colour table. */
export const typeColor = (type: string) =>
  PALETTE[Math.abs([...type].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261)) % PALETTE.length]!;

type Lookup = (id: string) => { primaryMuscles: readonly string[]; sessionTypes: readonly string[] } | undefined;
/** Exercises that only warm up or mobilise do not count as hard work. */
const LIGHT_TYPES = ["warmup", "mobility"];

/**
 * Plan history from logged rows. Hard set = a set with rpe >= 7 or no rpe, on an exercise that is not warm-up/mobility only;
 * it counts for each of the exercise's primaryMuscles, one entry per workout and muscle.
 */
export function buildHistory(
  workouts: { id: string; type: string; startedAt: number; distanceM: number | null }[],
  sets: { workoutId: string; exerciseId: string; rpe: number | null; footContacts: number | null }[],
  lookup: Lookup = getExercise,
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
      if (!e || e.sessionTypes.every((t) => LIGHT_TYPES.includes(t)) || (s.rpe != null && s.rpe < 7)) continue;
      for (const m of e.primaryMuscles) perMuscle[m] = (perMuscle[m] ?? 0) + 1;
    }
    for (const [m, n] of Object.entries(perMuscle)) (h.hardSetsByMuscle[m] ??= []).push({ at: w.startedAt, sets: n });
  }
  return h;
}

/** Target as text: "3 × 10 reps", "3 × 30 s", "35 min", "3 × 200 m". */
export function describeItem(i: PlanItem): string {
  const unit = { reps: "reps", seconds: "s", minutes: "min", meters: "m" }[i.unit];
  const amt = `${i.amount} ${unit}`;
  const base = i.sets > 1 ? `${i.sets} × ${amt}` : amt;
  return [base, i.intensity, i.distanceM ? `~${(i.distanceM / 1000).toFixed(1)} km` : ""].filter(Boolean).join(", ");
}

/** Days from the first to the last session, cut into weeks starting at the first session's date. */
export function calendar<T extends { date: string }>(sessions: T[]) {
  if (!sessions.length) return [];
  const dates = sessions.map((s) => s.date).sort();
  const first = dates[0]!;
  const last = dates.at(-1)!;
  const total = Math.round((Date.parse(`${last}T12:00:00Z`) - Date.parse(`${first}T12:00:00Z`)) / 86_400_000) + 1;
  const weeks: { date: string; sessions: T[] }[][] = [];
  for (let i = 0; i < Math.ceil(total / 7) * 7; i++) {
    const date = addDays(first, i);
    (weeks[Math.floor(i / 7)] ??= []).push({ date, sessions: sessions.filter((s) => s.date === date) });
  }
  return weeks;
}

/** Draft for a planned item: the target when the exercise has no logged set yet. */
export function targetDraft(e: Exercise, item: PlanItem | undefined, last?: Parameters<typeof draftFor>[1]): SetDraft {
  const d = draftFor(e, last);
  if (last || !item) return d;
  if (e.unit === "reps") return { ...d, reps: item.amount };
  if (e.unit === "seconds") return { ...d, durationS: item.amount };
  if (e.unit === "minutes") return { ...d, durationS: item.amount * 60 };
  return d;
}

/** Quick-log form text to numbers; null when the duration is not a positive number. */
export function parseQuick(minutes: string, distance: string, unit: "km" | "m") {
  const num = (s: string) => Number(s.trim().replace(",", "."));
  const min = num(minutes);
  if (!(min > 0)) return null;
  const dist = distance.trim() === "" ? 0 : num(distance);
  if (!(dist >= 0)) return null;
  return { durationS: Math.round(min * 60), distanceM: dist ? Math.round(unit === "km" ? dist * 1000 : dist) : null };
}
