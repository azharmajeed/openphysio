import { expect, test } from "vitest";
import { parseSet } from "./parse.ts";

test.each([
  ["8 reps 20 kilos RPE 7", { reps: 8, loadKg: 20, rpe: 7 }],
  ["twelve at fifteen", { reps: 12, loadKg: 15 }],
  ["same again", { same: true }],
  ["ten reps at twenty five kg", { reps: 10, loadKg: 25 }],
  ["two point five kilos for 8 reps", { reps: 8, loadKg: 2.5 }],
  ["135 pounds 5 reps", { reps: 5, loadKg: 61.23 }],
  ["rpe eight, 6 times", { reps: 6, rpe: 8 }],
  ["fifteen reps", { reps: 15 }],
  ["one hundred reps", { reps: 100 }],
  ["hello", {}],
  ["9999 reps 900 kg rpe 15", {}],
])("%s", (text, want) => expect(parseSet(text)).toEqual(want));
