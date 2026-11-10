import { goals } from "@openphysio/catalog";
import { expect, test } from "vitest";
import { bestPace, metricsFor, weeklyTotals, weightSeries } from "./progress.ts";

test("cards follow the goals' demands", () => {
  expect(metricsFor(goals, ["swim_more"])).toEqual([{ kind: "swim" }]);
  expect(metricsFor(goals, ["run_faster_longer", "jump_higher"]).map((m) => m.kind)).toEqual(["run", "plyo", "strength"]);
  const s = metricsFor(goals, ["stronger_back"])[0]!;
  expect(s.kind === "strength" && s.muscles).toContain("lats");
  expect(metricsFor(goals, [])).toEqual([]);
});

test("weekly totals in rolling windows, oldest first", () => {
  const now = 100 * 86_400_000;
  const d = 86_400_000;
  expect(weeklyTotals([{ at: now - d, value: 5 }, { at: now - 8 * d, value: 3 }, { at: now - 60 * d, value: 9 }], now, 3)).toEqual([0, 3, 5]);
});

test("best pace needs a run of 5 km or more", () => {
  expect(bestPace([{ distanceM: 4000, durationS: 1000 }, { distanceM: 5000, durationS: 1500 }, { distanceM: 10000, durationS: 2800 }])).toBe(280);
  expect(bestPace([{ distanceM: 3000, durationS: 900 }])).toBeNull();
});

test("weight series keeps latest per day inside the window", () => {
  const e = [
    { date: "2026-11-10", kg: 70, updatedAt: 1 },
    { date: "2026-11-10", kg: 71, updatedAt: 2 },
    { date: "2026-10-01", kg: 60, updatedAt: 1 },
  ];
  expect(weightSeries(e, "2026-11-10")).toEqual([{ date: "2026-11-10", kg: 71 }]);
});
