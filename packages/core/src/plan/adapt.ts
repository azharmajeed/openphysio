import { painAdvice, spikeGuard, type SpikeMetric } from "../safety/index.ts";
import type { BodyArea, PainKind } from "../types/index.ts";
import type { PlanExercise, PlanHistory, PlanItem, PlannedSessionRow } from "./generate.ts";

/**
 * Every threshold the weekly adaptation uses. Tuning defaults, not clinical limits:
 * grade C coaching conventions, citing the load/recovery consensus the other safety rules use.
 */
export const ADAPT_CONFIG = {
  grade: "C",
  sourceIds: ["src-ioc-load-2016"],
  /** Regress an exercise when its logged sets this week average at least this RPE (needs minSets sets). */
  rpeHigh: 9,
  /** Progress only exercises whose logged sets average at or below this RPE. */
  rpeProgressMax: 8,
  minSets: 2,
  /** Share of this week's due sessions that must be done before anything progresses. */
  progressCompletion: 0.75,
  minSessionsForCompletion: 2,
  /** Sets added to an exercise when it progresses. */
  progressSets: 1,
  /** Run minutes grow by this ratio when a run progresses. */
  progressRunRatio: 1.05,
  /** Sets removed per exercise for one "notch" of lower intensity. */
  lowerSets: 1,
  /** Poor sleep: mean sleep of the last sleepDays days under this many minutes. */
  sleepDays: 3,
  sleepLowMin: 360,
  /** Resting HR spike: mean of the last hrDays days this far above the earlier baseline. */
  hrDays: 3,
  hrSpikeRatio: 1.08,
  hrBaselineMinDays: 5,
  /** The Today check-in appears when this many days or fewer remain in the plan week. */
  checkinDays: 2,
  /** How far back recovery rows count. */
  recoveryWindowDays: 28,
} as const;

export type ChangeKind = "regress" | "progress" | "remove" | "lower_intensity" | "keep";

export interface AdaptChange {
  sessionId: string;
  kind: ChangeKind;
  exerciseId?: string;
  from: string;
  to: string;
  /** Plain words. */
  reason: string;
  /** Pain stop: the user should see a physio, not just train around it. */
  flag?: boolean;
  sourceIds?: readonly string[];
  grade?: string;
}

export type AdaptExercise = PlanExercise & { loads: readonly BodyArea[]; progressionId?: string };

export interface AdaptInput {
  /** All planned sessions; the engine picks this week and next week itself. */
  block: readonly PlannedSessionRow[];
  /** Logged sets in this week. */
  logs: readonly { exerciseId: string; rpe: number | null; at: number }[];
  pain: readonly { bodyArea: BodyArea; score: number; kind: PainKind; exerciseId?: string | null; at: number }[];
  recovery: readonly { date: string; sleepMin?: number | null; restingHr?: number | null }[];
  /** Catalogue (structural; core does not import it). */
  exercises: readonly AdaptExercise[];
  history: PlanHistory;
  now: number;
}

export interface WeekWindow {
  /** The plan's own 7-day weeks counted from its first session. YYYY-MM-DD, inclusive. */
  current: { start: string; end: string };
  next: { start: string; end: string };
}

export interface AdaptResult {
  changes: AdaptChange[];
  /** Next-week sessions with the changes applied (updatedAt bumped), ready to save. */
  sessions: PlannedSessionRow[];
  week: WeekWindow | null;
}

const DAY_MS = 86_400_000;
const day = (d: string) => Date.parse(`${d}T12:00:00Z`);
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const plus = (d: string, n: number) => iso(day(d) + n * DAY_MS);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.max(lo, Math.min(hi, v));
const words = (s: string) => s.replace(/[-_]/g, " ");

/** Plan weeks are 7-day chunks from the first session; null when today is outside the plan or no later week exists. */
export function weekWindow(block: readonly { date: string }[], today: string): WeekWindow | null {
  const dates = block.map((s) => s.date).sort();
  if (!dates.length) return null;
  const n = Math.floor((day(today) - day(dates[0]!)) / (7 * DAY_MS));
  if (n < 0) return null;
  const start = plus(dates[0]!, n * 7);
  const next = plus(start, 7);
  if (next > dates.at(-1)!) return null;
  return { current: { start, end: plus(start, 6) }, next: { start: next, end: plus(next, 6) } };
}

/** Days left in the current plan week, today included. */
export const daysLeftInWeek = (w: WeekWindow, today: string) => Math.round((day(w.current.end) - day(today)) / DAY_MS) + 1;

function recoveryNote(recovery: AdaptInput["recovery"], today: string): string | null {
  const c = ADAPT_CONFIG;
  const rows = recovery
    .filter((r) => r.date <= today && day(today) - day(r.date) < c.recoveryWindowDays * DAY_MS)
    .sort((a, b) => b.date.localeCompare(a.date));
  const vals = (k: "sleepMin" | "restingHr", from: number, to?: number) =>
    rows.slice(from, to).map((r) => r[k]).filter((v): v is number => v != null);
  const sleep = vals("sleepMin", 0, c.sleepDays);
  if (sleep.length === c.sleepDays && mean(sleep) < c.sleepLowMin) return `you slept about ${(mean(sleep) / 60).toFixed(1)} h a night lately`;
  const hr = vals("restingHr", 0, c.hrDays);
  const base = vals("restingHr", c.hrDays);
  if (hr.length === c.hrDays && base.length >= c.hrBaselineMinDays && mean(hr) > mean(base) * c.hrSpikeRatio)
    return `your resting heart rate is up (${Math.round(mean(hr))} vs about ${Math.round(mean(base))})`;
  return null;
}

const PAIN_RANK = { continue: 0, easier_variant: 1, stop_see_physio: 2 } as const;

/** Adjusts next week's planned sessions from what this week actually looked like. Pure; never mutates the input. */
export function adaptNextWeek(input: AdaptInput): AdaptResult {
  const c = ADAPT_CONFIG;
  const today = iso(input.now);
  const week = weekWindow(input.block, today);
  if (!week) return { changes: [], sessions: [], week };
  const meta = { sourceIds: c.sourceIds, grade: c.grade };
  const ex = new Map(input.exercises.map((e) => [e.id, e]));
  const inWeek = (s: { date: string }, w: { start: string; end: string }) => s.date >= w.start && s.date <= w.end;
  const live = input.block.filter((s) => !s.deletedAt);
  const cur = live.filter((s) => inWeek(s, week.current));
  const next = live.filter((s) => s.status === "planned" && inWeek(s, week.next));
  const changes: AdaptChange[] = [];

  // Missed sessions are dropped, never stacked onto next week.
  for (const s of cur.filter((s) => s.status !== "done" && s.date < today))
    changes.push({ sessionId: s.id, kind: "keep", from: s.title, to: s.title, reason: `You missed "${s.title}" (${s.date}). It is not added to next week, so the week stays doable.` });

  const done = cur.filter((s) => s.status === "done").length;
  const due = cur.filter((s) => s.status === "done" || s.date <= today).length;
  const goodWeek = due >= c.minSessionsForCompletion && done / due >= c.progressCompletion;

  const rpes = new Map<string, number[]>();
  for (const l of input.logs) if (l.rpe != null) rpes.set(l.exerciseId, [...(rpes.get(l.exerciseId) ?? []), l.rpe]);
  const rpeAvg = (id: string) => {
    const r = rpes.get(id) ?? [];
    return r.length >= c.minSets ? mean(r) : null;
  };

  // Worst advice per body area, plus the exercises the pain was logged on.
  const areas = new Map<BodyArea, { level: keyof typeof PAIN_RANK; ids: Set<string> }>();
  for (const p of input.pain) {
    const level = painAdvice({ score: p.score, kind: p.kind });
    const a = areas.get(p.bodyArea) ?? { level: "continue" as const, ids: new Set<string>() };
    if (PAIN_RANK[level] > PAIN_RANK[a.level]) a.level = level;
    if (p.exerciseId && level !== "continue") a.ids.add(p.exerciseId);
    areas.set(p.bodyArea, a);
  }
  /** Body area whose pain is at `level` and either was logged on this exercise or is loaded by it. */
  const painFor = (id: string, level: "easier_variant" | "stop_see_physio") =>
    [...areas].find(([area, a]) => a.level === level && (a.ids.has(id) || ex.get(id)?.loads.includes(area)))?.[0];

  const tired = recoveryNote(input.recovery, today);
  const out: PlannedSessionRow[] = [];

  for (const s of next) {
    const log = (ch: Omit<AdaptChange, "sessionId">) => changes.push({ sessionId: s.id, ...meta, ...ch });
    let items: PlanItem[] = [];
    for (const i of s.items) {
      const stop = painFor(i.exerciseId, "stop_see_physio");
      if (stop) {
        log({ kind: "remove", exerciseId: i.exerciseId, flag: true, from: words(i.exerciseId), to: "removed", reason: `You logged pain in your ${words(stop)} that needs a physio. ${words(i.exerciseId)} loads it, so it is out until you have had it checked.` });
        continue;
      }
      const easier = painFor(i.exerciseId, "easier_variant");
      const hard = rpeAvg(i.exerciseId);
      if (easier || (hard != null && hard >= c.rpeHigh)) {
        const why = easier ? `You logged ${words(easier)} pain above the comfortable level` : `This felt like RPE ${hard!.toFixed(1)} on average (limit ${c.rpeHigh})`;
        const reg = ex.get(ex.get(i.exerciseId)?.regressionId ?? "");
        if (reg) {
          log({ kind: "regress", exerciseId: i.exerciseId, from: words(i.exerciseId), to: words(reg.id), reason: `${why}, so next week uses the easier version.` });
          items.push({ ...i, exerciseId: reg.id, unit: reg.unit, amount: clamp(i.amount, reg.rx.amount), muscles: [...reg.primaryMuscles] });
          continue;
        }
        if (i.sets > 1) {
          log({ kind: "lower_intensity", exerciseId: i.exerciseId, from: `${i.sets} sets`, to: `${i.sets - c.lowerSets} sets`, reason: `${why} and there is no easier version, so one set fewer.` });
          items.push({ ...i, sets: i.sets - c.lowerSets });
          continue;
        }
      }
      items.push({ ...i });
    }

    if (tired) {
      const n = items.filter((i) => i.sets > 1).length;
      if (n) {
        items = items.map((i) => (i.sets > 1 ? { ...i, sets: i.sets - c.lowerSets } : i));
        log({ kind: "lower_intensity", from: "planned volume", to: `${c.lowerSets} set fewer on ${n} exercise(s)`, reason: `Recovery looks low: ${tired}. One notch easier this session (a coaching convention, grade ${c.grade}, not a medical rule).` });
      }
    } else if (goodWeek) {
      const orig = new Set(s.items.map((i) => i.exerciseId));
      items = items.map((i) => {
        const avg = rpeAvg(i.exerciseId);
        if (!orig.has(i.exerciseId) || painFor(i.exerciseId, "easier_variant") || avg == null || avg > c.rpeProgressMax) return i;
        const up = grow(i, items, input, s.date);
        if (!up) return i;
        log({ kind: "progress", exerciseId: i.exerciseId, from: describe(i), to: describe(up), reason: `You did ${done} of ${due} sessions and this felt manageable (RPE ${avg.toFixed(1)}), so a little more, within the safe weekly increase.` });
        return up;
      });
    }

    if (JSON.stringify(items) !== JSON.stringify(s.items)) out.push({ ...s, items, updatedAt: input.now });
  }
  return { changes, sessions: out, week };
}

const describe = (i: PlanItem) => (i.distanceM ? `${i.amount} min` : `${i.sets} sets`);

/** One step up for an item, or null when the spike guard says no (no recent history also means no). */
function grow(i: PlanItem, all: PlanItem[], input: AdaptInput, date: string): PlanItem | null {
  const c = ADAPT_CONFIG;
  const at = Date.parse(`${date}T12:00:00Z`);
  const capped = (metric: SpikeMetric, planned: number, history: { at: number; value: number }[]) =>
    spikeGuard({ metric, planned, history, now: at, starter: 0 }).capped;
  if (i.distanceM) {
    const amount = Math.round(i.amount * c.progressRunRatio);
    const m = (i.distanceM * amount) / i.amount;
    return amount > i.amount && !capped("run_distance_m", m, input.history.runs.map((r) => ({ at: r.at, value: r.distanceM }))) ? { ...i, amount, distanceM: m } : null;
  }
  const sets = i.sets + c.progressSets;
  if (i.footContacts) {
    const fc = (i.footContacts / i.sets) * sets;
    return capped("foot_contacts", fc, input.history.plyoContacts.map((p) => ({ at: p.at, value: p.contacts }))) ? null : { ...i, sets, footContacts: fc };
  }
  for (const m of i.muscles) {
    const total = all.reduce((n, x) => n + (x.muscles.includes(m) ? x.sets : 0), 0) + c.progressSets;
    if (capped("hard_sets", total, (input.history.hardSetsByMuscle[m] ?? []).map((h) => ({ at: h.at, value: h.sets })))) return null;
  }
  return { ...i, sets };
}
