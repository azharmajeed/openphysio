import { healthDaily, healthHrSample, workout } from "@openphysio/core";
import { localDate, mapHealthConnect, type HcRecords } from "@openphysio/integrations";
import * as SecureStore from "expo-secure-store";
import {
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  readRecords,
  SdkAvailabilityStatus,
} from "react-native-health-connect";
import { db } from "../db";

// One entry per record type we read; permissions are derived from it, so we only ever ask for what we read.
const READS = {
  steps: "Steps",
  heartRate: "HeartRate",
  sleep: "SleepSession",
  exercise: "ExerciseSession",
  distance: "Distance",
  activeCalories: "ActiveCaloriesBurned",
} as const;
export const PERMISSIONS = Object.values(READS).map((recordType) => ({
  accessType: "read" as const,
  recordType,
}));

const LAST_READ = "hcLastRead";
const FIRST_READ_DAYS = 30; // Health Connect only exposes 30 days before the first grant
const CHUNK = 80; // keeps rows * columns under SQLite's bound-variable limit

export type ImportResult =
  | { status: "unavailable" }
  | { status: "no-permission" }
  | { status: "ok"; daily: number; hrSamples: number; workouts: number };

export async function hasPermissions(): Promise<boolean> {
  if ((await getSdkStatus()) !== SdkAvailabilityStatus.SDK_AVAILABLE || !(await initialize()))
    return false;
  const granted = await getGrantedPermissions();
  return PERMISSIONS.every((p) =>
    granted.some(
      (g) => "recordType" in g && g.recordType === p.recordType && g.accessType === "read",
    ),
  );
}

async function readAll(recordType: string, startTime: string, endTime: string) {
  const out: unknown[] = [];
  let pageToken: string | undefined;
  do {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = await readRecords(recordType as never, {
      timeRangeFilter: { operator: "between", startTime, endTime },
      pageToken,
    });
    out.push(...r.records);
    pageToken = r.pageToken || undefined;
  } while (pageToken);
  return out;
}

/** Reads Health Connect since the last import (from the start of that local day, so day totals stay complete) and upserts. */
export async function importBandData(): Promise<ImportResult> {
  if ((await getSdkStatus()) !== SdkAvailabilityStatus.SDK_AVAILABLE)
    return { status: "unavailable" };
  if (!(await hasPermissions())) return { status: "no-permission" };

  const now = Date.now();
  const last =
    Number(await SecureStore.getItemAsync(LAST_READ)) || now - FIRST_READ_DAYS * 86400000;
  const [y, m, d] = localDate(last).split("-").map(Number);
  const startTime = new Date(y!, m! - 1, d!).toISOString();
  const endTime = new Date(now).toISOString();

  const rec: Record<string, unknown[]> = {};
  for (const [key, type] of Object.entries(READS))
    rec[key] = await readAll(type, startTime, endTime);
  const mapped = mapHealthConnect(rec as HcRecords, now);

  await db.transaction(async (tx) => {
    const upsert = async <T extends { id: string }>(
      table: typeof healthDaily | typeof healthHrSample | typeof workout,
      rows: T[],
    ) => {
      for (let i = 0; i < rows.length; i += CHUNK) {
        await tx
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .insert(table as any)
          .values(rows.slice(i, i + CHUNK))
          .onConflictDoNothing();
      }
    };
    // Day totals change as the day goes on, so they are replaced; samples and workouts are immutable by id.
    for (const row of mapped.daily)
      await tx
        .insert(healthDaily)
        .values(row)
        .onConflictDoUpdate({ target: healthDaily.id, set: row });
    await upsert(healthHrSample, mapped.hrSamples);
    await upsert(workout, mapped.workouts);
  });
  await SecureStore.setItemAsync(LAST_READ, String(now));
  return {
    status: "ok",
    daily: mapped.daily.length,
    hrSamples: mapped.hrSamples.length,
    workouts: mapped.workouts.length,
  };
}
