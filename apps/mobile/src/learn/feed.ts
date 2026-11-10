export type FeedItem = { videoId: string; title: string; published: string; channel: string; thumbnailUrl: string; url: string };
export type Channel = { channelId: string; name: string; addedAt?: string };
export type LearnError = "notConfigured" | "offline" | "badToken" | "other";
export type Cfg = { url: string; token: string };
export type FeedResult = { ok: true; items: FeedItem[]; failed: number } | { ok: false; error: LearnError };

export const ERROR_TEXT: Record<LearnError, string> = {
  notConfigured: "Learn needs your server. Set the server URL and token in Settings.",
  offline: "You are offline or the server cannot be reached.",
  badToken: "The server did not accept your token. Check it in Settings.",
  other: "Something went wrong. Please try again in a moment.",
};

export const CACHE_KEY = "learn.feed";

/** Embed only (never download or re-host); the nocookie domain sets no tracking cookies. */
export const embedUrl = (videoId: string) => `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?playsinline=1&rel=0`;

/** "14 Oct 2026"; the raw string if it is not a date. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function mapError(status: number): LearnError {
  if (status === 0) return "offline";
  if (status === 401) return "badToken";
  return "other";
}

const isItem = (x: unknown): x is FeedItem => {
  const o = x as Record<string, unknown>;
  return !!o && ["videoId", "title", "published", "channel", "thumbnailUrl"].every((k) => typeof o[k] === "string");
};

type Called = { res: Response } | { error: LearnError; status?: number };

async function call(cfg: Cfg | undefined, path: string, init: RequestInit, doFetch: typeof fetch): Promise<Called> {
  if (!cfg) return { error: "notConfigured" };
  try {
    const res = await doFetch(`${cfg.url.replace(/\/+$/, "")}/api/learn/${path}`, {
      ...init,
      headers: { ...(init.body ? { "content-type": "application/json" } : {}), authorization: `Bearer ${cfg.token}` },
    });
    return res.ok ? { res } : { error: mapError(res.status), status: res.status };
  } catch {
    return { error: mapError(0) };
  }
}

export async function fetchFeed(cfg: Cfg | undefined, doFetch: typeof fetch = fetch): Promise<FeedResult> {
  const r = await call(cfg, "feed", {}, doFetch);
  if (!("res" in r)) return { ok: false, error: r.error };
  try {
    const j = (await r.res.json()) as { items?: unknown[]; errors?: unknown[] };
    if (!Array.isArray(j.items)) return { ok: false, error: "other" };
    return { ok: true, items: j.items.filter(isItem), failed: j.errors?.length ?? 0 };
  } catch {
    return { ok: false, error: "other" };
  }
}

type Kv = { getItem(k: string): Promise<string | null>; setItem(k: string, v: string): Promise<unknown> };

export async function saveFeed(kv: Kv, items: FeedItem[]) {
  await kv.setItem(CACHE_KEY, JSON.stringify(items));
}

/** Last saved feed; empty when nothing saved or the saved value is corrupt. */
export async function loadCachedFeed(kv: Kv): Promise<FeedItem[]> {
  try {
    const v: unknown = JSON.parse((await kv.getItem(CACHE_KEY)) ?? "[]");
    return Array.isArray(v) ? v.filter(isItem) : [];
  } catch {
    return [];
  }
}

export async function listChannels(cfg: Cfg | undefined, doFetch: typeof fetch = fetch): Promise<{ channels: Channel[] } | { error: LearnError }> {
  const r = await call(cfg, "channels", {}, doFetch);
  if (!("res" in r)) return { error: r.error };
  try {
    return { channels: (await r.res.json()) as Channel[] };
  } catch {
    return { error: "other" };
  }
}

/** Returns an error message, or undefined on success. */
export async function addChannel(cfg: Cfg | undefined, channelId: string, name: string, doFetch: typeof fetch = fetch) {
  const r = await call(cfg, "channels", { method: "POST", body: JSON.stringify({ channelId: channelId.trim(), name: name.trim() }) }, doFetch);
  if ("res" in r) return undefined;
  if (r.status === 400) return "That channel id or name is not valid. Ids start with UC and are 24 characters.";
  if (r.status === 409) return "You already follow that channel.";
  return ERROR_TEXT[r.error];
}

export async function removeChannel(cfg: Cfg | undefined, channelId: string, doFetch: typeof fetch = fetch) {
  const r = await call(cfg, `channels/${encodeURIComponent(channelId)}`, { method: "DELETE" }, doFetch);
  return "res" in r || r.status === 404 ? undefined : ERROR_TEXT[r.error];
}
