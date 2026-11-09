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

const chans = [
  { name: "A", id: "UCa" },
  { name: "B", id: "UCb" },
  { name: "C", id: "UCc" },
];
const xmls: Record<string, string> = {
  UCa: feed(entry("a1", "Old", "2026-01-01T00:00:00+00:00")),
  UCb: feed(entry("b1", "New", "2026-03-01T00:00:00+00:00")),
};
const stub = () =>
  vi.fn(async (url: string | URL | Request) => {
    const xml = xmls[new URL(String(url)).searchParams.get("channel_id")!];
    return xml ? new Response(xml) : new Response("nope", { status: 404 });
  });

test("feed merges newest first, reports failed channels, caches 1h", async () => {
  const fetchFn = stub();
  let t = 0;
  const app = learnRoutes({
    channels: chans,
    fetchFn: fetchFn as unknown as typeof fetch,
    now: () => t,
  });

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
