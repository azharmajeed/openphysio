import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { expect, test } from "vitest";
import { createApp, version } from "./app.ts";
import { loadConfig } from "./config.ts";
import { openDb } from "./db.ts";

const app = createApp({ token: "secret", db: drizzle(new Database(":memory:")) });

test("health is open", async () => {
  const res = await app.request("/health");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, version });
});

test("api rejects missing or wrong token", async () => {
  expect((await app.request("/api/ping")).status).toBe(401);
  const bad = { headers: { Authorization: "Bearer nope" } };
  expect((await app.request("/api/ping", bad)).status).toBe(401);
});

test("api accepts correct token", async () => {
  const res = await app.request("/api/ping", { headers: { Authorization: "Bearer secret" } });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ pong: true });
});

test("config fails fast without token", () => {
  expect(() => loadConfig({})).toThrow(/OPENPHYSIO_TOKEN/);
  expect(loadConfig({ OPENPHYSIO_TOKEN: "t" })).toMatchObject({ port: 8787, aiProvider: "mock" });
});

test("openDb creates the file and skips absent migrations", () => {
  const dir = mkdtempSync(join(tmpdir(), "op-"));
  try {
    const db = openDb(join(dir, "data"), join(dir, "no-such-folder"));
    expect(db.$client.open).toBe(true);
    db.$client.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("knowledge search needs auth and returns cited notes", async () => {
  expect((await app.request("/api/knowledge/search?q=protein")).status).toBe(401);
  const res = await app.request("/api/knowledge/search?q=protein&limit=2", {
    headers: { Authorization: "Bearer secret" },
  });
  const { results } = (await res.json()) as { results: { id: string; sources: unknown[] }[] };
  expect(results[0]!.id).toBe("protein-intake");
  expect(results.length).toBeLessThanOrEqual(2);
  expect(results[0]!.sources.length).toBeGreaterThan(0);
});
