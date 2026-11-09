export type LearnItem = {
  videoId: string;
  title: string;
  published: string;
  channel: string;
  thumbnailUrl: string;
  url: string;
};

const tag = (xml: string, name: string) =>
  new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml)?.[1] ?? "";

const unescapeXml = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");

/** Parse a YouTube channel Atom feed. Entries missing id/title/date are skipped. */
export function parseFeed(xml: string): LearnItem[] {
  const items: LearnItem[] = [];
  for (const [, entry = ""] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const videoId = tag(entry, "yt:videoId");
    const title = unescapeXml(tag(entry, "title"));
    const published = tag(entry, "published");
    if (!videoId || !title || !published) continue;
    items.push({
      videoId,
      title,
      published,
      channel: unescapeXml(tag(/<author>([\s\S]*?)<\/author>/.exec(entry)?.[1] ?? "", "name")),
      thumbnailUrl:
        /<media:thumbnail url="([^"]+)"/.exec(entry)?.[1] ??
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${videoId}`,
    });
  }
  return items;
}
