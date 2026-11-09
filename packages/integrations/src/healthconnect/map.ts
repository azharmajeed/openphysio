import type { WorkoutType } from "@openphysio/core";
import { EXERCISE_TYPE_TO_WORKOUT } from "./exerciseTypes.ts";

// Structural subsets of react-native-health-connect records, so this package stays pure.
type Meta = { metadata?: { id?: string } };
type Span = Meta & { startTime: string; endTime: string };
export type HcRecords = {
  steps?: (Span & { count: number })[];
  heartRate?: (Span & { samples: { time: string; beatsPerMinute: number }[] })[];
  sleep?: (Span & { stages?: { startTime: string; endTime: string; stage: number }[] })[];
  exercise?: (Span & { exerciseType: number; title?: string })[];
  distance?: (Span & { distance: { inMeters: number } })[];
  activeCalories?: (Span & { energy: { inKilocalories: number } })[];
};

export type DailyRow = {
  id: string;
  updatedAt: number;
  deletedAt: null;
  date: string;
  steps: number | null;
  restingHr: number | null;
  sleepMin: number | null;
  activeKcal: number | null;
  source: "band";
};
export type HrRow = { id: string; updatedAt: number; deletedAt: null; t: number; bpm: number };
export type WorkoutRow = {
  id: string;
  updatedAt: number;
  deletedAt: null;
  type: WorkoutType;
  startedAt: number;
  endedAt: number;
  source: "band";
  distanceM: number | null;
  durationS: number;
  avgHr: number | null;
  notes: string | null;
};

// Health Connect SleepStageType: 1 AWAKE and 3 OUT_OF_BED are not sleep.
const NOT_SLEEP = new Set([1, 3]);

/** Stable uuid-shaped id from a string (4 seeded FNV-1a rounds), so re-imports upsert instead of duplicating. */
export function stableId(key: string): string {
  let hex = "";
  for (let s = 0; s < 4; s++) {
    let h = (0x811c9dc5 ^ Math.imul(s, 0x9e3779b1)) >>> 0;
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193) >>> 0;
    hex += h.toString(16).padStart(8, "0");
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const pad = (n: number) => String(n).padStart(2, "0");
/** Local calendar date (YYYY-MM-DD) of an instant. */
export const localDate = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? Math.round((s[(s.length - 1) >> 1]! + s[s.length >> 1]!) / 2) : null;
};
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const ms = (iso: string) => Date.parse(iso);

/** Pure mapping: Health Connect records -> health_daily, health_hr_sample and workout rows (source band). */
export function mapHealthConnect(rec: HcRecords, now = Date.now()) {
  const base = { updatedAt: now, deletedAt: null } as const;

  const hr = (rec.heartRate ?? []).flatMap((r) =>
    r.samples.map((s) => ({ t: ms(s.time), bpm: s.beatsPerMinute })),
  );
  const hrSamples: HrRow[] = hr.map((s) => ({ ...base, id: stableId(`hr:${s.t}`), ...s }));
  const hrBetween = (a: number, b: number) =>
    median(hr.filter((s) => s.t >= a && s.t <= b).map((s) => s.bpm));

  const days = new Map<string, DailyRow>();
  const day = (date: string) => {
    let d = days.get(date);
    if (!d) {
      d = {
        ...base,
        id: stableId(`daily:${date}:band`),
        date,
        steps: null,
        restingHr: null,
        sleepMin: null,
        activeKcal: null,
        source: "band",
      };
      days.set(date, d);
    }
    return d;
  };
  for (const r of rec.steps ?? []) {
    const d = day(localDate(ms(r.startTime)));
    d.steps = (d.steps ?? 0) + r.count;
  }
  for (const r of rec.activeCalories ?? []) {
    const d = day(localDate(ms(r.startTime)));
    d.activeKcal = Math.round((d.activeKcal ?? 0) + r.energy.inKilocalories);
  }
  for (const r of rec.sleep ?? []) {
    const [a, b] = [ms(r.startTime), ms(r.endTime)];
    const asleepMs = r.stages?.length
      ? sum(
          r.stages
            .filter((s) => !NOT_SLEEP.has(s.stage))
            .map((s) => ms(s.endTime) - ms(s.startTime)),
        )
      : b - a;
    const d = day(localDate(b)); // a night belongs to the day you wake up
    d.sleepMin = (d.sleepMin ?? 0) + Math.round(asleepMs / 60000);
    // Resting HR proxy: median heart rate while asleep.
    d.restingHr = hrBetween(a, b) ?? d.restingHr;
  }

  const workouts: WorkoutRow[] = [];
  for (const r of rec.exercise ?? []) {
    const type = EXERCISE_TYPE_TO_WORKOUT[r.exerciseType];
    if (!type) continue;
    const [a, b] = [ms(r.startTime), ms(r.endTime)];
    const dist = sum(
      (rec.distance ?? [])
        .filter((d) => ms(d.startTime) >= a && ms(d.endTime) <= b)
        .map((d) => d.distance.inMeters),
    );
    workouts.push({
      ...base,
      id: stableId(`workout:${r.metadata?.id ?? `${r.exerciseType}:${a}:${b}`}`),
      type,
      startedAt: a,
      endedAt: b,
      source: "band",
      distanceM: dist || null,
      durationS: Math.round((b - a) / 1000),
      avgHr: hrBetween(a, b),
      notes: r.title ?? null,
    });
  }
  return { daily: [...days.values()], hrSamples, workouts };
}
