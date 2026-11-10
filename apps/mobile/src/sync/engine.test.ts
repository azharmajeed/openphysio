import { fileURLToPath } from "node:url";
import { injury, newRow, syncState } from "@openphysio/core";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { expect, test } from "vitest";
import { createApp } from "../../../server/src/app.ts";
import { dueForSync, explain, lastResult, runSync, SYNC_MIN_INTERVAL_MS, syncIfDue } from "./engine.ts";

const migrationsFolder = fileURLToPath(new URL("../../../../packages/core/drizzle", import.meta.url));
const mem = () => {
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder });
  return db;
};

test("throttle: unset or old attempts are due, recent ones are not", () => {
  expect(dueForSync(1000, undefined)).toBe(true);
  expect(dueForSync(1000 + SYNC_MIN_INTERVAL_MS - 1, 1000)).toBe(false);
  expect(dueForSync(1000 + SYNC_MIN_INTERVAL_MS, 1000)).toBe(true);
});

test("errors are explained in plain words", () => {
  expect(explain(new Error("sync push failed: 401"))).toMatch(/token/);
  expect(explain(new Error("sync pull failed: 500"))).toMatch(/500/);
  expect(explain(new TypeError("fetch failed"))).toMatch(/reach/);
});

test("round trip: device -> server -> second device; cursor stored; throttle and not-configured respected", async () => {
  const app = createApp({ token: "t", db: mem() });
  const f = ((url: string, init?: RequestInit) => app.request(url, init)) as unknown as typeof fetch;
  const cfg = { url: "http://x/", token: "t" };
  const a = mem();
  const b = mem();
  await a.insert(injury).values({ ...newRow(100), bodyArea: "knee", description: "x" });

  expect(await runSync(a, cfg, { now: 1, fetch: f })).toMatchObject({ ok: true, sent: 1 });
  expect(await runSync(b, cfg, { now: 1, fetch: f })).toMatchObject({ ok: true, sent: 0, received: 1 });
  expect(await b.select().from(injury)).toHaveLength(1);
  expect(await b.select().from(syncState).where(eq(syncState.key, "syncCursor"))).toHaveLength(1);

  expect(await syncIfDue(b, cfg, 2, { fetch: f })).toBeUndefined();
  expect(await syncIfDue(b, undefined, 1e12)).toBeUndefined();
  expect(await syncIfDue(b, cfg, 1 + SYNC_MIN_INTERVAL_MS, { fetch: f })).toMatchObject({ ok: true });

  const bad = await runSync(a, { ...cfg, token: "nope" }, { now: 5, fetch: f });
  expect(bad).toMatchObject({ ok: false, error: expect.stringMatching(/token/) });
  expect(await lastResult(a)).toEqual(bad);

  const down = (() => Promise.reject(new TypeError("fetch failed"))) as unknown as typeof fetch;
  expect(await runSync(a, cfg, { now: 6, fetch: down })).toMatchObject({ ok: false, error: expect.stringMatching(/reach/) });
});
