export const BODY_AREAS = [
  "neck",
  "shoulder",
  "elbow",
  "wrist",
  "upper_back",
  "lower_back",
  "hip",
  "knee",
  "ankle",
  "foot",
  "achilles",
  "hamstring",
  "calf",
  "groin",
] as const;
export type BodyArea = (typeof BODY_AREAS)[number];

export const SIDES = ["left", "right", "both"] as const;
export type Side = (typeof SIDES)[number];

export const SEXES = ["male", "female", "other"] as const;
export type Sex = (typeof SEXES)[number];

export const UNITS = ["metric", "imperial"] as const;
export type Units = (typeof UNITS)[number];

export const INJURY_STATUSES = ["active", "recovering", "resolved"] as const;
export type InjuryStatus = (typeof INJURY_STATUSES)[number];

export const INJURY_SOURCES = ["manual", "scan"] as const;
export type InjurySource = (typeof INJURY_SOURCES)[number];

export const WORKOUT_TYPES = ["gym", "home", "run", "swim", "mobility", "plyo"] as const;
export type WorkoutType = (typeof WORKOUT_TYPES)[number];

export const WORKOUT_SOURCES = ["manual", "gps", "band", "scan"] as const;
export type WorkoutSource = (typeof WORKOUT_SOURCES)[number];

export const PLANNED_SESSION_STATUSES = ["planned", "done", "skipped"] as const;
export type PlannedSessionStatus = (typeof PLANNED_SESSION_STATUSES)[number];

export const PAIN_KINDS = ["ache", "sharp", "swelling", "giving_way"] as const;
export type PainKind = (typeof PAIN_KINDS)[number];

export const SCAN_STATUSES = ["pending", "approved", "rejected"] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];

export const SCAN_KINDS = ["medical", "log"] as const;
export type ScanKind = (typeof SCAN_KINDS)[number];
