import { exercises, SESSION_TYPES, type Equipment, type Exercise, type SessionType } from "@openphysio/catalog";
import { filterForInjuries, type WorkoutType } from "@openphysio/core";

/** Workout types you log set by set (run and swim record distance and time instead). */
export const LOGGABLE_TYPES = ["gym", "home", "plyo", "mobility"] as const satisfies readonly WorkoutType[];
export type LoggableType = (typeof LOGGABLE_TYPES)[number];

/** Per workout type: which catalogue session types the picker starts on, and equipment left out. */
export const PRESETS: Record<LoggableType, { sessionTypes?: SessionType[]; noEquipment?: Equipment[] }> = {
  gym: {},
  home: { noEquipment: ["gym"] },
  plyo: { sessionTypes: ["plyo"] },
  mobility: { sessionTypes: ["mobility", "warmup"] },
};

/** Session-type filter chips: every catalogue type that has loggable (reps/seconds) exercises. */
export const pickerSessionTypes = SESSION_TYPES.filter((t) =>
  exercises.some((e) => e.sessionTypes.includes(t) && (e.unit === "reps" || e.unit === "seconds")),
);

export const RPE_OPTIONS = [6, 7, 8, 9, 10];
/** Stepper increments and rest rules are data, not per-exercise constants. */
export const STEPS = { reps: 1, loadKg: 2.5, durationS: 5 };
export const REST = { plyoS: 90, timedS: 45, heavyS: 120, lightS: 75, heavyMaxAmount: 8, adjustS: 15 };

/** Default rest from the catalogue entry: plyo, timed holds, low-rep (heavy) work, else moderate. */
export function restFor(e: Exercise): number {
  if (e.sessionTypes.includes("plyo")) return REST.plyoS;
  if (e.unit !== "reps") return REST.timedS;
  return e.rx.amount[1] <= REST.heavyMaxAmount ? REST.heavyS : REST.lightS;
}

export function pickerExercises(
  type: LoggableType,
  profile: { equipment: Equipment[] },
  injuries: Parameters<typeof filterForInjuries>[1],
  opts: { query: string; sessionType: SessionType | null },
): Exercise[] {
  const have = new Set<Equipment>(["bodyweight", ...profile.equipment]);
  PRESETS[type].noEquipment?.forEach((x) => have.delete(x));
  const q = opts.query.trim().toLowerCase();
  const pool = exercises.filter(
    (e) =>
      (e.unit === "reps" || e.unit === "seconds") &&
      e.equipment.some((x) => have.has(x)) &&
      (!opts.sessionType || e.sessionTypes.includes(opts.sessionType)) &&
      (!q || e.name.toLowerCase().includes(q)),
  );
  return filterForInjuries(pool, injuries).allowed;
}

export type SetDraft = { reps: number; loadKg: number; durationS: number; rpe: number | null };

export const draftFor = (e: Exercise, last?: { reps: number | null; loadKg: number | null; durationS: number | null; rpe: number | null }): SetDraft => ({
  reps: last?.reps ?? (e.unit === "reps" ? e.rx.amount[0] : 0),
  loadKg: last?.loadKg ?? 0,
  durationS: last?.durationS ?? (e.unit === "reps" ? 0 : e.rx.amount[0]),
  rpe: last?.rpe ?? null,
});

export const fmtSet = (e: Exercise, s: { reps: number | null; loadKg: number | null; durationS: number | null; rpe: number | null }) =>
  `${e.unit === "reps" ? `${s.reps ?? 0} reps` : `${s.durationS ?? 0}s`}${s.loadKg ? ` × ${s.loadKg} kg` : ""}${s.rpe ? ` @${s.rpe}` : ""}`;
