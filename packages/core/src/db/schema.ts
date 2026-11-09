import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type {
  BodyArea,
  InjurySource,
  InjuryStatus,
  PainKind,
  PlannedSessionStatus,
  ScanKind,
  ScanStatus,
  Sex,
  Side,
  Units,
  WorkoutSource,
  WorkoutType,
} from "../types/enums.ts";

// Plain sqlite-core only: shared by expo-sqlite (phone) and a Node SQLite driver (server).
// Synced rows carry id (uuid text), updatedAt (ms) and deletedAt (ms, null = live).
const synced = {
  id: text("id").primaryKey(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
};

/** Opaque JSON payloads; the shapes are owned by the plan engine / scan lanes. */
export type JsonObject = Record<string, unknown>;

/** Single row, id is always "me". */
export const profile = sqliteTable("profile", {
  ...synced,
  name: text("name").notNull(),
  birthYear: integer("birth_year"),
  sex: text("sex").$type<Sex>(),
  heightCm: real("height_cm"),
  goals: text("goals", { mode: "json" }).$type<string[]>().notNull().default([]),
  equipment: text("equipment", { mode: "json" }).$type<string[]>().notNull().default([]),
  sports: text("sports", { mode: "json" }).$type<string[]>().notNull().default([]),
  poolDays: text("pool_days", { mode: "json" }).$type<number[]>().notNull().default([]),
  units: text("units").$type<Units>().notNull().default("metric"),
});

export const injury = sqliteTable("injury", {
  ...synced,
  bodyArea: text("body_area").$type<BodyArea>().notNull(),
  side: text("side").$type<Side>(),
  description: text("description").notNull().default(""),
  avoidAreas: text("avoid_areas", { mode: "json" }).$type<BodyArea[]>().notNull().default([]),
  status: text("status").$type<InjuryStatus>().notNull().default("active"),
  startedOn: text("started_on"),
  source: text("source").$type<InjurySource>().notNull().default("manual"),
});

export const weightEntry = sqliteTable("weight_entry", {
  ...synced,
  date: text("date").notNull(),
  kg: real("kg").notNull(),
});

export const plannedSession = sqliteTable("planned_session", {
  ...synced,
  date: text("date").notNull(),
  type: text("type").$type<WorkoutType>().notNull(),
  title: text("title").notNull(),
  warmup: text("warmup", { mode: "json" }).$type<JsonObject[]>().notNull().default([]),
  items: text("items", { mode: "json" }).$type<JsonObject[]>().notNull().default([]),
  status: text("status").$type<PlannedSessionStatus>().notNull().default("planned"),
});

export const workout = sqliteTable(
  "workout",
  {
    ...synced,
    type: text("type").$type<WorkoutType>().notNull(),
    startedAt: integer("started_at").notNull(),
    endedAt: integer("ended_at"),
    source: text("source").$type<WorkoutSource>().notNull().default("manual"),
    distanceM: real("distance_m"),
    durationS: integer("duration_s"),
    avgHr: integer("avg_hr"),
    notes: text("notes"),
    plannedSessionId: text("planned_session_id"),
  },
  (t) => [index("workout_started_at_idx").on(t.startedAt)],
);

export const setLog = sqliteTable(
  "set_log",
  {
    ...synced,
    workoutId: text("workout_id").notNull(),
    exerciseId: text("exercise_id").notNull(),
    setIndex: integer("set_index").notNull(),
    reps: integer("reps"),
    loadKg: real("load_kg"),
    rpe: real("rpe"),
    durationS: integer("duration_s"),
    footContacts: integer("foot_contacts"),
  },
  (t) => [index("set_log_workout_idx").on(t.workoutId)],
);

export const painEntry = sqliteTable(
  "pain_entry",
  {
    ...synced,
    workoutId: text("workout_id"),
    exerciseId: text("exercise_id"),
    bodyArea: text("body_area").$type<BodyArea>().notNull(),
    score: integer("score").notNull(), // 0-10
    kind: text("kind").$type<PainKind>().notNull(),
    at: integer("at").notNull(),
  },
  (t) => [index("pain_entry_at_idx").on(t.at)],
);

export const runPoint = sqliteTable(
  "run_point",
  {
    ...synced,
    workoutId: text("workout_id").notNull(),
    t: integer("t").notNull(),
    lat: real("lat").notNull(),
    lon: real("lon").notNull(),
    alt: real("alt"),
    hr: integer("hr"),
  },
  (t) => [index("run_point_workout_idx").on(t.workoutId)],
);

export const healthDaily = sqliteTable("health_daily", {
  ...synced,
  date: text("date").notNull(),
  steps: integer("steps"),
  restingHr: integer("resting_hr"),
  sleepMin: integer("sleep_min"),
  activeKcal: integer("active_kcal"),
  source: text("source").notNull(),
});

export const healthHrSample = sqliteTable(
  "health_hr_sample",
  {
    ...synced,
    t: integer("t").notNull(),
    bpm: integer("bpm").notNull(),
  },
  (t) => [index("health_hr_sample_t_idx").on(t.t)],
);

export const scanImport = sqliteTable("scan_import", {
  ...synced,
  status: text("status").$type<ScanStatus>().notNull().default("pending"),
  kind: text("kind").$type<ScanKind>().notNull(),
  fileRef: text("file_ref").notNull(),
  extracted: text("extracted", { mode: "json" }).$type<JsonObject>(),
});

export const coachNote = sqliteTable("coach_note", {
  ...synced,
  at: integer("at").notNull(),
  body: text("body").notNull(),
});

/** Local-only sync bookkeeping (key/value, e.g. lastPulledAt). Not itself synced. */
export const syncState = sqliteTable("sync_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
