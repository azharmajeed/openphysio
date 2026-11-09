import { timingSafeEqual, createHash } from "node:crypto";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { Hono } from "hono";
import { aiRoutes, type AiProvider } from "./ai/index.ts";
import { mockProvider } from "./ai/mock.ts";
import { coachRoutes } from "./coach/index.ts";
import { knowledgeRoutes } from "./knowledge/index.ts";
import { syncRoutes } from "./sync.ts";

export const version = "0.0.0";

// Hash both sides so lengths match and timingSafeEqual never throws or leaks length.
const digest = (s: string) => createHash("sha256").update(s).digest();

export function createApp({
  token,
  db,
  ai = mockProvider,
}: {
  token: string;
  db: BetterSQLite3Database;
  ai?: AiProvider;
}) {
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

  app.route("/api/sync", syncRoutes(db));
  app.route("/api/ai", aiRoutes(ai));
  app.route("/api/coach", coachRoutes(db, ai));
  app.route("/api/knowledge", knowledgeRoutes());

  return app;
}
