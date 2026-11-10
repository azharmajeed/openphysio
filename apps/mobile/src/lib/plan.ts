import type { Exercise } from "@openphysio/catalog";
import type { PlanItem } from "@openphysio/core";
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
