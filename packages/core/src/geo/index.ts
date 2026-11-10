/** One saved GPS point (run_point): t in ms. */
export interface GeoPoint {
  t: number;
  lat: number;
  lon: number;
}

/**
 * Tuning defaults for GPS jitter and pace. Not health rules: adjust after real runs.
 * - maxAccuracyM: fixes reported less accurate than this are dropped before saving.
 * - minMoveM: movement smaller than this from the last counted point is jitter (standing still drifts a few metres).
 * - maxSpeedMS: faster than this between counted points is a GPS jump, not running.
 * - maxGapS: a longer gap between saved points is a pause (or lost signal): no time or distance is counted across it.
 * - paceWindowS: moving seconds the "current pace" looks back over.
 * - splitM: split length.
 */
export const GEO = {
  maxAccuracyM: 25,
  minMoveM: 4,
  maxSpeedMS: 12,
  maxGapS: 30,
  paceWindowS: 20,
  splitM: 1000,
} as const;
export type GeoConfig = { -readonly [K in keyof typeof GEO]: number };

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineM(
  a: Pick<GeoPoint, "lat" | "lon">,
  b: Pick<GeoPoint, "lat" | "lon">,
): number {
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Whether a fix is good enough to save. */
export const acceptFix = (accuracyM: number | null | undefined, cfg: GeoConfig = GEO): boolean =>
  accuracyM != null && accuracyM <= cfg.maxAccuracyM;

export interface Split {
  index: number;
  distanceM: number;
  durationS: number;
  paceSPerKm: number;
}
export interface TrackStats {
  distanceM: number;
  /** Seconds between saved points, pauses excluded. */
  movingS: number;
  avgPaceSPerKm: number | null;
  currentPaceSPerKm: number | null;
  /** Full splits, plus the last partial one when there is any distance left. */
  splits: Split[];
}

const pace = (distM: number, s: number) => (distM > 0 ? (s / distM) * 1000 : null);

/** Distance, moving time, paces and splits from saved points, with jitter and pauses removed (see GEO). */
export function trackStats(points: GeoPoint[], cfg: GeoConfig = GEO): TrackStats {
  // Cumulative (distance, moving time) at each saved point.
  const cum: { d: number; s: number }[] = [];
  let d = 0;
  let s = 0;
  let anchor: GeoPoint | undefined;
  let prev: GeoPoint | undefined;
  for (const p of points) {
    if (prev && p.t - prev.t <= cfg.maxGapS * 1000) {
      s += (p.t - prev.t) / 1000;
      const dist = anchor ? haversineM(anchor, p) : 0;
      const speed = anchor ? dist / Math.max((p.t - anchor.t) / 1000, 1e-3) : 0;
      if (anchor && dist >= cfg.minMoveM && speed <= cfg.maxSpeedMS) {
        d += dist;
        anchor = p;
      }
    } else anchor = p;
    prev = p;
    cum.push({ d, s });
  }

  const splits: Split[] = [];
  let from = { d: 0, s: 0 };
  let next = cfg.splitM;
  for (let i = 1; i < cum.length; i++) {
    const a = cum[i - 1]!;
    const b = cum[i]!;
    while (b.d >= next && b.d > a.d) {
      const at = { d: next, s: a.s + ((b.s - a.s) * (next - a.d)) / (b.d - a.d) };
      splits.push({
        index: splits.length + 1,
        distanceM: at.d - from.d,
        durationS: at.s - from.s,
        paceSPerKm: pace(at.d - from.d, at.s - from.s)!,
      });
      from = at;
      next += cfg.splitM;
    }
  }
  const end = cum.at(-1) ?? { d: 0, s: 0 };
  if (end.d - from.d > 0)
    splits.push({
      index: splits.length + 1,
      distanceM: end.d - from.d,
      durationS: end.s - from.s,
      paceSPerKm: pace(end.d - from.d, end.s - from.s)!,
    });

  const win = cum.find((c) => c.s >= end.s - cfg.paceWindowS) ?? { d: 0, s: 0 };
  return {
    distanceM: d,
    movingS: s,
    avgPaceSPerKm: pace(d, s),
    currentPaceSPerKm: pace(end.d - win.d, end.s - win.s),
    splits,
  };
}

/** Points scaled into a w x h box (padding pad), aspect kept, north up, as "x,y x,y ..." for an SVG polyline. No map tiles. */
export function projectRoute(
  points: Pick<GeoPoint, "lat" | "lon">[],
  w: number,
  h: number,
  pad = 8,
): string {
  if (!points.length) return "";
  const lat0 = points.reduce((n, p) => n + p.lat, 0) / points.length;
  const kx = Math.cos(rad(lat0));
  const xs = points.map((p) => p.lon * kx);
  const ys = points.map((p) => -p.lat);
  const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
  const [sx, sy] = [Math.max(...xs) - x0, Math.max(...ys) - y0];
  const scale = Math.min(w - 2 * pad, h - 2 * pad) / Math.max(sx, sy, 1e-9);
  // Centre the shorter side.
  const ox = pad + (w - 2 * pad - sx * scale) / 2;
  const oy = pad + (h - 2 * pad - sy * scale) / 2;
  return points
    .map(
      (_, i) =>
        `${(ox + (xs[i]! - x0) * scale).toFixed(1)},${(oy + (ys[i]! - y0) * scale).toFixed(1)}`,
    )
    .join(" ");
}
