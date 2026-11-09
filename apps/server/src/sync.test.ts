import { fileURLToPath } from "node:url";
import { collectChanges, injury, newRow, syncOnce, weightEntry, type SyncCursor } from "@openphysio/core";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { expect, test } from "vitest";
import { createApp } from "./app.ts";

const migrationsFolder = fileURLToPath(new URL("../../../packages/core/drizzle", import.meta.url));
const mem = () => {
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder });
  return db;
};

function setup() {
  const server = mem();
  const app = createApp({ token: "t", db: server });
  const f = ((url: string, init?: RequestInit) => app.request(url, init)) as unknown as typeof fetch;
  const device = () => {
    const db = mem();
    let cursor: SyncCursor | undefined;
    return {
      db,
      sync: async (token = "t") => {
        cursor = await syncOnce({ db, baseUrl: "", token, fetch: f, cursor });
      },
    };
  };
  return { server, device };
}

const weight = (id: string, kg: number, updatedAt: number, deletedAt: number | null = null) => ({
  id,
  date: "2026-01-01",
  kg,
  updatedAt,
  deletedAt,
});
const kgOf = async (db: ReturnType<typeof mem>, id: string) =>
  (await db.select().from(weightEntry).where(eq(weightEntry.id, id)))[0];

test("offline edits on both sides converge and reach a third device", async () => {
  const { device } = setup();
  const a = device();
  const b = device();
  const inj = { ...newRow(100), bodyArea: "knee" as const, description: "x" };
  await a.db.insert(injury).values(inj);
  await a.db.insert(weightEntry).values(weight("w1", 80, 100));
  await b.db.insert(weightEntry).values(weight("w2", 81, 50)); // older than a's cursor
  await a.sync();
  await b.sync();
  await a.sync();
  for (const d of [a, b]) {
    expect((await d.db.select().from(weightEntry)).map((r) => r.id).sort()).toEqual(["w1", "w2"]);
    expect((await d.db.select().from(injury))[0]).toMatchObject({ id: inj.id, bodyArea: "knee" });
  }
});

test("deletes propagate as tombstones", async () => {
  const { device } = setup();
  const a = device();
  const b = device();
  await a.db.insert(weightEntry).values(weight("w", 80, 100));
  await a.sync();
  await b.sync();
  await b.db.update(weightEntry).set({ deletedAt: 200, updatedAt: 200 }).where(eq(weightEntry.id, "w"));
  await b.sync();
  await a.sync();
  expect((await kgOf(a.db, "w"))?.deletedAt).toBe(200);
});

test("same-row conflict resolves to newest updatedAt regardless of sync order", async () => {
  const { device } = setup();
  const a = device();
  const b = device();
  await a.db.insert(weightEntry).values(weight("w", 80, 100));
  await a.sync();
  await b.sync();
  await a.db.update(weightEntry).set({ kg: 70, updatedAt: 300 }).where(eq(weightEntry.id, "w"));
  await b.db.update(weightEntry).set({ kg: 90, updatedAt: 200 }).where(eq(weightEntry.id, "w"));
  await a.sync(); // newer pushed first
  await b.sync(); // older must lose
  await a.sync();
  expect((await kgOf(a.db, "w"))?.kg).toBe(70);
  expect((await kgOf(b.db, "w"))?.kg).toBe(70);
});

test("sync_state is never collected; api needs auth", async () => {
  const { device } = setup();
  const a = device();
  expect(Object.keys(await collectChanges(a.db, 0))).toEqual([]);
  await expect(a.sync("wrong")).rejects.toThrow(/401/);
});
