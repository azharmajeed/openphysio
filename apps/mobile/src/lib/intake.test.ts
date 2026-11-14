import { expect, test } from "vitest";
import { changeBodyArea, editAvoidAreas, emptyForm, equipmentOptions, formToRows, goalOptions, newInjury, sportOptions, validate, type InjuryForm } from "./intake.ts";

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

const inj = (o: Partial<InjuryForm> = {}): InjuryForm => ({
  bodyArea: null,
  side: null,
  description: "",
  avoidAreas: [],
  status: "active",
  startedOn: "",
  ...o,
});

test("new injury starts with no body area and no avoid areas", () => {
  expect(newInjury().bodyArea).toBeNull();
  expect(newInjury().avoidAreas).toEqual([]);
});

test("avoid areas follow the body area until the user edits them", () => {
  let i = changeBodyArea(inj(), "knee");
  expect(i.avoidAreas).toEqual(["knee"]);
  i = changeBodyArea(i, "ankle");
  expect(i.bodyArea).toBe("ankle");
  expect(i.avoidAreas).toEqual(["ankle"]);
  i = editAvoidAreas(i, ["ankle", "hip"]);
  i = changeBodyArea(i, "knee");
  expect(i.avoidAreas).toEqual(["ankle", "hip"]);
});

test("a saved injury's avoid areas are not rewritten by a body area edit once edited", () => {
  const i = changeBodyArea(inj({ bodyArea: "knee", avoidAreas: ["knee", "hip"] }), "ankle");
  expect(i.avoidAreas).toEqual(["knee", "hip"]);
});

test("validate blocks an injury without a body area", () => {
  const f = { ...emptyForm(), name: "A", injuries: [inj()] };
  expect(validate(f)).toMatch(/body area/i);
  expect(validate({ ...f, injuries: [inj({ bodyArea: "knee" })] })).toBeNull();
});
