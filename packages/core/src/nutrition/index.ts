import type { Sex } from "../types/index.ts";

const MIFFLIN = "src-mifflin-1990";
const PROTEIN = "src-issn-protein-2017";
const DAY_MS = 86_400_000;

export const TREND_ADJUST_KCAL = 150;
/** Protein per meal, g per kg bodyweight (ISSN position stand). */
const PROTEIN_PER_MEAL_G_PER_KG = 0.25;

type Range = { min: number; max: number };

/**
 * Nutrition choices carried by a goal definition (data, see the catalogue). Magnitudes are positive;
 * `direction` gives the sign. energyPct: daily energy above (gain) or below (lose) maintenance.
 * weightPctPerWeek: target bodyweight change per week (maintain: tolerance either side of zero).
 */
export interface NutritionGoal {
  direction: "gain" | "maintain" | "lose";
  energyPct?: Range;
  weightPctPerWeek?: Range;
  proteinGPerKg?: Range;
  sourceIds: readonly string[];
}

export type NutritionSettings = Required<NutritionGoal>;

/** Used when no goal in the profile has a nutrition block. */
export const DEFAULT_NUTRITION: NutritionSettings = {
  direction: "maintain",
  energyPct: { min: 0, max: 0 },
  weightPctPerWeek: { min: 0.25, max: 0.25 }, // maintain tolerance, coaching convention (grade C)
  proteinGPerKg: { min: 1.4, max: 2.0 },
  sourceIds: [PROTEIN],
};

/**
 * Merge nutrition blocks of the profile's goals: the first block (order of `goals`) wins, except that
 * goals pulling in different directions cancel to maintain (keeping that first block's protein and sources).
 * No block: DEFAULT_NUTRITION.
 */
export function resolveNutrition(
  goals: readonly { id: string; nutrition?: NutritionGoal }[],
  profileGoalIds: readonly string[],
): NutritionSettings {
  const blocks = goals.flatMap((g) =>
    g.nutrition && profileGoalIds.includes(g.id) ? [g.nutrition] : [],
  );
  if (blocks.length === 0) return DEFAULT_NUTRITION;
  const first = { ...DEFAULT_NUTRITION, ...blocks[0] };
  if (blocks.some((b) => b.direction !== first.direction)) {
    return { ...DEFAULT_NUTRITION, proteinGPerKg: first.proteinGPerKg, sourceIds: first.sourceIds };
  }
  return first;
}

const SIGN = { gain: 1, maintain: 0, lose: -1 } as const;

/** Signed weekly weight-change band (%): gain min..max, lose -max..-min, maintain -tol..+tol. */
function pctBand(n: NutritionSettings): Range {
  const { min, max } = n.weightPctPerWeek;
  return n.direction === "gain"
    ? { min, max }
    : n.direction === "lose"
      ? { min: -max, max: -min }
      : { min: -max, max };
}

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

export function proteinTargets(weightKg: number, n: NutritionSettings) {
  return {
    proteinG: {
      min: Math.round(n.proteinGPerKg.min * weightKg),
      max: Math.round(n.proteinGPerKg.max * weightKg),
    },
    perMealG: Math.round(PROTEIN_PER_MEAL_G_PER_KG * weightKg),
    sourceIds: n.sourceIds,
  };
}

/** Signed weekly weight-change target in kg (negative = loss). Gentle end (smallest change) by default. */
export function weeklyWeightTarget(
  weightKg: number,
  n: NutritionSettings,
  end: "low" | "high" = "low",
) {
  const { min, max } = n.weightPctPerWeek;
  const pct = SIGN[n.direction] * (end === "low" ? min : max);
  return {
    kgPerWeek: +((weightKg * pct) / 100 || 0).toFixed(3),
    pctRange: pctBand(n),
    sourceIds: n.sourceIds,
  };
}

export interface DailyTargetsInput extends MaintenanceInput {
  trainingDay?: boolean;
  bandActiveKcal?: number | null;
  /** adjustFromTrend().deltaKcal; defaults to 0. */
  trendDeltaKcal?: number;
  nutrition: NutritionSettings;
}

/**
 * Daily target: maintenance + goal energy change (gentle end of the goal's range; none for maintain)
 * + band add-on + trend delta.
 * With band active kcal the band measures the training, so maintenance uses the sedentary factor
 * (1.2) instead of the sessions/week factor; otherwise training would be counted twice.
 */
export function dailyTargets(i: DailyTargetsInput, now: Date) {
  const band = trainingDayAddOn(i.bandActiveKcal).kcal;
  const m = maintenanceKcal(band > 0 ? { ...i, sessionsPerWeek: 0 } : i, now);
  const n = i.nutrition;
  const surplus = Math.round((m.kcal * SIGN[n.direction] * n.energyPct.min) / 100);
  const addOn = band;
  const p = proteinTargets(i.weightKg, n);
  return {
    kcal: m.kcal + surplus + addOn + (i.trendDeltaKcal ?? 0),
    maintenanceKcal: m.kcal,
    sexOtherAveraged: m.sexOtherAveraged,
    proteinG: p.proteinG,
    perMealG: p.perMealG,
    sourceIds: [...new Set([...m.sourceIds, ...p.sourceIds])],
  };
}

export interface WeightPoint {
  date: string; // YYYY-MM-DD
  kg: number;
}

export type TrendResult =
  | { status: "not_enough_data"; deltaKcal: 0; sourceIds: readonly string[]; grade: "C" }
  | {
      status: "below_range" | "above_range" | "on_track";
      deltaKcal: number;
      kgPerWeek: number;
      pctPerWeek: number;
      sourceIds: readonly string[];
      grade: "C";
      label: string;
    };

/**
 * 14-day linear-fit weight trend vs the goal's weekly band. Below the band: eat more; above: eat less.
 * App rule, coaching convention (grade C).
 */
export function adjustFromTrend(
  weights: WeightPoint[],
  now: Date,
  nutrition: NutritionSettings,
): TrendResult {
  const base = { sourceIds: nutrition.sourceIds, grade: "C" as const };
  const band = pctBand(nutrition);
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
    pctPerWeek < band.min
      ? (["below_range", TREND_ADJUST_KCAL] as const)
      : pctPerWeek > band.max
        ? (["above_range", -TREND_ADJUST_KCAL] as const)
        : (["on_track", 0] as const);
  return {
    status,
    deltaKcal,
    kgPerWeek: +kgPerWeek.toFixed(3),
    pctPerWeek: +pctPerWeek.toFixed(3),
    label: `Coaching convention (grade C): adjust ${TREND_ADJUST_KCAL} kcal from the 2-week trend toward ${band.min} to ${band.max} %/week`,
    ...base,
  };
}
