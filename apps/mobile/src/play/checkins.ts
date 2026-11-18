import { weekStart } from "@openphysio/core";

/** Adds a check-in date (YYYY-MM-DD) unless that week already has one. Sorted, deduped. */
export function addCheckIn(list: readonly string[], date: string, weekStartsOn: number): string[] {
  const wk = weekStart(date, weekStartsOn);
  return list.some((d) => weekStart(d, weekStartsOn) === wk) ? [...list] : [...list, date].sort();
}
