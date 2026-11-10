import { expect, test } from "vitest";
import { calendar, parseQuick, targetDraft, typeColor } from "./plan.ts";
import { exercises } from "@openphysio/catalog";

test("type colour is deterministic per type string", () => {
  expect(typeColor("gym")).toBe(typeColor("gym"));
  expect(typeColor("gym")).toMatch(/^#/);
});

test("calendar cuts first..last date into weeks", () => {
  const weeks = calendar([{ date: "2026-11-09" }, { date: "2026-11-09" }, { date: "2026-11-24" }]);
  expect(weeks.length).toBe(3);
  expect(weeks[0]![0]!.sessions.length).toBe(2);
  expect(weeks[2]![1]!.date).toBe("2026-11-24");
});

test("quick form parsing", () => {
  expect(parseQuick("30", "5,5", "km")).toEqual({ durationS: 1800, distanceM: 5500 });
  expect(parseQuick("20", "", "m")).toEqual({ durationS: 1200, distanceM: null });
  expect(parseQuick("", "1", "km")).toBeNull();
  expect(parseQuick("20", "x", "km")).toBeNull();
});

test("target draft uses the plan amount until a set is logged", () => {
  const e = exercises.find((x) => x.unit === "reps")!;
  const item = { exerciseId: e.id, block: "x", sets: 3, amount: 9, unit: "reps" as const, restSec: 60, notes: "", muscles: [] as string[] };
  expect(targetDraft(e, item).reps).toBe(9);
  expect(targetDraft(e, item, { reps: 7, loadKg: 0, durationS: null, rpe: null }).reps).toBe(7);
});
