import type { BodyArea } from "@openphysio/core";
import data from "./exercises.json" with { type: "json" };

export * from "./evidence/index.ts";
export * from "./goals.ts";

export const name = "@openphysio/catalog";

export const SESSION_TYPES = [
  "warmup",
  "lower_strength",
  "upper_strength",
  "back_core",
  "plyo",
  "mobility",
  "run",
  "swim",
  "conditioning",
] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

/** Per session type data. countsTowardLoad false: sets of these types never count as hard sets in training history. */
export const SESSION_TYPE_META: Record<SessionType, { countsTowardLoad: boolean }> = {
  warmup: { countsTowardLoad: false },
  lower_strength: { countsTowardLoad: true },
  upper_strength: { countsTowardLoad: true },
  back_core: { countsTowardLoad: true },
  plyo: { countsTowardLoad: true },
  mobility: { countsTowardLoad: false },
  run: { countsTowardLoad: true },
  swim: { countsTowardLoad: true },
  conditioning: { countsTowardLoad: true },
};

export type Equipment = "bodyweight" | "band" | "dumbbell" | "gym" | "pool";
export const ROLES = ["easy", "quality", "long", "recovery", "technique", "endurance"] as const;
export type Role = (typeof ROLES)[number];
export type Unit = "reps" | "seconds" | "meters" | "minutes";

export type Exercise = {
  id: string;
  name: string;
  sessionTypes: SessionType[];
  /** Any one of these makes the exercise possible. "bodyweight" is always available. */
  equipment: Equipment[];
  /** Body areas this exercise stresses. */
  loads: BodyArea[];
  /** If the user has an active injury in any of these areas, exclude the exercise. */
  avoidIf: BodyArea[];
  primaryMuscles: string[];
  /** Staging: with no history for a pattern, level n waits until week n. */
  level: 1 | 2 | 3;
  /** Template role for run / swim / conditioning entries. */
  role?: Role;
  /** How hard a template should feel. */
  intensity?: string;
  cues: string[];
  unit: Unit;
  /** Default prescription ranges: sets [min,max], amount [min,max] in `unit`. */
  rx: { sets: [number, number]; amount: [number, number] };
  /** Ground contacts per rep (both feet = 2, single leg = 1), for plyo caps. */
  footContactsPerRep?: number;
  /** Easier variant, used as the pain swap. */
  regressionId?: string;
  progressionId?: string;
  demo: { status: "film-it" };
  /** Evidence registry id (docs/research/sources.md) where the entry makes a health claim. */
  sourceId?: string;
};

export const exercises = data as Exercise[];

const byId = new Map(exercises.map((e) => [e.id, e]));
export const getExercise = (id: string) => byId.get(id);
export const bySessionType = (t: SessionType) =>
  exercises.filter((e) => e.sessionTypes.includes(t));

/** Exercise lookup for core's buildHistory: muscles, and whether any of its session types counts toward load. */
export const historyLookup = (id: string) => {
  const e = byId.get(id);
  return e && { primaryMuscles: e.primaryMuscles, countsTowardLoad: e.sessionTypes.some((t) => SESSION_TYPE_META[t].countsTowardLoad) };
};
