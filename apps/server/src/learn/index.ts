import { Hono } from "hono";
import { channels as defaultChannels } from "./channels.ts";
import { parseFeed, type LearnItem } from "./feed.ts";

const TTL = 60 * 60 * 1000;

export function learnRoutes({
  channels = defaultChannels,
  fetchFn = fetch,
  now = Date.now,
}: {
  channels?: readonly { name: string; id: string }[];
  fetchFn?: typeof fetch;
  now?: () => number;
} = {}) {
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
  r.get("/feed", async (c) => {
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
