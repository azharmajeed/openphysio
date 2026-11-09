import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import * as Crypto from "expo-crypto";

// Hermes has no crypto.randomUUID; core's newId() needs it.
const g = globalThis as { crypto?: { randomUUID?: () => string } };
g.crypto ??= {};
g.crypto.randomUUID ??= Crypto.randomUUID;

export const db = drizzle(openDatabaseSync("openphysio.db"));
