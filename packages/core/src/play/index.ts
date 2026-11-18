import { painAdvice } from "../safety/index.ts";
import type { LedgerEntry, PlayEvent, PlayInput, StreakResult } from "./types.ts";

export * from "./types.ts";

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const utc = (date: string) => Date.parse(`${date}T00:00:00Z`);
const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const DAY = 86_400_000;

/** First day of the week containing `date` (YYYY-MM-DD). */
export function weekStart(date: string, weekStartsOn: number): string {
  const ms = utc(date);
  return fmt(ms - ((new Date(ms).getUTCDay() - weekStartsOn + 7) % 7) * DAY);
}

const live = <T extends { deletedAt?: number | null }>(xs: readonly T[]) => xs.filter((x) => x.deletedAt == null);
const sortBy = <T>(xs: T[], k: (x: T) => string) => xs.sort((a, b) => (k(a) < k(b) ? -1 : k(a) > k(b) ? 1 : 0));
const num = (n: number) => String(n).padStart(17, "0");

type Candidate = { t: number; date: string; event: PlayEvent; refId: string };

function analyse(input: PlayInput) {
  const { rules } = input;
  const dateOf = input.toDate ?? localDate;
  const planned = new Map(live(input.planned).map((p) => [p.id, p]));
  const workouts = sortBy(
    live(input.workouts).filter((w) => w.endedAt != null),
    (w) => num(w.startedAt) + w.id,
  );
  const sets = live(input.sets);
  // Pain stop = the pain monitor's "stop_see_physio" (sharp, swelling, giving way). Reused, not re-derived.
  const stops = live(input.pain).filter((p) => painAdvice({ score: p.score, kind: p.kind }) === "stop_see_physio");
  const startOf = new Map(workouts.map((w) => [w.id, w.startedAt]));

  const out: Candidate[] = [];
  const doneIds = new Set<string>();
  const unplannedDays = new Set<string>();
  const rewarded = new Map<string, number>(); // `${plannedId}:${exerciseId}` -> sets already rewarded
  const seen = new Set<string>();

  for (const w of workouts) {
    const date = dateOf(w.startedAt);
    // Any workout after a pain stop the same day earns nothing.
    const afterStop = stops.some((s) => {
      if (dateOf(s.at) !== date) return false;
      const sw = s.workoutId && s.workoutId !== w.id ? startOf.get(s.workoutId) : undefined;
      return s.at <= w.startedAt || (sw != null && sw < w.startedAt);
    });
    if (afterStop) continue;
    const stopAt = Math.min(Infinity, ...stops.filter((s) => s.workoutId === w.id).map((s) => s.at));
    const mine = sortBy(
      sets.filter((s) => s.workoutId === w.id),
      (s) => `${s.exerciseId}\0${String(s.setIndex).padStart(6, "0")}`,
    );
    const p = w.plannedSessionId ? planned.get(w.plannedSessionId) : undefined;
    // A session that hit a pain stop is not "completed"; an empty start/stop is not a session.
    const completes = stopAt === Infinity && (mine.length > 0 || (w.durationS ?? 0) > 0);

    if (p) {
      if (completes && !doneIds.has(p.id)) {
        doneIds.add(p.id);
        out.push({ t: w.startedAt, date, event: "plannedSessionCompleted", refId: p.id });
      }
      const allowed = new Map<string, number>();
      for (const l of [...p.items, ...(p.warmup ?? [])]) allowed.set(l.exerciseId, (allowed.get(l.exerciseId) ?? 0) + l.sets);
      for (const s of mine) {
        if (s.updatedAt >= stopAt) continue;
        const key = `${w.id}:${s.exerciseId}:${s.setIndex}`;
        const cap = `${p.id}:${s.exerciseId}`;
        if (seen.has(key) || (rewarded.get(cap) ?? 0) >= (allowed.get(s.exerciseId) ?? 0)) continue;
        seen.add(key);
        rewarded.set(cap, (rewarded.get(cap) ?? 0) + 1);
        out.push({ t: s.updatedAt, date, event: "setLogged", refId: key });
      }
    } else if (completes && !unplannedDays.has(date)) {
      unplannedDays.add(date);
      out.push({ t: w.startedAt, date, event: "unplannedSessionLogged", refId: date });
    }
  }

  // Answering a pain check always earns (honest reporting is never punished), once per workout or day.
  for (const p of live(input.pain)) {
    const date = dateOf(p.at);
    out.push({ t: p.at, date, event: "painCheckAnswered", refId: p.workoutId ?? date });
  }
  const checkedWeeks = new Set<string>();
  for (const d of [...input.checkIns].sort()) {
    const wk = weekStart(d, rules.weekStartsOn);
    if (checkedWeeks.has(wk)) continue;
    checkedWeeks.add(wk);
    out.push({ t: Number.MAX_SAFE_INTEGER, date: d, event: "weeklyCheckIn", refId: wk });
  }

  // Id comes from the event key, so a repeat is dropped. Then the daily cap, in time order.
  sortBy(out, (c) => num(c.t) + c.event + c.refId);
  const ids = new Set<string>();
  const spent = new Map<string, number>();
  const ledger: LedgerEntry[] = [];
  for (const c of out) {
    const id = `${c.event}:${c.refId}`;
    if (ids.has(id)) continue;
    ids.add(id);
    const points = Math.min(rules.points[c.event], rules.dailyCap - (spent.get(c.date) ?? 0));
    if (points <= 0) continue;
    spent.set(c.date, (spent.get(c.date) ?? 0) + points);
    ledger.push({ id, date: c.date, event: c.event, points, refId: c.refId });
  }
  return { ledger, doneIds, stopDates: stops.map((s) => dateOf(s.at)), planned };
}

/** Consistency points from the logs. Same logs, same ledger: ids come from the event, so nothing counts twice. */
export function computeLedger(input: PlayInput): LedgerEntry[] {
  return analyse(input).ledger;
}

/**
 * Weekly streak. A week counts when done/planned >= threshold. A week with nothing planned is neutral: it neither counts nor breaks
 * (so a streak cannot grow with no plan; a planned week with fewer sessions is handled by the threshold).
 * A week with a pain stop that missed the threshold is frozen: neither counts nor breaks.
 * The running week can count once met but never breaks.
 */
export function computeStreak(input: PlayInput & { today: string }): StreakResult {
  const { rules, today } = input;
  const { ledger, doneIds, stopDates, planned } = analyse(input);
  const wkOf = (d: string) => weekStart(d, rules.weekStartsOn);
  const weeks = new Map<string, { done: number; planned: number }>();
  for (const p of planned.values()) {
    const w = weeks.get(wkOf(p.date)) ?? { done: 0, planned: 0 };
    w.planned++;
    if (doneIds.has(p.id)) w.done++;
    weeks.set(wkOf(p.date), w);
  }
  const frozen = new Set(stopDates.map(wkOf));
  const thisWeek = wkOf(today);
  let current = 0;
  let best = 0;
  const first = [...weeks.keys()].sort()[0];
  for (let ms = first ? utc(first) : utc(thisWeek) + 1; ms <= utc(thisWeek); ms += 7 * DAY) {
    const wk = fmt(ms);
    const w = weeks.get(wk) ?? { done: 0, planned: 0 };
    const running = wk === thisWeek;
    if (w.planned === 0) continue; // neutral
    if (w.done >= rules.streak.threshold * w.planned - 1e-9) best = Math.max(best, ++current);
    else if (running || frozen.has(wk)) continue;
    else current = 0;
  }
  const w = weeks.get(thisWeek) ?? { done: 0, planned: 0 };
  const points = ledger.filter((e) => wkOf(e.date) === thisWeek).reduce((n, e) => n + e.points, 0);
  return { current, best, thisWeek: { weekStart: thisWeek, ...w, points } };
}
