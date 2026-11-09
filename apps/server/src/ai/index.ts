import { Hono } from "hono";
import { anthropicProvider } from "./anthropic.ts";
import { mockProvider } from "./mock.ts";
import { AiUnavailableError, type AiProvider } from "./types.ts";

export * from "./types.ts";

export function createProvider(cfg: {
  aiProvider: string;
  anthropicApiKey: string;
  aiModel: string;
}): AiProvider {
  if (cfg.aiProvider === "anthropic")
    return anthropicProvider({ apiKey: cfg.anthropicApiKey, model: cfg.aiModel });
  if (cfg.aiProvider === "mock") return mockProvider;
  throw new Error(`unknown AI_PROVIDER "${cfg.aiProvider}" (use mock or anthropic)`);
}

export function aiRoutes(ai: AiProvider) {
  const r = new Hono();
  r.post("/chat", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || !Array.isArray(body.messages) || !body.messages.length) {
      return c.json({ error: "messages[] required" }, 400);
    }
    try {
      return c.json(
        await ai.chat({ system: body.system, messages: body.messages, tools: body.tools }),
      );
    } catch (e) {
      if (e instanceof AiUnavailableError) return c.json({ error: e.message }, 503);
      return c.json({ error: (e as Error).message }, 502);
    }
  });
  return r;
}
