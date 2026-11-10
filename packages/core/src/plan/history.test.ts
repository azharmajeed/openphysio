import { exercises, historyLookup } from "@openphysio/catalog";
import { expect, test } from "vitest";
import { buildHistory } from "./history.ts";

const lookup = (id: string) => ({ quad: { primaryMuscles: ["quads"], countsTowardLoad: true }, warm: { primaryMuscles: ["glutes"], countsTowardLoad: false } })[id as "quad" | "warm"];

test("history: runs, plyo contacts, hard sets (rpe >= 7 or none; non-load exercises excluded)", () => {
  const w = [
    { id: "a", type: "run", startedAt: 1, distanceM: 5000 },
    { id: "b", type: "gym", startedAt: 2, distanceM: null },
  ];
  const s = [
    { workoutId: "b", exerciseId: "quad", rpe: 8, footContacts: 20 },
    { workoutId: "b", exerciseId: "quad", rpe: null, footContacts: 20 },
    { workoutId: "b", exerciseId: "quad", rpe: 6, footContacts: null },
    { workoutId: "b", exerciseId: "warm", rpe: null, footContacts: null },
  ];
  const h = buildHistory(w, s, lookup);
  expect(h.runs).toEqual([{ at: 1, distanceM: 5000 }]);
  expect(h.plyoContacts).toEqual([{ at: 2, contacts: 40 }]);
  expect(h.hardSetsByMuscle).toEqual({ quads: [{ at: 2, sets: 2 }] });
});

test("catalogue lookup: warm-up/mobility-only exercises do not count, others do", () => {
  const light = exercises.find((e) => e.sessionTypes.every((t) => t === "warmup" || t === "mobility"))!;
  const hard = exercises.find((e) => e.sessionTypes.some((t) => t !== "warmup" && t !== "mobility"))!;
  expect(historyLookup(light.id)!.countsTowardLoad).toBe(false);
  expect(historyLookup(hard.id)!.countsTowardLoad).toBe(true);
  expect(historyLookup("nope")).toBeUndefined();
});

test("phone rows (plain) and server rows (extra columns) give identical history", () => {
  const hard = exercises.find((e) => historyLookup(e.id)!.countsTowardLoad && e.primaryMuscles.length)!;
  const phoneW = [{ id: "w", type: "gym", startedAt: 5, distanceM: null }];
  const phoneS = [{ workoutId: "w", exerciseId: hard.id, rpe: null, footContacts: 4 }];
  const serverW = [{ ...phoneW[0]!, deletedAt: null, updatedAt: 9 }];
  const serverS = [{ ...phoneS[0]!, id: "s1", deletedAt: null }];
  expect(buildHistory(serverW, serverS, historyLookup)).toEqual(buildHistory(phoneW, phoneS, historyLookup));
});
