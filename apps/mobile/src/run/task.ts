import * as TaskManager from "expo-task-manager";
import type { LocationObject } from "expo-location";
import { activeRun, savePoints } from "./rundb";

export const RUN_TASK = "openphysio-run";

// Must be imported by the root layout so the task exists when Android wakes the app.
TaskManager.defineTask<{ locations: LocationObject[] }>(RUN_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const w = await activeRun();
  if (w) await savePoints(w.id, data.locations);
});
