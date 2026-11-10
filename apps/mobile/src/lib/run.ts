/** Seconds as m:ss, or h:mm:ss from one hour. */
export function fmtDur(totalS: number): string {
  const s = Math.max(0, Math.round(totalS));
  const [h, m, sec] = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Pace as m:ss per km; "-:--" when unknown. */
export const fmtPace = (sPerKm: number | null): string =>
  sPerKm == null || !isFinite(sPerKm) ? "-:--" : fmtDur(sPerKm);

/** Swims are shown in metres, everything else in km. */
export const fmtDistance = (type: string, m: number): string =>
  type === "swim" ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;

export const STROKES = ["freestyle", "breaststroke", "backstroke", "butterfly", "mixed"] as const;

/** workout has no stroke column, so the stroke leads the notes: "freestyle · easy lengths". Null when both are empty. */
export const swimNotes = (stroke: string | null, notes: string): string | null =>
  [stroke, notes.trim()].filter(Boolean).join(" · ") || null;
