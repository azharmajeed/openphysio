import { expect, test } from "vitest";
import { addChannel, embedUrl, fetchFeed, formatDate, loadCachedFeed, removeChannel, saveFeed, type FeedItem } from "./feed.ts";

const item: FeedItem = { videoId: "abc", title: "T", published: "2026-10-14T18:07:23+00:00", channel: "C", thumbnailUrl: "https://i.ytimg.com/x.jpg", url: "u" };
const cfg = { url: "http://s/", token: "t" };
const reply = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const mem = () => {
  const m = new Map<string, string>();
  return { getItem: async (k: string) => m.get(k) ?? null, setItem: async (k: string, v: string) => void m.set(k, v) };
};

test("embed url is nocookie and escapes the id", () => {
  expect(embedUrl("a b")).toContain("youtube-nocookie.com/embed/a%20b");
});

test("date formatting", () => {
  expect(formatDate(item.published)).toBe("14 Oct 2026");
  expect(formatDate("nope")).toBe("nope");
});

test("cache round trip; corrupt or missing gives empty", async () => {
  const kv = mem();
  expect(await loadCachedFeed(kv)).toEqual([]);
  await saveFeed(kv, [item]);
  expect(await loadCachedFeed(kv)).toEqual([item]);
  await kv.setItem("learn.feed", "{bad");
  expect(await loadCachedFeed(kv)).toEqual([]);
});

test("feed: not configured, offline, bad token, ok drops malformed items", async () => {
  expect(await fetchFeed(undefined)).toEqual({ ok: false, error: "notConfigured" });
  const boom = (async () => {
    throw new Error("x");
  }) as unknown as typeof fetch;
  expect(await fetchFeed(cfg, boom)).toEqual({ ok: false, error: "offline" });
  expect(await fetchFeed(cfg, reply(401, {}))).toEqual({ ok: false, error: "badToken" });
  expect(await fetchFeed(cfg, reply(200, { items: [item, { videoId: 1 }], errors: [{}] }))).toEqual({ ok: true, items: [item], failed: 1 });
});

test("channels: add maps 400/409, remove treats 404 as done", async () => {
  expect(await addChannel(cfg, "UC1", "n", reply(201, {}))).toBeUndefined();
  expect(await addChannel(cfg, "x", "n", reply(400, {}))).toMatch(/not valid/);
  expect(await addChannel(cfg, "UC1", "n", reply(409, {}))).toMatch(/already/);
  expect(await removeChannel(cfg, "UC1", reply(404, {}))).toBeUndefined();
  expect(await removeChannel(undefined, "UC1")).toMatch(/Settings/);
});
