import { describe, expect, test } from "vitest";
import {
  adjustFromTrend,
  dailyTargets,
  maintenanceKcal,
  proteinTargets,
  DEFAULT_NUTRITION,
  resolveNutrition,
  trainingDayAddOn,
  weeklyWeightTarget,
  type NutritionGoal,
} from "./index.ts";

const now = new Date("2026-11-09T12:00:00Z");
const gainBlock: NutritionGoal = {
  direction: "gain",
  energyPct: { min: 10, max: 20 },
  weightPctPerWeek: { min: 0.25, max: 0.5 },
  proteinGPerKg: { min: 1.4, max: 2.0 },
  sourceIds: ["src-energy-surplus", "src-issn-protein-2017"],
};
const loseBlock: NutritionGoal = {
  direction: "lose",
  energyPct: { min: 10, max: 20 },
  weightPctPerWeek: { min: 0.5, max: 1 },
  sourceIds: ["src-test-deficit"],
};
const gain = resolveNutrition([{ id: "g", nutrition: gainBlock }], ["g"]);
const lose = resolveNutrition([{ id: "l", nutrition: loseBlock }], ["l"]);
const maintain = DEFAULT_NUTRITION;
const base = {
  weightKg: 70,
  heightCm: 175,
  birthYear: 1996,
  sex: "male" as const,
  sessionsPerWeek: 4,
};

describe("maintenanceKcal", () => {
  test("male Mifflin-St Jeor x activity", () => {
    // 700 + 1093.75 - 150 + 5 = 1648.75; x1.55
    const r = maintenanceKcal(base, now);
    expect(r.kcal).toBe(2556);
    expect(r.sourceIds).toEqual(["src-mifflin-1990"]);
  });
  test("female constant", () => {
    expect(maintenanceKcal({ ...base, sex: "female" }, now).kcal).toBe(Math.round(1482.75 * 1.55));
  });
  test("other averages the constants and is flagged", () => {
    const r = maintenanceKcal({ ...base, sex: "other" }, now);
    expect(r.kcal).toBe(Math.round(1565.75 * 1.55));
    expect(r.sexOtherAveraged).toBe(true);
  });
  test("activity bands", () => {
    const k = (s: number) => maintenanceKcal({ ...base, sessionsPerWeek: s }, now).kcal;
    expect(k(0)).toBeLessThan(k(2));
    expect(k(2)).toBeLessThan(k(4));
    expect(k(4)).toBeLessThan(k(6));
  });
});

describe("trainingDayAddOn", () => {
  test("band kcal or zero", () => {
    expect(trainingDayAddOn(320.4).kcal).toBe(320);
    expect(trainingDayAddOn().kcal).toBe(0);
    expect(trainingDayAddOn(-5).kcal).toBe(0);
  });
});

describe("resolveNutrition", () => {
  const goals = [{ id: "a", nutrition: gainBlock }, { id: "b", nutrition: loseBlock }, { id: "c" }];
  test("no goal with a block: maintain, protein 1.4-2.0", () => {
    expect(resolveNutrition(goals, ["c"])).toEqual(DEFAULT_NUTRITION);
    expect(resolveNutrition(goals, [])).toEqual(DEFAULT_NUTRITION);
    expect(DEFAULT_NUTRITION).toMatchObject({
      direction: "maintain",
      proteinGPerKg: { min: 1.4, max: 2.0 },
    });
  });
  test("single block is used; missing fields fall back to defaults", () => {
    expect(resolveNutrition(goals, ["a", "c"]).direction).toBe("gain");
    expect(resolveNutrition(goals, ["b"]).proteinGPerKg).toEqual({ min: 1.4, max: 2.0 });
  });
  test("conflicting directions cancel to maintain", () => {
    const r = resolveNutrition(goals, ["a", "b"]);
    expect(r).toMatchObject({ direction: "maintain", energyPct: { min: 0, max: 0 } });
  });
});

describe("proteinTargets", () => {
  test("1.4-2.0 g/kg and 0.25 g/kg per meal", () => {
    const r = proteinTargets(70, gain);
    expect(r.proteinG).toEqual({ min: 98, max: 140 });
    expect(r.perMealG).toBe(18);
    expect(r.sourceIds).toEqual(["src-energy-surplus", "src-issn-protein-2017"]);
  });
});

describe("weeklyWeightTarget", () => {
  test("gain: low end default", () => {
    expect(weeklyWeightTarget(80, gain).kgPerWeek).toBe(0.2);
    expect(weeklyWeightTarget(80, gain, "high").kgPerWeek).toBe(0.4);
  });
  test("lose is negative, maintain is zero", () => {
    expect(weeklyWeightTarget(80, lose).kgPerWeek).toBe(-0.4);
    expect(weeklyWeightTarget(80, maintain).kgPerWeek).toBe(0);
  });
});

describe("dailyTargets", () => {
  test("maintain: no surplus or deficit", () => {
    const r = dailyTargets({ ...base, nutrition: maintain }, now);
    expect(r.kcal).toBe(2556);
    expect(r.sourceIds).toEqual(["src-mifflin-1990", "src-issn-protein-2017"]);
  });
  test("lose: 10% deficit", () => {
    expect(dailyTargets({ ...base, nutrition: lose }, now).kcal).toBe(2556 - 256);
  });
  test("no band: gain keeps maintenance x activity factor + 10% (+ trend delta), all sources", () => {
    expect(dailyTargets({ ...base, nutrition: gain }, now).kcal).toBe(2556 + 256);
    const r = dailyTargets({ ...base, nutrition: gain, trendDeltaKcal: 150 }, now);
    expect(r.kcal).toBe(2556 + 256 + 150);
    expect(r.sourceIds).toEqual([
      "src-mifflin-1990",
      "src-energy-surplus",
      "src-issn-protein-2017",
    ]);
    expect(r.proteinG.max).toBe(140);
  });
  test("band kcal replaces the activity factor, so training is not counted twice", () => {
    // sedentary 1648.75 x 1.2 = 1979; +10% = 198; + band 300
    const r = dailyTargets({ ...base, nutrition: gain, bandActiveKcal: 300 }, now);
    expect(r.kcal).toBe(1979 + 198 + 300);
    expect(r.maintenanceKcal).toBe(1979);
  });
});

describe("adjustFromTrend", () => {
  // daily points 2026-10-27..2026-11-09 at a given kg/week slope
  const series = (kgPerWeek: number, days = 14) =>
    Array.from({ length: days }, (_, i) => ({
      date: new Date(Date.UTC(2026, 9, 27 + i)).toISOString().slice(0, 10),
      kg: 70 + (kgPerWeek / 7) * i,
    }));
  const adj = (kg: number) => adjustFromTrend(series(kg), now, gain);
  test("below range -> +150, labelled grade C with its numbers", () => {
    const r = adj(0.05);
    expect(r).toMatchObject({ status: "below_range", deltaKcal: 150, grade: "C" });
    expect("label" in r && r.label).toMatch(/grade C.*150 kcal.*0.25 to 0.5/);
  });
  test("above range -> -150", () => {
    expect(adj(0.6)).toMatchObject({ status: "above_range", deltaKcal: -150 });
  });
  test("lose: losing too slowly -> -150, too fast -> +150, in band holds", () => {
    const l = (kg: number) => adjustFromTrend(series(kg), now, lose);
    expect(l(-0.1).deltaKcal).toBe(-150);
    expect(l(-0.9).deltaKcal).toBe(150);
    expect(l(-0.5)).toMatchObject({ status: "on_track", deltaKcal: 0 });
  });
  test("maintain: drift either way is corrected, small wobble holds", () => {
    const m = (kg: number) => adjustFromTrend(series(kg), now, maintain).deltaKcal;
    expect(m(0.4)).toBe(-150);
    expect(m(-0.4)).toBe(150);
    expect(m(0.1)).toBe(0);
  });
  test("within range -> hold", () => {
    expect(adj(0.25)).toMatchObject({ status: "on_track", deltaKcal: 0 });
  });
  test("losing weight on a gain goal is below range", () => {
    expect(adj(-0.3).deltaKcal).toBe(150);
  });
  test("fewer than 4 entries", () => {
    const s = series(0.3);
    expect(adjustFromTrend([s[0], s[6], s[13]], now, gain).status).toBe("not_enough_data");
  });
  test("span under 10 days", () => {
    expect(adjustFromTrend(series(0.3).slice(5), now, gain).status).toBe("not_enough_data");
  });
  test("exactly 4 entries spanning 10 days is enough", () => {
    const s = series(0.3);
    expect(adjustFromTrend([s[3], s[6], s[9], s[13]], now, gain).status).not.toBe(
      "not_enough_data",
    );
  });
  test("entries older than 14 days or in the future are ignored", () => {
    const outliers = [
      { date: "2026-09-01", kg: 60 },
      { date: "2026-12-01", kg: 90 },
    ];
    expect(adjustFromTrend([...outliers, ...series(0.25)], now, gain).status).toBe("on_track");
  });
  test("unsorted input and empty", () => {
    expect(adjustFromTrend(series(0.25).reverse(), now, gain).status).toBe("on_track");
    expect(adjustFromTrend([], now, gain).status).toBe("not_enough_data");
  });
});
