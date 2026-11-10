export type ExportFormat = "gpx" | "tcx";

export const MIME: Record<ExportFormat, string> = {
  gpx: "application/gpx+xml",
  tcx: "application/vnd.garmin.tcx+xml",
};

/** Formats offered per workout type: GPX needs a route, so swims get TCX only. */
export const formatsFor = (type: string): ExportFormat[] => (type === "swim" ? ["tcx"] : ["gpx", "tcx"]);

/** "2026-11-10_0715_run.gpx" from the local start time, so files sort by date and never clash. */
export function exportFilename(type: string, startedAt: number, format: ExportFormat): string {
  const d = new Date(startedAt);
  const p = (n: number) => String(n).padStart(2, "0");
  const day = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return `${day}_${p(d.getHours())}${p(d.getMinutes())}_${type.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.${format}`;
}
