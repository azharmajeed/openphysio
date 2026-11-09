import type { Sex } from "../types/index.ts";

const MIFFLIN = "src-mifflin-1990";
const PROTEIN = "src-issn-protein-2017";
const SURPLUS = "src-energy-surplus";
const DAY_MS = 86_400_000;

export const TREND_ADJUST_KCAL = 150;
export const GAIN_PCT_PER_WEEK = { min: 0.25, max: 0.5 } as const;

export interface MaintenanceInput {
  weightKg: number;
  heightCm: number;
  birthYear: number;
  sex: Sex;
  sessionsPerWeek: number;
}

/** Activity factor from sessions/week. Coaching convention, grade C (Mifflin-St Jeor gives BMR only). */
export function activityFactor(sessionsPerWeek: number): number {
  if (sessionsPerWeek < 2) return 1.2;
  if (sessionsPerWeek < 4) return 1.375;
  if (sessionsPerWeek < 6) return 1.55;
  return 1.725;
}

/** Mifflin-St Jeor BMR. Sex 'other' uses the average of the male (+5) and female (-161) constants, i.e. -78. */
export function bmr(
  i: Pick<MaintenanceInput, "weightKg" | "heightCm" | "birthYear" | "sex">,
  now: Date,
): number {
  const age = now.getUTCFullYear() - i.birthYear;
  const constant = i.sex === "male" ? 5 : i.sex === "female" ? -161 : (5 - 161) / 2;
  return 10 * i.weightKg + 6.25 * i.heightCm - 5 * age + constant;
}

export function maintenanceKcal(i: MaintenanceInput, now: Date) {
  return {
    kcal: Math.round(bmr(i, now) * activityFactor(i.sessionsPerWeek)),
    sexOtherAveraged: i.sex === "other",
    sourceIds: [MIFFLIN],
  };
}

/** Extra kcal on a training day: the band's active kcal when given, else 0. */
export function trainingDayAddOn(bandActiveKcal?: number | null) {
  return {
    kcal: bandActiveKcal && bandActiveKcal > 0 ? Math.round(bandActiveKcal) : 0,
    sourceIds: [] as string[],
  };
}

export function proteinTargets(weightKg: number) {
  return {
    proteinG: { min: Math.round(1.4 * weightKg), max: Math.round(2.0 * weightKg) },
    perMealG: Math.round(0.25 * weightKg),
    sourceIds: [PROTEIN],
  };
}

/** Weekly gain target in kg. Low end (0.25%) by default. */
export function weeklyGainTarget(weightKg: number, end: "low" | "high" = "low") {
  return {
    kgPerWeek: +((weightKg * GAIN_PCT_PER_WEEK[end === "low" ? "min" : "max"]) / 100).toFixed(3),
    pctRange: GAIN_PCT_PER_WEEK,
    sourceIds: [SURPLUS],
  };
}

export interface DailyTargetsInput extends MaintenanceInput {
  trainingDay?: boolean;
  bandActiveKcal?: number | null;
  /** adjustFromTrend().deltaKcal; defaults to 0. */
  trendDeltaKcal?: number;
}

/**
 * Daily target: maintenance + 10% surplus (low end of 10-20%) + band add-on + trend delta.
 * With band active kcal the band measures the training, so maintenance uses the sedentary factor
 * (1.2) instead of the sessions/week factor; otherwise training would be counted twice.
 */
export function dailyTargets(i: DailyTargetsInput, now: Date) {
  const band = trainingDayAddOn(i.bandActiveKcal).kcal;
  const m = maintenanceKcal(band > 0 ? { ...i, sessionsPerWeek: 0 } : i, now);
  const surplus = Math.round(m.kcal * 0.1);
  const addOn = band;
  const p = proteinTargets(i.weightKg);
  return {
    kcal: m.kcal + surplus + addOn + (i.trendDeltaKcal ?? 0),
    maintenanceKcal: m.kcal,
    sexOtherAveraged: m.sexOtherAveraged,
    proteinG: p.proteinG,
    perMealG: p.perMealG,
    sourceIds: [...m.sourceIds, ...p.sourceIds, SURPLUS],
  };
}

export interface WeightPoint {
  date: string; // YYYY-MM-DD
  kg: number;
}

export type TrendResult =
  | { status: "not_enough_data"; deltaKcal: 0; sourceIds: string[]; grade: "C" }
  | {
      status: "too_slow" | "too_fast" | "on_track";
      deltaKcal: number;
      kgPerWeek: number;
      pctPerWeek: number;
      sourceIds: string[];
      grade: "C";
      label: string;
    };

/** 14-day linear-fit weight trend vs the 0.25-0.5%/week target. App rule, coaching convention (grade C). */
export function adjustFromTrend(weights: WeightPoint[], now: Date): TrendResult {
  const base = { sourceIds: [SURPLUS], grade: "C" as const };
  const end = now.getTime();
  const pts = weights
    .map((w) => ({ t: Date.parse(w.date), kg: w.kg }))
    .filter((p) => p.t <= end && p.t > end - 14 * DAY_MS)
    .sort((a, b) => a.t - b.t);
  if (pts.length < 4 || (pts[pts.length - 1].t - pts[0].t) / DAY_MS < 10) {
    return { status: "not_enough_data", deltaKcal: 0, ...base };
  }
  const n = pts.length;
  const mt = pts.reduce((s, p) => s + p.t, 0) / n;
  const mk = pts.reduce((s, p) => s + p.kg, 0) / n;
  const slope =
    pts.reduce((s, p) => s + (p.t - mt) * (p.kg - mk), 0) /
    pts.reduce((s, p) => s + (p.t - mt) ** 2, 0);
  const kgPerWeek = slope * 7 * DAY_MS;
  const pctPerWeek = (kgPerWeek / mk) * 100;
  const [status, deltaKcal] =
    pctPerWeek < GAIN_PCT_PER_WEEK.min
      ? (["too_slow", TREND_ADJUST_KCAL] as const)
      : pctPerWeek > GAIN_PCT_PER_WEEK.max
        ? (["too_fast", -TREND_ADJUST_KCAL] as const)
        : (["on_track", 0] as const);
  return {
    status,
    deltaKcal,
    kgPerWeek: +kgPerWeek.toFixed(3),
    pctPerWeek: +pctPerWeek.toFixed(3),
    label: "Coaching convention (grade C): adjust 150 kcal from the 2-week trend",
    ...base,
  };
}
