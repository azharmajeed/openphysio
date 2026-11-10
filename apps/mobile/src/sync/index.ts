import * as SecureStore from "expo-secure-store";
import { useEffect } from "react";
import { AppState } from "react-native";
import { db } from "../db";
import { runSync, syncIfDue, type SyncConfig } from "./engine";

export { lastResult, type SyncResult } from "./engine";

/** SecureStore keys for the server connection; the only place they are named. */
export const SERVER_KEYS = { url: "serverUrl", token: "serverToken" } as const;

/** Server URL + token from Settings; undefined until both are set. */
export async function loadConfig(): Promise<SyncConfig | undefined> {
  const url = (await SecureStore.getItemAsync(SERVER_KEYS.url))?.trim();
  const token = (await SecureStore.getItemAsync(SERVER_KEYS.token))?.trim();
  return url && token ? { url, token } : undefined;
}

// One sync at a time: a foreground trigger during "Sync now" joins it.
let inflight: Promise<unknown> | undefined;
function once<T>(fn: () => Promise<T>): Promise<T> {
  const p = (inflight ??= fn().finally(() => (inflight = undefined)));
  return p as Promise<T>;
}

/** Settings "Sync now": ignores the throttle. */
export async function syncNow() {
  const cfg = await loadConfig();
  return cfg ? once(() => runSync(db, cfg)) : undefined;
}

/** Syncs on mount and each time the app returns to the foreground (throttled). */
export function useSyncOnForeground(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const go = () => void loadConfig().then((cfg) => once(() => syncIfDue(db, cfg)));
    go();
    const sub = AppState.addEventListener("change", (s) => s === "active" && go());
    return () => sub.remove();
  }, [enabled]);
}
