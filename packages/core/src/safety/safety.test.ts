import { describe, expect, test } from "vitest";
import type { BodyArea, InjuryStatus, PainKind } from "../types/index.ts";
import { filterForInjuries } from "./injury-filter.ts";
import { SPIKE_WINDOW_MS, spikeGuard } from "./spike-guard.ts";
import { painAdvice } from "./pain-monitor.ts";

const ex = (id: string, avoidIf: BodyArea[]) => ({ id, avoidIf });
const inj = (status: InjuryStatus, avoidAreas: BodyArea[], deletedAt: number | null = null) => ({
  status,
  avoidAreas,
  deletedAt,
});

describe("filterForInjuries", () => {
  const list = [ex("jump", ["knee", "ankle"]), ex("row", []), ex("hinge", ["lower_back"])];
  test("no injuries keeps all", () => {
    expect(filterForInjuries(list, []).allowed).toHaveLength(3);
  });
  test("active injury excludes with reason and areas", () => {
    const r = filterForInjuries(list, [inj("active", ["knee"])]);
    expect(r.allowed.map((e) => e.id)).toEqual(["row", "hinge"]);
    expect(r.excluded[0]).toMatchObject({ areas: ["knee"], reason: "avoid if knee injury" });
  });
  test("recovering injury excludes", () => {
    expect(filterForInjuries(list, [inj("recovering", ["lower_back"])]).excluded.map((x) => x.exercise.id)).toEqual(["hinge"]);
  });
  test("resolved and deleted injuries ignored", () => {
    expect(filterForInjuries(list, [inj("resolved", ["knee"]), inj("active", ["knee"], 1)]).excluded).toEqual([]);
  });
  test("multiple injuries union, matched areas listed", () => {
    const r = filterForInjuries(list, [inj("active", ["knee"]), inj("active", ["ankle"])]);
    expect(r.excluded[0]?.areas).toEqual(["knee", "ankle"]);
  });
});

describe("spikeGuard", () => {
  const now = 100 * 86_400_000;
  const base = { metric: "run_distance_m" as const, now, starter: 2000 };
  const h = (value: number, ageMs = 0) => [{ at: now - ageMs, value }];

  test("exactly 10% over is allowed", () => {
    const r = spikeGuard({ ...base, planned: 11000, history: h(10000) });
    expect(r).toMatchObject({ value: 11000, capped: false });
  });
  test("just over 10% is capped", () => {
    const r = spikeGuard({ ...base, planned: 11001, history: h(10000) });
    expect(r).toMatchObject({ value: 11000, capped: true });
    expect(r.reason).toContain("1.10 x 10000");
  });
  test("uses largest value, not latest", () => {
    const history = [...h(10000, 5 * 86_400_000), ...h(4000, 1)];
    expect(spikeGuard({ ...base, planned: 20000, history }).value).toBeCloseTo(11000);
  });
  test("30-day window edges: exactly 30d included, older excluded", () => {
    expect(spikeGuard({ ...base, planned: 99999, history: h(10000, SPIKE_WINDOW_MS) }).value).toBeCloseTo(11000);
    const r = spikeGuard({ ...base, planned: 99999, history: h(10000, SPIKE_WINDOW_MS + 1) });
    expect(r.value).toBe(2000);
    expect(r.reason).toContain("starter");
  });
  test("no history uses starter; under starter is untouched", () => {
    expect(spikeGuard({ ...base, planned: 5000, history: [] })).toMatchObject({ value: 2000, capped: true });
    expect(spikeGuard({ ...base, planned: 1500, history: [] })).toMatchObject({ value: 1500, capped: false });
  });
  test("zero-only history treated as none", () => {
    expect(spikeGuard({ ...base, planned: 5000, history: h(0) }).value).toBe(2000);
  });
  test("foot contacts floor to whole numbers", () => {
    const r = spikeGuard({ metric: "foot_contacts", now, starter: 20, planned: 100, history: h(25) });
    expect(r.value).toBe(27); // 27.5 -> 27
  });
  test("hard sets: 1.1 x 30 is exactly 33 despite float error", () => {
    const r = spikeGuard({ metric: "hard_sets", now, starter: 4, planned: 33, history: h(30) });
    expect(r).toMatchObject({ value: 33, capped: false });
  });
  test("cites sources", () => {
    expect(spikeGuard({ ...base, planned: 1, history: [] }).sourceIds).toContain("src-frandsen-2025-bjsm");
  });
});

describe("painAdvice", () => {
  test.each([
    [{ score: 5, kind: "ache" }, "continue"],
    [{ score: 0, kind: "ache", settledNextMorning: true }, "continue"],
    [{ score: 5, kind: "ache", settledNextMorning: undefined }, "continue"],
    [{ score: 6, kind: "ache" }, "easier_variant"],
    [{ score: 3, kind: "ache", worsening: true }, "easier_variant"],
    [{ score: 3, kind: "ache", settledNextMorning: false }, "easier_variant"],
    [{ score: 1, kind: "sharp" }, "stop_see_physio"],
    [{ score: 1, kind: "swelling" }, "stop_see_physio"],
    [{ score: 1, kind: "giving_way" }, "stop_see_physio"],
    [{ score: 9, kind: "sharp", worsening: true }, "stop_see_physio"],
  ] as [{ score: number; kind: PainKind; settledNextMorning?: boolean; worsening?: boolean }, string][])(
    "%j -> %s",
    (input, out) => expect(painAdvice(input)).toBe(out),
  );
});
