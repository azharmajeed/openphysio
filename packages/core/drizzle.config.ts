import { defineConfig } from "drizzle-kit";

// driver "expo" emits drizzle/migrations.js (phone, bundled) next to the .sql files and meta/_journal.json (server).
export default defineConfig({
  dialect: "sqlite",
  driver: "expo",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
