import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { Hono } from "hono";
import { AiUnavailableError, type AiProvider, type Message } from "../ai/index.ts";
import { coachChat } from "./coach.ts";

export function coachRoutes(db: BetterSQLite3Database, ai: AiProvider) {
  const r = new Hono();
  r.post("/chat", async (c) => {
    const body = await c.req.json().catch(() => null);
    const ok =
      Array.isArray(body?.messages) &&
      body.messages.length > 0 &&
      body.messages.every(
        (m: Message) =>
          (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string",
      ) &&
      body.messages.at(-1).role === "user";
    if (!ok) {
      return c.json(
        { error: "messages[] of {role, content: string} ending with a user message required" },
        400,
      );
    }
    try {
      return c.json(await coachChat({ db, ai }, body.messages));
    } catch (e) {
      if (e instanceof AiUnavailableError) return c.json({ error: e.message }, 503);
      return c.json({ error: (e as Error).message }, 502);
    }
  });
  return r;
}
