import { describe, expect, it } from "vitest";
import { GEO, acceptFix, haversineM, projectRoute, trackStats, type GeoPoint } from "./index.ts";

const M_PER_DEG = 111_195;
/** Runner heading north at `speed` m/s, one point per second. */
const run = (seconds: number, speed = 3, t0 = 0, lat0 = 51): GeoPoint[] =>
  Array.from({ length: seconds + 1 }, (_, i) => ({
    t: t0 + i * 1000,
    lat: lat0 + (i * speed) / M_PER_DEG,
    lon: 0,
  }));

describe("haversineM", () => {
  it("is 0 for the same point and ~111.2 km per degree of latitude", () => {
    expect(haversineM({ lat: 10, lon: 10 }, { lat: 10, lon: 10 })).toBe(0);
    expect(haversineM({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111_195, -2);
  });
  it("shrinks east-west distance with latitude", () => {
    const eq = haversineM({ lat: 0, lon: 0 }, { lat: 0, lon: 1 });
    expect(haversineM({ lat: 60, lon: 0 }, { lat: 60, lon: 1 })).toBeCloseTo(eq / 2, -2);
  });
});

describe("acceptFix", () => {
  it("drops poor or unknown accuracy", () => {
    expect(acceptFix(GEO.maxAccuracyM)).toBe(true);
    expect(acceptFix(GEO.maxAccuracyM + 1)).toBe(false);
    expect(acceptFix(null)).toBe(false);
  });
});

describe("trackStats", () => {
  it("measures distance, time and pace of a steady run", () => {
    const s = trackStats(run(600, 3)); // 1800 m in 600 s
    expect(s.distanceM).toBeCloseTo(1800, -1);
    expect(s.movingS).toBe(600);
    expect(s.avgPaceSPerKm).toBeCloseTo(333.3, 0);
    expect(s.currentPaceSPerKm).toBeCloseTo(333.3, 0);
  });
  it("ignores standing-still jitter", () => {
    const jitter: GeoPoint[] = Array.from({ length: 60 }, (_, i) => ({
      t: i * 1000,
      lat: 51 + ((i % 2) * 2) / M_PER_DEG,
      lon: 0,
    }));
    const s = trackStats(jitter);
    expect(s.distanceM).toBe(0);
    expect(s.movingS).toBe(59);
    expect(s.avgPaceSPerKm).toBeNull();
  });
  it("ignores a GPS jump", () => {
    const pts = run(30, 3);
    pts[15] = { ...pts[15]!, lat: pts[15]!.lat + 500 / M_PER_DEG };
    expect(trackStats(pts).distanceM).toBeCloseTo(90, -1);
  });
  it("excludes pauses: no time or distance across a long gap", () => {
    const s = trackStats([...run(60, 3), ...run(60, 3, 60_000 + 10 * 60_000, 51.01)]);
    expect(s.movingS).toBe(120);
    expect(s.distanceM).toBeCloseTo(360, -1);
  });
  it("builds km splits with interpolated boundaries and a partial last split", () => {
    const s = trackStats(run(700, 4)); // 2800 m, 250 s/km
    for (const x of s.splits) expect(Math.abs(x.paceSPerKm - 250)).toBeLessThan(3); // counted distance moves in 4 m steps
    expect(s.splits).toHaveLength(3);
    expect(s.splits[0]!.distanceM).toBe(1000);
    expect(s.splits[2]!.distanceM).toBeCloseTo(800, -1);
  });
  it("current pace follows a recent speed change", () => {
    const slow = run(120, 2);
    const fast = run(60, 4, 120_000, 51 + 240 / M_PER_DEG);
    const s = trackStats([...slow, ...fast.slice(1)]);
    expect(s.currentPaceSPerKm).toBeCloseTo(250, -1);
    expect(s.avgPaceSPerKm!).toBeGreaterThan(250);
  });
  it("handles empty and single-point tracks", () => {
    expect(trackStats([]).distanceM).toBe(0);
    expect(trackStats(run(0)).splits).toEqual([]);
  });
});

describe("projectRoute", () => {
  it("fits points in the box, north up", () => {
    const pts = projectRoute(
      [
        { lat: 0, lon: 0 },
        { lat: 1, lon: 0 },
      ],
      100,
      100,
      10,
    ).split(" ");
    expect(pts[0]).toBe("50.0,90.0");
    expect(pts[1]).toBe("50.0,10.0");
  });
  it("is empty without points", () => expect(projectRoute([], 10, 10)).toBe(""));
});
