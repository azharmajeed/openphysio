import { expect, test } from "vitest";
import { mapHealthConnect, stableId } from "./map.ts";

const rec = {
  steps: [
    { startTime: "2026-11-09T08:00:00Z", endTime: "2026-11-09T09:00:00Z", count: 1200 },
    { startTime: "2026-11-09T10:00:00Z", endTime: "2026-11-09T11:00:00Z", count: 800 },
  ],
  activeCalories: [
    {
      startTime: "2026-11-09T08:00:00Z",
      endTime: "2026-11-09T09:00:00Z",
      energy: { inKilocalories: 90.4 },
    },
  ],
  heartRate: [
    {
      startTime: "2026-11-08T22:00:00Z",
      endTime: "2026-11-09T04:00:00Z",
      samples: [
        { time: "2026-11-08T23:00:00Z", beatsPerMinute: 50 },
        { time: "2026-11-09T01:00:00Z", beatsPerMinute: 54 },
        { time: "2026-11-09T02:00:00Z", beatsPerMinute: 58 },
      ],
    },
    {
      startTime: "2026-11-09T12:00:00Z",
      endTime: "2026-11-09T12:30:00Z",
      samples: [{ time: "2026-11-09T12:10:00Z", beatsPerMinute: 150 }],
    },
  ],
  sleep: [
    {
      startTime: "2026-11-08T22:00:00Z",
      endTime: "2026-11-09T04:00:00Z",
      stages: [
        { startTime: "2026-11-08T22:00:00Z", endTime: "2026-11-09T01:00:00Z", stage: 4 },
        { startTime: "2026-11-09T01:00:00Z", endTime: "2026-11-09T01:30:00Z", stage: 1 },
        { startTime: "2026-11-09T01:30:00Z", endTime: "2026-11-09T04:00:00Z", stage: 5 },
      ],
    },
  ],
  exercise: [
    {
      metadata: { id: "ex1" },
      exerciseType: 56,
      title: "Morning run",
      startTime: "2026-11-09T12:00:00Z",
      endTime: "2026-11-09T12:30:00Z",
    },
    {
      metadata: { id: "ex2" },
      exerciseType: 8,
      startTime: "2026-11-09T13:00:00Z",
      endTime: "2026-11-09T14:00:00Z",
    },
  ],
  distance: [
    {
      startTime: "2026-11-09T12:00:00Z",
      endTime: "2026-11-09T12:30:00Z",
      distance: { inMeters: 5000 },
    },
  ],
};

test("maps daily totals, sleep, workouts and hr samples", () => {
  const out = mapHealthConnect(rec, 1);
  expect(out.daily).toHaveLength(1);
  expect(out.daily[0]).toMatchObject({
    date: "2026-11-09",
    steps: 2000,
    activeKcal: 90,
    sleepMin: 330,
    restingHr: 54,
    source: "band",
  });
  expect(out.hrSamples).toHaveLength(4);
  expect(out.workouts).toHaveLength(1); // cycling is unmapped and skipped
  expect(out.workouts[0]).toMatchObject({
    type: "run",
    durationS: 1800,
    distanceM: 5000,
    avgHr: 150,
    source: "band",
    notes: "Morning run",
  });
});

test("ids are stable across imports, so re-import upserts", () => {
  const a = mapHealthConnect(rec, 1);
  const b = mapHealthConnect(rec, 2);
  expect(b.workouts[0]!.id).toBe(a.workouts[0]!.id);
  expect(b.daily[0]!.id).toBe(a.daily[0]!.id);
  expect(stableId("x")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(stableId("x")).not.toBe(stableId("y"));
});

test("no records gives empty output", () => {
  expect(mapHealthConnect({})).toEqual({ daily: [], hrSamples: [], workouts: [] });
});
