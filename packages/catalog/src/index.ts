import type { BodyArea } from "@openphysio/core";
import data from "./exercises.json" with { type: "json" };

export const name = "@openphysio/catalog";

export const SESSION_TYPES = [
  "warmup",
  "lower_strength",
  "upper_strength",
  "back_core",
  "plyo",
  "mobility_knee",
  "run",
  "swim",
] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export type Equipment = "bodyweight" | "band" | "dumbbell" | "gym";
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
