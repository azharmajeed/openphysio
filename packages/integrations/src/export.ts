import type { RunPoint, Workout } from "@openphysio/core";

type Pt = Pick<RunPoint, "t" | "lat" | "lon" | "alt" | "hr">;

const CREATOR = "OpenPhysio";
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const iso = (ms: number) => new Date(ms).toISOString();
const sorted = (pts: Pt[]) => [...pts].sort((a, b) => a.t - b.t);

function haversineM(a: Pt, b: Pt): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(b.lat - a.lat) / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

export function toGpx(workout: Workout, points: Pt[]): string {
  const pts = sorted(points);
  const trkpts = pts.map((p) => {
    const ele = p.alt == null ? "" : `<ele>${p.alt}</ele>`;
    const hr =
      p.hr == null
        ? ""
        : `<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${p.hr}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>`;
    return `<trkpt lat="${p.lat}" lon="${p.lon}">${ele}<time>${iso(p.t)}</time>${hr}</trkpt>`;
  });
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<gpx version="1.1" creator="${CREATOR}" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">`,
    `<metadata><name>${esc(CREATOR)}</name><time>${iso(workout.startedAt)}</time></metadata>`,
    `<trk><name>${esc(workout.type)}</name><type>running</type><trkseg>`,
    ...trkpts,
    `</trkseg></trk>`,
    `</gpx>`,
    ``,
  ].join("\n");
}

export function toTcx(workout: Workout, points: Pt[]): string {
  const pts = sorted(points);
  let dist = 0;
  const trackpoints = pts.map((p, i) => {
    if (i > 0) dist += haversineM(pts[i - 1]!, p);
    return [
      `<Trackpoint><Time>${iso(p.t)}</Time>`,
      `<Position><LatitudeDegrees>${p.lat}</LatitudeDegrees><LongitudeDegrees>${p.lon}</LongitudeDegrees></Position>`,
      p.alt == null ? "" : `<AltitudeMeters>${p.alt}</AltitudeMeters>`,
      `<DistanceMeters>${dist}</DistanceMeters>`,
      p.hr == null ? "" : `<HeartRateBpm><Value>${p.hr}</Value></HeartRateBpm>`,
      `</Trackpoint>`,
    ].join("");
  });
  const totalDist = workout.distanceM ?? dist;
  const seconds =
    workout.durationS ??
    (workout.endedAt != null ? (workout.endedAt - workout.startedAt) / 1000 : 0);
  const sport = workout.type === "run" ? "Running" : "Other";
  const start = iso(workout.startedAt);
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">`,
    `<Activities><Activity Sport="${sport}"><Id>${start}</Id>`,
    `<Lap StartTime="${start}"><TotalTimeSeconds>${seconds}</TotalTimeSeconds><DistanceMeters>${totalDist}</DistanceMeters><Calories>0</Calories><Intensity>Active</Intensity><TriggerMethod>Manual</TriggerMethod>`,
    ...(trackpoints.length ? [`<Track>`, ...trackpoints, `</Track>`] : []),
    `</Lap>`,
    `<Creator xsi:type="Device_t" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><Name>${esc(CREATOR)}</Name><UnitId>0</UnitId><ProductID>0</ProductID></Creator>`,
    `</Activity></Activities>`,
    `</TrainingCenterDatabase>`,
    ``,
  ].join("\n");
}
