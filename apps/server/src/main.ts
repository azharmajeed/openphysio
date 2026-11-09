import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { openDb } from "./db.ts";

const cfg = loadConfig();
openDb(cfg.dataDir);
serve({ fetch: createApp(cfg.token).fetch, port: cfg.port, hostname: "0.0.0.0" }, (i) =>
  console.log(`openphysio server listening on :${i.port}`),
);
