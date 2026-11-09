import { expect, test } from "vitest";
import { emptyForm, equipmentOptions, formToRows, goalOptions, sportOptions } from "./intake.ts";

test("options derive from the catalogue", () => {
  expect(goalOptions.length).toBeGreaterThan(0);
  expect(equipmentOptions.map((o) => o.id)).toContain("bodyweight");
  expect(sportOptions.length).toBeGreaterThan(0);
});

test("formToRows builds synced rows with defaults", () => {
  const f = {
    ...emptyForm(),
    name: " A ",
    weightKg: "80,5",
    poolDays: [3, 1],
    injuries: [
      { bodyArea: "knee" as const, side: "left" as const, description: "x", avoidAreas: [], status: "active" as const, startedOn: "" },
      { id: "keep", bodyArea: "hip" as const, side: null, description: "", avoidAreas: ["hip" as const], status: "resolved" as const, startedOn: "2026-01-01" },
    ],
  };
  const r = formToRows(f, 1000);
  expect(r.profileRow).toMatchObject({ id: "me", name: "A", updatedAt: 1000, poolDays: [1, 3], birthYear: null });
  expect(r.weight).toMatchObject({ kg: 80.5, updatedAt: 1000 });
  expect(r.injuries[0].avoidAreas).toEqual(["knee"]);
  expect(r.injuries[0].id).toBeTruthy();
  expect(r.injuries[1].id).toBe("keep");
  expect(formToRows(emptyForm()).weight).toBeNull();
});
