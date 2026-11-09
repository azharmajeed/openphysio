import { serve } from "@hono/node-server";
import { createProvider } from "./ai/index.ts";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { openDb } from "./db.ts";

const cfg = loadConfig();
const db = openDb(cfg.dataDir);
serve(
  {
    fetch: createApp({ token: cfg.token, db, ai: createProvider(cfg) }).fetch,
    port: cfg.port,
    hostname: "0.0.0.0",
  },
  (i) => console.log(`openphysio server listening on :${i.port}`),
);
