import { describe, expect, test } from "vitest";
import type { RunPoint, Workout } from "@openphysio/core";
import { toGpx, toTcx } from "./export.ts";

const T0 = Date.UTC(2026, 0, 5, 7, 30, 0);
const workout = {
  id: "w1",
  type: "run",
  startedAt: T0,
  endedAt: T0 + 120_000,
  distanceM: 400,
  durationS: 120,
} as Workout;
const points = [
  { t: T0 + 60_000, lat: 51.001, lon: -0.1, alt: 12.5, hr: 150 },
  { t: T0, lat: 51.0, lon: -0.1, alt: 12, hr: 140 },
  { t: T0 + 120_000, lat: 51.002, lon: -0.1, alt: null, hr: null },
] as RunPoint[];

// tiny stack parser: every open tag closed in order
function wellFormed(xml: string): boolean {
  const stack: string[] = [];
  for (const m of xml.replace(/<\?[\s\S]*?\?>/g, "").matchAll(/<(\/?)([\w:]+)[^>]*?(\/?)>/g)) {
    if (m[3]) continue;
    if (m[1]) {
      if (stack.pop() !== m[2]) return false;
    } else stack.push(m[2]!);
  }
  return stack.length === 0;
}

describe("toGpx", () => {
  const gpx = toGpx(workout, points);
  test("well-formed GPX 1.1 with creator and running type", () => {
    expect(wellFormed(gpx)).toBe(true);
    expect(gpx).toContain('version="1.1" creator="OpenPhysio"');
    expect(gpx).toContain("<type>running</type>");
  });
  test("sorted ISO UTC times, hr extension only where present", () => {
    const times = [...gpx.matchAll(/<trkpt[^>]*>.*?<time>(.*?)<\/time>/g)].map((m) => m[1]);
    expect(times).toEqual([
      "2026-01-05T07:30:00.000Z",
      "2026-01-05T07:31:00.000Z",
      "2026-01-05T07:32:00.000Z",
    ]);
    expect(gpx.match(/<gpxtpx:hr>/g)).toHaveLength(2);
    expect(gpx).toContain("<gpxtpx:hr>140</gpxtpx:hr>");
  });
  test("empty points", () => {
    const e = toGpx(workout, []);
    expect(wellFormed(e)).toBe(true);
    expect(e).not.toContain("<trkpt");
  });
});

describe("toTcx", () => {
  const tcx = toTcx(workout, points);
  test("well-formed, Running, creator, heart rate, distance", () => {
    expect(wellFormed(tcx)).toBe(true);
    expect(tcx).toContain('Sport="Running"');
    expect(tcx).toContain("<Name>OpenPhysio</Name>");
    expect(tcx.match(/<HeartRateBpm><Value>/g)).toHaveLength(2);
    expect(tcx).toContain("<DistanceMeters>400</DistanceMeters>");
    expect(tcx).toContain("<TotalTimeSeconds>120</TotalTimeSeconds>");
    expect(tcx).toContain("<Time>2026-01-05T07:30:00.000Z</Time>");
  });
  test("trackpoint distance is cumulative", () => {
    const d = [...tcx.matchAll(/<Trackpoint>.*?<DistanceMeters>([\d.]+)</g)].map((m) =>
      Number(m[1]),
    );
    expect(d[0]).toBe(0);
    expect(d[1]).toBeGreaterThan(100);
    expect(d[2]).toBeGreaterThan(d[1]!);
  });
  test("GPS-less swim: time and distance only, sport Other", () => {
    const swim = { ...workout, type: "swim", distanceM: 750, durationS: 1800 } as Workout;
    const x = toTcx(swim, []);
    expect(wellFormed(x)).toBe(true);
    expect(x).toContain('Sport="Other"');
    expect(x).toContain("<DistanceMeters>750</DistanceMeters>");
    expect(x).not.toContain("<Track>");
  });
  test("escapes text", () => {
    expect(toGpx({ ...workout, type: "a&b" as never }, [])).toContain("a&amp;b");
  });
});
