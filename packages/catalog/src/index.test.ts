import { BODY_AREAS } from "@openphysio/core";
import { expect, test } from "vitest";
import { SESSION_TYPES, bySessionType, exercises, getExercise } from "./index.ts";

const home = (e: (typeof exercises)[number]) =>
  e.equipment.some((q) => q === "bodyweight" || q === "band" || q === "dumbbell");

test("every session type has 5+ options, at home and in the gym", () => {
  for (const t of SESSION_TYPES) {
    const list = bySessionType(t);
    expect(list.length, t).toBeGreaterThanOrEqual(5);
    expect(list.filter(home).length, `${t} home`).toBeGreaterThanOrEqual(5);
  }
});

test("ids are unique", () => {
  expect(new Set(exercises.map((e) => e.id)).size).toBe(exercises.length);
});

test("regression and progression ids resolve", () => {
  for (const e of exercises)
    for (const id of [e.regressionId, e.progressionId].filter(Boolean))
      expect(getExercise(id!), `${e.id} -> ${id}`).toBeDefined();
});

test("body areas are valid and cues, avoidIf, plyo contacts are filled", () => {
  const areas = new Set<string>(BODY_AREAS);
  for (const e of exercises) {
    for (const a of [...e.loads, ...e.avoidIf]) expect(areas.has(a), `${e.id} ${a}`).toBe(true);
    expect(e.cues.length, e.id).toBeGreaterThanOrEqual(2);
    expect(e.cues.length, e.id).toBeLessThanOrEqual(4);
    if (e.sessionTypes.includes("plyo")) {
      expect(e.footContactsPerRep, e.id).toBeGreaterThan(0);
      expect(e.avoidIf.length, e.id).toBeGreaterThan(0);
    }
    if (e.sessionTypes.includes("run")) expect(e.avoidIf.length, e.id).toBeGreaterThan(0);
  }
});
