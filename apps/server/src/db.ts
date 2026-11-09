import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

// Migrations come from @openphysio/core (T02). No-op until that folder exists.
const coreMigrations = fileURLToPath(new URL("../../../packages/core/drizzle", import.meta.url));

export function openDb(dataDir: string, migrationsFolder = coreMigrations) {
  mkdirSync(dataDir, { recursive: true });
  const sqlite = new Database(join(dataDir, "openphysio.sqlite"));
  sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite);
  if (existsSync(join(migrationsFolder, "meta", "_journal.json"))) migrate(db, { migrationsFolder });
  return db;
}
