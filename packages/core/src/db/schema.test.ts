import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { getTableName, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { migrate } from "drizzle-orm/sqlite-proxy/migrator";
import { expect, test } from "vitest";
import * as s from "./schema.ts";
import { newRow } from "./row.ts";

// node:sqlite behind drizzle's sqlite-proxy: no native build, same SQL as expo-sqlite.
const sqlite = new DatabaseSync(":memory:");
const db = drizzle(
  async (sql, params, method) => {
    const stmt = sqlite.prepare(sql);
    stmt.setReturnArrays(true);
    const rows = (method === "run"
      ? (stmt.run(...params), [])
      : stmt.all(...params)) as unknown as unknown[][];
    return { rows: method === "get" ? (rows[0] ?? []) : rows };
  },
  { schema: s },
);

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

test("migrations apply and every table round-trips a row", async () => {
  await migrate(
    db,
    async (queries) => {
      sqlite.exec("BEGIN");
      for (const q of queries) sqlite.exec(q);
      sqlite.exec("COMMIT");
    },
    { migrationsFolder },
  );

  const w = newRow();
  const rows = [
    [s.profile, { ...newRow(), id: "me", name: "Azhar", goals: ["jump"], poolDays: [2, 5] }],
    [s.injury, { ...newRow(), bodyArea: "knee", avoidAreas: ["knee", "achilles"] }],
    [s.weightEntry, { ...newRow(), date: "2026-01-01", kg: 70.5 }],
    [
      s.plannedSession,
      {
        ...newRow(),
        date: "2026-01-02",
        type: "gym",
        title: "Lower",
        items: [{ exerciseId: "x" }],
      },
    ],
    [s.workout, { ...w, type: "run", startedAt: 1, distanceM: 5000 }],
    [
      s.setLog,
      { ...newRow(), workoutId: w.id, exerciseId: "x", setIndex: 0, reps: 5, footContacts: 10 },
    ],
    [s.painEntry, { ...newRow(), bodyArea: "achilles", score: 3, kind: "ache", at: 1 }],
    [s.runPoint, { ...newRow(), workoutId: w.id, t: 0, lat: 1.5, lon: 2.5 }],
    [s.healthDaily, { ...newRow(), date: "2026-01-01", steps: 9000, source: "band" }],
    [s.healthHrSample, { ...newRow(), t: 1, bpm: 60 }],
    [s.scanImport, { ...newRow(), kind: "log", fileRef: "f.jpg", extracted: { a: 1 } }],
    [s.coachNote, { ...newRow(), at: 1, body: "hi" }],
    [s.syncState, { key: "lastPulledAt", value: "0" }],
  ] as const;

  for (const [table, row] of rows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(table as any).values(row as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const got = (await db.select().from(table as any)) as Record<string, unknown>[];
    expect(got, getTableName(table)).toHaveLength(1);
    for (const [k, v] of Object.entries(row)) expect(got[0]?.[k]).toEqual(v);
    console.log(`ok ${getTableName(table)}`);
  }

  const [me] = await db.select().from(s.profile).where(eq(s.profile.id, "me"));
  expect(me?.units).toBe("metric"); // default
});
