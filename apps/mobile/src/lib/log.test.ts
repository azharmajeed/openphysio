import { exercises } from "@openphysio/catalog";
import { expect, test } from "vitest";
import { pickerExercises, REST, restFor } from "./log.ts";

test("rest comes from catalogue data", () => {
  const plyo = exercises.find((e) => e.sessionTypes.includes("plyo"))!;
  expect(restFor(plyo)).toBe(REST.plyoS);
  expect(restFor({ ...plyo, sessionTypes: ["lower_strength"], unit: "seconds" })).toBe(REST.timedS);
  expect(restFor({ ...plyo, sessionTypes: ["lower_strength"], unit: "reps", rx: { sets: [3, 3], amount: [4, 6] } })).toBe(REST.heavyS);
  expect(restFor({ ...plyo, sessionTypes: ["lower_strength"], unit: "reps", rx: { sets: [3, 3], amount: [10, 15] } })).toBe(REST.lightS);
});

test("picker honours injuries, equipment and search", () => {
  const all = pickerExercises("gym", { equipment: ["gym"] }, [], { query: "", sessionType: null });
  const hurt = pickerExercises("gym", { equipment: ["gym"] }, [{ status: "active", avoidAreas: ["knee"] }], { query: "", sessionType: null });
  expect(hurt.length).toBeLessThan(all.length);
  expect(hurt.every((e) => !e.avoidIf.includes("knee"))).toBe(true);
  const home = pickerExercises("home", { equipment: ["gym"] }, [], { query: "", sessionType: null });
  expect(home.every((e) => e.equipment.some((x) => x !== "gym"))).toBe(true);
  expect(pickerExercises("gym", { equipment: ["gym"] }, [], { query: "squat", sessionType: null }).every((e) => /squat/i.test(e.name))).toBe(true);
});
