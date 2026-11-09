import { getTableColumns, gt, inArray, sql } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import * as s from "../db/schema.ts";

// Works on phone (expo-sqlite, async) and server (better-sqlite3, sync): every query is awaited.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = BaseSQLiteDatabase<any, any>;
type Row = Record<string, unknown>;

/** Rows by table name. sync_state is local-only and deliberately absent. */
export type Changes = Record<string, Row[]>;

/** Client cursor: push = max local updatedAt already sent, pull = server receipt seq already seen. */
export type SyncCursor = { push: number; pull: number };

export const syncedTables = {
  profile: s.profile,
  injury: s.injury,
  weight_entry: s.weightEntry,
  planned_session: s.plannedSession,
  workout: s.workout,
  set_log: s.setLog,
  pain_entry: s.painEntry,
  run_point: s.runPoint,
  health_daily: s.healthDaily,
  health_hr_sample: s.healthHrSample,
  scan_import: s.scanImport,
  coach_note: s.coachNote,
} satisfies Record<string, SQLiteTable>;

type Synced = (typeof syncedTables)[keyof typeof syncedTables];
const entries = Object.entries(syncedTables) as [string, Synced][];
const CHUNK = 200;

/** All rows (tombstones included) with updatedAt > since. */
export async function collectChanges(db: Db, since: number): Promise<Changes> {
  const out: Changes = {};
  for (const [name, t] of entries) {
    const rows = (await db.select().from(t).where(gt(t.updatedAt, since))) as Row[];
    if (rows.length) out[name] = rows;
  }
  return out;
}

/** Upsert; an incoming row only wins when its updatedAt is strictly newer (last-write-wins). */
export async function applyChanges(db: Db, changes: Changes): Promise<void> {
  for (const [name, t] of entries) {
    const rows = changes[name] ?? [];
    const set = Object.fromEntries(
      Object.entries(getTableColumns(t)).map(([k, c]) => [k, sql.raw(`excluded."${c.name}"`)]),
    );
    for (let i = 0; i < rows.length; i += CHUNK) {
      await db
        .insert(t)
        .values(rows.slice(i, i + CHUNK) as never)
        .onConflictDoUpdate({ target: t.id, set, setWhere: sql`excluded."updated_at" > ${t.updatedAt}` });
    }
  }
}

/** Current rows for ids, grouped by table. Used by the server pull. */
export async function loadRows(db: Db, ids: Record<string, string[]>): Promise<Changes> {
  const out: Changes = {};
  for (const [name, t] of entries) {
    const all = ids[name] ?? [];
    for (let i = 0; i < all.length; i += CHUNK) {
      const rows = (await db.select().from(t).where(inArray(t.id, all.slice(i, i + CHUNK)))) as Row[];
      if (rows.length) (out[name] ??= []).push(...rows);
    }
  }
  return out;
}


/** Push local changes, then pull remote ones. Returns the new cursor; persist it only on success. */
export async function syncOnce(opts: {
  db: Db;
  baseUrl: string;
  token: string;
  fetch?: typeof fetch;
  cursor?: SyncCursor;
}): Promise<SyncCursor> {
  const { db, baseUrl, token } = opts;
  const f = opts.fetch ?? fetch;
  const cursor = opts.cursor ?? { push: 0, pull: 0 };
  const headers = { Authorization: `Bearer ${token}` };

  const changes = await collectChanges(db, cursor.push);
  let push = cursor.push;
  for (const rows of Object.values(changes)) for (const r of rows) push = Math.max(push, r.updatedAt as number);
  if (Object.keys(changes).length) {
    const res = await f(`${baseUrl}/api/sync/push`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    if (!res.ok) throw new Error(`sync push failed: ${res.status}`);
  }

  const res = await f(`${baseUrl}/api/sync/pull?since=${cursor.pull}`, { headers });
  if (!res.ok) throw new Error(`sync pull failed: ${res.status}`);
  const { changes: remote, cursor: pull } = (await res.json()) as { changes: Changes; cursor: number };
  await applyChanges(db, remote);
  return { push, pull };
}
