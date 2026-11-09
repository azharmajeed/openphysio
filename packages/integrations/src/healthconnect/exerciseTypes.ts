import type { WorkoutType } from "@openphysio/core";

/**
 * Health Connect ExerciseType constant -> WorkoutType. Data, not logic: add a row to map another type.
 * Types not listed (e.g. cycling, team sports) are skipped by the mapper: no WorkoutType fits them yet.
 */
export const EXERCISE_TYPE_TO_WORKOUT: Readonly<Record<number, WorkoutType>> = {
  56: "run", // RUNNING
  57: "run", // RUNNING_TREADMILL
  73: "swim", // SWIMMING_OPEN_WATER
  74: "swim", // SWIMMING_POOL
  70: "gym", // STRENGTH_TRAINING
  81: "gym", // WEIGHTLIFTING
  13: "home", // CALISTHENICS
  36: "home", // HIGH_INTENSITY_INTERVAL_TRAINING
  10: "home", // BOOT_CAMP
  83: "mobility", // YOGA
  48: "mobility", // PILATES
  71: "mobility", // STRETCHING
};
