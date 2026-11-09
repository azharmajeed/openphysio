import { describe, expect, test } from "vitest";
import {
  adjustFromTrend,
  dailyTargets,
  maintenanceKcal,
  proteinTargets,
  trainingDayAddOn,
  weeklyGainTarget,
} from "./index.ts";

const now = new Date("2026-11-09T12:00:00Z");
const base = { weightKg: 70, heightCm: 175, birthYear: 1996, sex: "male" as const, sessionsPerWeek: 4 };

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

describe("proteinTargets", () => {
  test("1.4-2.0 g/kg and 0.25 g/kg per meal", () => {
    const r = proteinTargets(70);
    expect(r.proteinG).toEqual({ min: 98, max: 140 });
    expect(r.perMealG).toBe(18);
    expect(r.sourceIds).toEqual(["src-issn-protein-2017"]);
  });
});

describe("weeklyGainTarget", () => {
  test("low end default", () => {
    const r = weeklyGainTarget(80);
    expect(r.kgPerWeek).toBe(0.2);
    expect(weeklyGainTarget(80, "high").kgPerWeek).toBe(0.4);
    expect(r.sourceIds).toEqual(["src-energy-surplus"]);
  });
});

describe("dailyTargets", () => {
  test("maintenance + 10% (+ add-on on training day, + trend delta), all sources", () => {
    expect(dailyTargets(base, now).kcal).toBe(2556 + 256);
    const train = dailyTargets({ ...base, trainingDay: true, bandActiveKcal: 300, trendDeltaKcal: 150 }, now);
    expect(train.kcal).toBe(2556 + 256 + 300 + 150);
    expect(train.sourceIds).toEqual(["src-mifflin-1990", "src-issn-protein-2017", "src-energy-surplus"]);
    expect(train.proteinG.max).toBe(140);
  });
  test("band kcal ignored on rest day", () => {
    expect(dailyTargets({ ...base, bandActiveKcal: 300 }, now).kcal).toBe(2812);
  });
});

describe("adjustFromTrend", () => {
  // daily points 2026-10-27..2026-11-09 at a given kg/week slope
  const series = (kgPerWeek: number, days = 14) =>
    Array.from({ length: days }, (_, i) => ({
      date: new Date(Date.UTC(2026, 9, 27 + i)).toISOString().slice(0, 10),
      kg: 70 + (kgPerWeek / 7) * i,
    }));
  test("too slow -> +150, labelled grade C", () => {
    const r = adjustFromTrend(series(0.05), now);
    expect(r).toMatchObject({ status: "too_slow", deltaKcal: 150, grade: "C", sourceIds: ["src-energy-surplus"] });
    expect("label" in r && r.label).toMatch(/grade C/);
  });
  test("too fast -> -150", () => {
    expect(adjustFromTrend(series(0.6), now)).toMatchObject({ status: "too_fast", deltaKcal: -150 });
  });
  test("within range -> hold", () => {
    expect(adjustFromTrend(series(0.25), now)).toMatchObject({ status: "on_track", deltaKcal: 0 });
  });
  test("losing weight counts as too slow", () => {
    expect(adjustFromTrend(series(-0.3), now).deltaKcal).toBe(150);
  });
  test("fewer than 4 entries", () => {
    const s = series(0.3);
    expect(adjustFromTrend([s[0], s[6], s[13]], now).status).toBe("not_enough_data");
  });
  test("span under 10 days", () => {
    expect(adjustFromTrend(series(0.3).slice(5), now).status).toBe("not_enough_data");
  });
  test("exactly 4 entries spanning 10 days is enough", () => {
    const s = series(0.3);
    expect(adjustFromTrend([s[3], s[6], s[9], s[13]], now).status).not.toBe("not_enough_data");
  });
  test("entries older than 14 days or in the future are ignored", () => {
    const outliers = [
      { date: "2026-09-01", kg: 60 },
      { date: "2026-12-01", kg: 90 },
    ];
    expect(adjustFromTrend([...outliers, ...series(0.25)], now).status).toBe("on_track");
  });
  test("unsorted input and empty", () => {
    expect(adjustFromTrend(series(0.25).reverse(), now).status).toBe("on_track");
    expect(adjustFromTrend([], now).status).toBe("not_enough_data");
  });
});
