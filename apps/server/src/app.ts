import { timingSafeEqual, createHash } from "node:crypto";
import { Hono } from "hono";

export const version = "0.0.0";

// Hash both sides so lengths match and timingSafeEqual never throws or leaks length.
const digest = (s: string) => createHash("sha256").update(s).digest();

export function createApp(token: string) {
  const app = new Hono();
  const expected = digest(token);

  app.get("/health", (c) => c.json({ ok: true, version }));

  app.use("/api/*", async (c, next) => {
    const m = /^Bearer (.+)$/.exec(c.req.header("authorization") ?? "");
    if (!m || !timingSafeEqual(digest(m[1]!), expected)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    await next();
  });

  app.get("/api/ping", (c) => c.json({ pong: true }));

  return app;
}
