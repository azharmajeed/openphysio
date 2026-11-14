import { BODY_AREAS } from "@openphysio/core";
import { expect, test } from "vitest";
import { SESSION_TYPES, bySessionType, exercises, getExercise } from "./index.ts";

const home = (e: (typeof exercises)[number]) =>
  e.equipment.some((q) => q === "bodyweight" || q === "band" || q === "dumbbell");

test("every session type has 5+ options, at home and in the gym", () => {
  for (const t of SESSION_TYPES) {
    const list = bySessionType(t);
    expect(list.length, t).toBeGreaterThanOrEqual(5);
    // swim and conditioning are pool / gym equipment by nature
    if (t !== "conditioning" && t !== "swim")
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

const LOWER_LIMB = ["hip", "knee", "ankle", "foot", "achilles", "hamstring", "calf", "groin"];
// Impact entries: counted contacts, any plyo or run, and dynamic warm-ups that load the foot.
const impact = (e: (typeof exercises)[number]) =>
  (e.footContactsPerRep ?? 0) > 0 ||
  e.sessionTypes.some((t) => t === "plyo" || t === "run") ||
  (e.sessionTypes.includes("warmup") && !e.sessionTypes.includes("mobility") && e.loads.includes("foot"));

test("impact entries declare loads and avoid every lower-limb area they load", () => {
  for (const e of exercises.filter(impact)) {
    expect(e.loads.length, `${e.id} loads`).toBeGreaterThan(0);
    const missing = e.loads.filter((a) => LOWER_LIMB.includes(a) && !e.avoidIf.includes(a));
    expect(missing, `${e.id} loads but does not avoid`).toEqual([]);
  }
});

test("any exercise that loads the knee under load is flagged for the knee", () => {
  for (const e of exercises.filter((x) => x.sessionTypes.includes("lower_strength") && x.loads.includes("knee") && !x.sessionTypes.includes("mobility")))
    expect(e.avoidIf, e.id).toContain("knee");
});
