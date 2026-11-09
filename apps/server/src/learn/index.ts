import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { Hono } from "hono";
import { parseFeed, type LearnItem } from "./feed.ts";

const TTL = 60 * 60 * 1000;
const defaultsFile = new URL("../../defaults/channels.json", import.meta.url);
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;

type Channel = { channelId: string; name: string; addedAt: number };

// Server-only table (like sync_receipt), no core migration. Seeded from defaults/channels.json when empty.
export function ensureChannels(db: BetterSQLite3Database, seedFile: URL = defaultsFile) {
  db.run(sql`create table if not exists followed_channel (
    channel_id text primary key, name text not null, added_at integer not null)`);
  const n = db.get<{ n: number }>(sql`select count(*) as n from followed_channel`).n;
  if (n) return;
  const seed = JSON.parse(readFileSync(seedFile, "utf8")) as { id: string; name: string }[];
  const at = Date.now();
  seed.forEach((c, i) =>
    db.run(sql`insert into followed_channel values (${c.id}, ${c.name}, ${at + i})`),
  );
}

export function learnRoutes(
  db: BetterSQLite3Database,
  {
    fetchFn = fetch,
    now = Date.now,
  }: {
    fetchFn?: typeof fetch;
    now?: () => number;
  } = {},
) {
  ensureChannels(db);
  const list = () =>
    db.all<Channel>(
      sql`select channel_id as channelId, name, added_at as addedAt from followed_channel order by added_at, rowid`,
    );
  const cache = new Map<string, { at: number; items: LearnItem[] }>();

  async function load(id: string) {
    const hit = cache.get(id);
    if (hit && now() - hit.at < TTL) return hit.items;
    const res = await fetchFn(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = parseFeed(await res.text());
    cache.set(id, { at: now(), items });
    return items;
  }

  const r = new Hono();
  r.get("/channels", (c) => c.json(list()));
  r.post("/channels", async (c) => {
    const b: unknown = await c.req.json().catch(() => null);
    const { channelId, name } = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
    if (typeof channelId !== "string" || !CHANNEL_ID.test(channelId))
      return c.json({ error: "channelId must look like UC + 22 characters" }, 400);
    if (typeof name !== "string" || !name.trim() || name.length > 100)
      return c.json({ error: "name required (max 100 chars)" }, 400);
    if (list().some((x) => x.channelId === channelId))
      return c.json({ error: "already followed" }, 409);
    const row = { channelId, name: name.trim(), addedAt: now() };
    db.run(
      sql`insert into followed_channel values (${row.channelId}, ${row.name}, ${row.addedAt})`,
    );
    return c.json(row, 201);
  });
  r.delete("/channels/:id", (c) => {
    const id = c.req.param("id");
    const hit = list().some((x) => x.channelId === id);
    if (!hit) return c.json({ error: "not found" }, 404);
    db.run(sql`delete from followed_channel where channel_id = ${id}`);
    cache.delete(id);
    return c.body(null, 204);
  });
  r.get("/feed", async (c) => {
    const channels = list().map((x) => ({ id: x.channelId, name: x.name }));
    const results = await Promise.allSettled(channels.map((ch) => load(ch.id)));
    const items: LearnItem[] = [];
    const errors: { channel: string; error: string }[] = [];
    results.forEach((res, i) => {
      if (res.status === "fulfilled") items.push(...res.value);
      else {
        const e = res.reason as { message?: string } | undefined;
        errors.push({ channel: channels[i]!.name, error: e?.message ?? String(res.reason) });
      }
    });
    items.sort((a, b) => Date.parse(b.published) - Date.parse(a.published));
    return c.json({ items, errors });
  });
  return r;
}
