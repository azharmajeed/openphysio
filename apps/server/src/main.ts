import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { openDb } from "./db.ts";

const cfg = loadConfig();
const db = openDb(cfg.dataDir);
serve({ fetch: createApp({ token: cfg.token, db }).fetch, port: cfg.port, hostname: "0.0.0.0" }, (i) =>
  console.log(`openphysio server listening on :${i.port}`),
);
