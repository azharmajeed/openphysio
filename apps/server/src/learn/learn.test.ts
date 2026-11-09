import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { expect, test, vi } from "vitest";
import { parseFeed } from "./feed.ts";
import { learnRoutes } from "./index.ts";

const entry = (id: string, title: string, published: string) => `
 <entry>
  <id>yt:video:${id}</id>
  <yt:videoId>${id}</yt:videoId>
  <title>${title}</title>
  <author><name>Demo &amp; Co</name></author>
  <published>${published}</published>
  <media:group><media:thumbnail url="https://i1.ytimg.com/vi/${id}/hqdefault.jpg" width="480" height="360"/></media:group>
 </entry>`;
const feed = (...entries: string[]) => `<feed><title>Demo</title>${entries.join("")}</feed>`;

test("parseFeed reads entries and decodes entities", () => {
  const xml = feed(entry("aaaaaaaaaaa", "Squat &amp; lunge basics", "2026-01-02T00:00:00+00:00"));
  expect(parseFeed(xml)).toEqual([
    {
      videoId: "aaaaaaaaaaa",
      title: "Squat & lunge basics",
      published: "2026-01-02T00:00:00+00:00",
      channel: "Demo & Co",
      thumbnailUrl: "https://i1.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg",
      url: "https://www.youtube.com/watch?v=aaaaaaaaaaa",
    },
  ]);
  expect(parseFeed("<feed></feed>")).toEqual([]);
});

const ID = (c: string) => "UC" + c.repeat(22);
const chans = [
  { channelId: ID("a"), name: "A" },
  { channelId: ID("b"), name: "B" },
  { channelId: ID("c"), name: "C" },
];
const xmls: Record<string, string> = {
  [ID("a")]: feed(entry("a1", "Old", "2026-01-01T00:00:00+00:00")),
  [ID("b")]: feed(entry("b1", "New", "2026-03-01T00:00:00+00:00")),
};
const mem = () => drizzle(new Database(":memory:"));
const json = (method: string, body: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
const stub = () =>
  vi.fn(async (url: string | URL | Request) => {
    const xml = xmls[new URL(String(url)).searchParams.get("channel_id")!];
    return xml ? new Response(xml) : new Response("nope", { status: 404 });
  });

test("defaults seed an empty table once; add, duplicate, validation, delete", async () => {
  const db = mem();
  const app = learnRoutes(db, { now: () => 1000 });
  const list = async () => (await app.request("/channels")).json();
  const seeded = await list();
  expect(seeded.length).toBeGreaterThan(0);
  expect(seeded[0]).toMatchObject({
    channelId: expect.stringMatching(/^UC/),
    name: expect.any(String),
  });

  expect((await app.request("/channels", json("POST", chans[0]))).status).toBe(201);
  expect((await app.request("/channels", json("POST", chans[0]))).status).toBe(409);
  expect((await app.request("/channels", json("POST", { channelId: "x", name: "n" }))).status).toBe(
    400,
  );
  expect(
    (await app.request("/channels", json("POST", { channelId: ID("z"), name: " " }))).status,
  ).toBe(400);
  expect(await list()).toHaveLength(seeded.length + 1);

  // a second app on the same db does not re-seed
  expect(await (await learnRoutes(db).request("/channels")).json()).toHaveLength(seeded.length + 1);

  expect((await app.request(`/channels/${ID("a")}`, { method: "DELETE" })).status).toBe(204);
  expect((await app.request(`/channels/${ID("a")}`, { method: "DELETE" })).status).toBe(404);
  expect(await list()).toHaveLength(seeded.length);
});

test("feed reads followed channels, merges newest first, reports failures, caches 1h", async () => {
  const fetchFn = stub();
  let t = 0;
  const db = mem();
  const app = learnRoutes(db, { fetchFn: fetchFn as unknown as typeof fetch, now: () => t });
  for (const c of await (await app.request("/channels")).json())
    await app.request(`/channels/${c.channelId}`, { method: "DELETE" });
  for (const c of chans) await app.request("/channels", json("POST", c));

  const body = await (await app.request("/feed")).json();
  expect(body.items.map((i: { videoId: string }) => i.videoId)).toEqual(["b1", "a1"]);
  expect(body.errors).toEqual([{ channel: "C", error: "HTTP 404" }]);
  expect(fetchFn).toHaveBeenCalledTimes(3);

  await app.request("/feed");
  expect(fetchFn).toHaveBeenCalledTimes(4); // only the failed channel is retried

  t = 61 * 60 * 1000;
  await app.request("/feed");
  expect(fetchFn).toHaveBeenCalledTimes(7);
});
