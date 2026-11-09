import { applyChanges, loadRows, syncedTables, type Changes } from "@openphysio/core";
import { sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { Hono } from "hono";

// Pull cursor = server receipt seq, not updatedAt: a device that was offline can push rows older
// than another device's cursor, and a seq cursor still delivers them. Server-only table, so no core migration.
// Rows arriving via /push get receipts here; server-written rows (scans) call recordReceipts.
export function ensureReceipts(db: BetterSQLite3Database) {
  db.run(sql`create table if not exists sync_receipt (
    seq integer primary key autoincrement, tbl text not null, row_id text not null)`);
}

/** Make server-written rows reach devices on their next pull. */
export function recordReceipts(db: BetterSQLite3Database, tbl: string, ids: string[]) {
  for (const id of ids) db.run(sql`insert into sync_receipt (tbl, row_id) values (${tbl}, ${id})`);
}

export function syncRoutes(db: BetterSQLite3Database) {
  ensureReceipts(db);
  const app = new Hono();

  app.post("/push", async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body))
      return c.json({ error: "bad body" }, 400);
    const changes: Changes = {};
    for (const [tbl, rows] of Object.entries(body)) {
      const ok =
        tbl in syncedTables &&
        Array.isArray(rows) &&
        rows.every((r) => r && typeof r.id === "string" && Number.isFinite(r.updatedAt));
      if (!ok) return c.json({ error: `bad table ${tbl}` }, 400);
      changes[tbl] = rows;
    }
    await applyChanges(db, changes);
    for (const [tbl, rows] of Object.entries(changes))
      recordReceipts(
        db,
        tbl,
        rows.map((r) => String(r.id)),
      );
    return c.json({ ok: true });
  });

  app.get("/pull", async (c) => {
    const since = Number(c.req.query("since") ?? 0);
    if (!Number.isFinite(since)) return c.json({ error: "bad since" }, 400);
    const recs = db.all<{ tbl: string; row_id: string; seq: number }>(
      sql`select tbl, row_id, max(seq) as seq from sync_receipt where seq > ${since} group by tbl, row_id`,
    );
    const ids: Record<string, string[]> = {};
    let cursor = since;
    for (const r of recs) {
      (ids[r.tbl] ??= []).push(r.row_id);
      cursor = Math.max(cursor, r.seq);
    }
    return c.json({ changes: await loadRows(db, ids), cursor });
  });

  return app;
}
