import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { exercises } from "@openphysio/catalog";
import { injury, setLog, workout } from "@openphysio/core";
import Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { expect, test, vi } from "vitest";
import type { AiProvider } from "../ai/index.ts";
import { createApp } from "../app.ts";

const migrationsFolder = fileURLToPath(
  new URL("../../../../packages/core/drizzle", import.meta.url),
);

function setup(extract: AiProvider["extract"] = async () => ({})) {
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder });
  const dataDir = mkdtempSync(join(tmpdir(), "scans-"));
  const ai: AiProvider = { chat: vi.fn(), extract: vi.fn(extract) };
  const app = createApp({ token: "t", db, ai, dataDir });
  const call = (path: string, init: RequestInit = {}, auth = true) =>
    app.request(`/api/scans${path}`, {
      ...init,
      headers: { ...(auth ? { authorization: "Bearer t" } : {}), ...(init.headers ?? {}) },
    });
  const upload = (kind: string, text: string, type = "image/jpeg", auth = true) => {
    const f = new FormData();
    f.set("file", new File([new Uint8Array([1, 2, 3])], "x", { type }));
    f.set("kind", kind);
    f.set("text", text);
    return call("", { method: "POST", body: f }, auth);
  };
  const decide = (id: string, body: unknown) =>
    call(`/${id}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  return { db, ai, dataDir, upload, call, decide };
}

const TEXT = "Left knee patellar tendinopathy since March 2026, avoid deep squats.";
const medical = {
  injuries: [
    {
      bodyArea: "knee",
      side: "left",
      description: "Patellar tendinopathy",
      startedOn: "2026-03-01",
      avoidAreas: ["knee", "bogus"],
    },
    { bodyArea: "elbow", side: "right", description: "Tennis elbow" },
    { bodyArea: "spleen", description: "not a body area" },
    { bodyArea: "hip", side: "diagonal", description: "bad side" },
  ],
};
const catalogName = exercises[0]!.name;
const log = {
  sessions: [
    {
      date: "2026-04-02",
      type: "gym",
      exercises: [
        {
          name: catalogName.toUpperCase(),
          sets: [
            { reps: 8, loadKg: 20 },
            { reps: 8, loadKg: 22.5 },
          ],
        },
        { name: "Mystery Machine", sets: [{ reps: 10 }] },
      ],
    },
    { date: "2026-04-03", type: "teleport", exercises: [] },
    { date: "not-a-date", type: "run", exercises: [] },
  ],
};

test("unreadable text: pending, no model call, original stored", async () => {
  const s = setup();
  const res = await s.upload("medical", "  too short ");
  expect(res.status).toBe(201);
  const row = await res.json();
  expect(row).toMatchObject({
    status: "pending",
    kind: "medical",
    extracted: { items: [], unreadable: true },
  });
  expect(s.ai.extract).not.toHaveBeenCalled();
  expect(existsSync(join(s.dataDir, "scans", row.fileRef))).toBe(true);
});

test("medical: enum cleaning drops bad items, counts them, passes schema to model", async () => {
  const s = setup(async () => medical);
  const row = await (await s.upload("medical", TEXT)).json();
  expect(row.extracted.dropped).toBe(2);
  expect(row.extracted.items).toHaveLength(2);
  expect(row.extracted.items[0]).toMatchObject({
    bodyArea: "knee",
    side: "left",
    avoidAreas: ["knee"],
    startedOn: "2026-03-01",
  });
  expect(row.extracted.items[0].itemId).toBeTruthy();
  const arg = vi.mocked(s.ai.extract).mock.calls[0]![0];
  expect(arg.input).toBe(TEXT);
  expect(arg.schema.required).toEqual(["injuries"]);
});

test("approve subset writes only approved rows plus receipts; reject-all marks rejected", async () => {
  const s = setup(async () => medical);
  const row = await (await s.upload("medical", TEXT)).json();
  const [a, b] = row.extracted.items.map((i: { itemId: string }) => i.itemId);
  const r1 = await (await s.decide(row.id, { approve: [a], reject: [] })).json();
  expect(r1.status).toBe("pending"); // b undecided
  const inj = await s.db.select().from(injury);
  expect(inj).toHaveLength(1);
  expect(inj[0]).toMatchObject({ bodyArea: "knee", source: "scan" });
  const rec = s.db.all<{ tbl: string; row_id: string }>(sql`select tbl, row_id from sync_receipt`);
  expect(rec).toEqual([{ tbl: "injury", row_id: inj[0]!.id }]);

  const r2 = await (await s.decide(row.id, { approve: [], reject: [b] })).json();
  expect(r2.status).toBe("approved");
  expect(await s.db.select().from(injury)).toHaveLength(1);
  // re-approving a decided item writes nothing
  await s.decide(row.id, { approve: [a], reject: [] });
  expect(await s.db.select().from(injury)).toHaveLength(1);

  const s2 = setup(async () => medical);
  const row2 = await (await s2.upload("medical", TEXT)).json();
  const ids = row2.extracted.items.map((i: { itemId: string }) => i.itemId);
  const r3 = await (await s2.decide(row2.id, { approve: [], reject: ids })).json();
  expect(r3.status).toBe("rejected");
  expect(await s2.db.select().from(injury)).toHaveLength(0);
  expect(s2.db.all(sql`select * from sync_receipt`)).toHaveLength(0);
});

test("log: approved session writes workout + set_log, maps catalogue names, notes unmapped", async () => {
  const s = setup(async () => log);
  const row = await (await s.upload("log", "04/02 squats 8x20 8x22.5, mystery machine 10")).json();
  expect(row.extracted.dropped).toBe(2);
  const id = row.extracted.items[0].itemId;
  await s.decide(row.id, { approve: [id], reject: [] });
  const [w] = await s.db.select().from(workout);
  expect(w).toMatchObject({ type: "gym", source: "scan" });
  expect(w!.notes).toContain("Mystery Machine");
  const sets = await s.db.select().from(setLog);
  expect(sets.map((x) => x.exerciseId).sort()).toEqual(
    [exercises[0]!.id, exercises[0]!.id, "unmapped"].sort(),
  );
  expect(s.db.all(sql`select * from sync_receipt`)).toHaveLength(1 + 3);
});

test("decision validation, list, get, file, 404", async () => {
  const s = setup(async () => medical);
  const row = await (await s.upload("medical", TEXT)).json();
  expect((await s.decide(row.id, { approve: ["nope"], reject: [] })).status).toBe(400);
  const same = row.extracted.items[0].itemId;
  expect((await s.decide(row.id, { approve: [same], reject: [same] })).status).toBe(400);
  expect((await s.call("")).status).toBe(200);
  expect((await (await s.call("")).json())[0].id).toBe(row.id);
  expect((await s.call(`/${row.id}`)).status).toBe(200);
  const f = await s.call(`/${row.id}/file`);
  expect(f.headers.get("content-type")).toBe("image/jpeg");
  expect(new Uint8Array(await f.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  expect((await s.call("/missing")).status).toBe(404);
});

test("auth required on every route", async () => {
  const s = setup();
  expect((await s.upload("medical", TEXT, "image/jpeg", false)).status).toBe(401);
  for (const p of ["", "/x", "/x/file"]) expect((await s.call(p, {}, false)).status).toBe(401);
  expect((await s.call("/x/decision", { method: "POST" }, false)).status).toBe(401);
});

test("bad content type, bad kind, missing file", async () => {
  const s = setup();
  expect((await s.upload("medical", TEXT, "text/html")).status).toBe(415);
  expect((await s.upload("other", TEXT)).status).toBe(400);
  const f = new FormData();
  f.set("kind", "log");
  expect((await s.call("", { method: "POST", body: f })).status).toBe(400);
});

test("provider failure returns 502 and stores nothing", async () => {
  const s = setup(async () => {
    throw new Error("boom");
  });
  expect((await s.upload("log", TEXT)).status).toBe(502);
  expect(await (await s.call("")).json()).toEqual([]);
});
