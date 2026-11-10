import { syncOnce, syncState, type SyncCursor } from "@openphysio/core";
import { eq } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = BaseSQLiteDatabase<any, any>;

/** Tuning default: how soon after the last attempt a foreground may sync again. */
export const SYNC_MIN_INTERVAL_MS = 5 * 60 * 1000;

export type SyncResult = { at: number; ok: true; sent: number; received: number } | { at: number; ok: false; error: string };
export type SyncConfig = { url: string; token: string };

const CURSOR = "syncCursor";
const LAST = "syncLast";

export const dueForSync = (now: number, lastAt: number | undefined, minMs = SYNC_MIN_INTERVAL_MS) =>
  lastAt === undefined || now - lastAt >= minMs;

/** Plain-words message for a failed sync. */
export function explain(e: unknown): string {
  const status = /: (\d{3})$/.exec(e instanceof Error ? e.message : "")?.[1];
  if (status === "401" || status === "403") return "The server rejected the token. Check it in Settings.";
  if (status) return `The server answered with an error (${status}). Try again later.`;
  return "Can't reach the server. Check the URL and your connection.";
}

const get = async (db: Db, key: string) => (await db.select().from(syncState).where(eq(syncState.key, key)))[0]?.value;
const put = async (db: Db, key: string, value: string) => {
  await db.insert(syncState).values({ key, value }).onConflictDoUpdate({ target: syncState.key, set: { value } });
};

export async function lastResult(db: Db): Promise<SyncResult | undefined> {
  const v = await get(db, LAST);
  return v ? (JSON.parse(v) as SyncResult) : undefined;
}

const countRows = (changes: unknown) => Object.values((changes ?? {}) as Record<string, unknown[]>).reduce((n, r) => n + r.length, 0);

/** One sync attempt. Never throws; the outcome is stored (and returned) for the Settings screen. Cursor only advances on success. */
export async function runSync(
  db: Db,
  cfg: SyncConfig,
  opts: { now?: number; fetch?: typeof fetch } = {},
): Promise<SyncResult> {
  const at = opts.now ?? Date.now();
  const base = opts.fetch ?? fetch;
  let sent = 0;
  let received = 0;
  const f = (async (url: string, init?: RequestInit) => {
    const res = await base(url, init);
    if (init?.method === "POST") sent = countRows(JSON.parse(init.body as string));
    else if (res.ok) received = countRows(((await res.clone().json()) as { changes: unknown }).changes);
    return res;
  }) as typeof fetch;
  let result: SyncResult;
  try {
    const v = await get(db, CURSOR);
    const cursor = await syncOnce({
      db,
      baseUrl: cfg.url.replace(/\/+$/, ""),
      token: cfg.token,
      fetch: f,
      cursor: v ? (JSON.parse(v) as SyncCursor) : undefined,
    });
    await put(db, CURSOR, JSON.stringify(cursor));
    result = { at, ok: true, sent, received };
  } catch (e) {
    result = { at, ok: false, error: explain(e) };
  }
  await put(db, LAST, JSON.stringify(result));
  return result;
}

/** Foreground trigger: skipped when unconfigured or tried within the interval. */
export async function syncIfDue(db: Db, cfg: SyncConfig | undefined, now = Date.now(), opts: { fetch?: typeof fetch } = {}) {
  if (!cfg) return undefined;
  if (!dueForSync(now, (await lastResult(db))?.at)) return undefined;
  return runSync(db, cfg, { now, ...opts });
}
