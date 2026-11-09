export const SPIKE_GUARD_SOURCE_IDS = ["src-frandsen-2025-bjsm", "src-ioc-load-2016"] as const;

export const SPIKE_FACTOR = 1.1;
export const SPIKE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export type SpikeMetric = "run_distance_m" | "foot_contacts" | "hard_sets";

export interface SpikeGuardInput {
  metric: SpikeMetric;
  planned: number;
  /** Past sessions of this metric (for hard_sets: of one muscle group). `at` in ms. */
  history: readonly { at: number; value: number }[];
  now: number;
  /** Conservative value used when there is no history in the window. */
  starter: number;
}

export interface SpikeGuardResult {
  value: number;
  capped: boolean;
  reason: string;
  sourceIds: typeof SPIKE_GUARD_SOURCE_IDS;
}

/** Cap planned value at 1.10 x the largest value in the last 30 days (window edges inclusive); starter if none. */
export function spikeGuard({ metric, planned, history, now, starter }: SpikeGuardInput): SpikeGuardResult {
  const recent = history.filter((h) => h.at <= now && now - h.at <= SPIKE_WINDOW_MS).map((h) => h.value);
  const max = Math.max(0, ...recent);
  const basis = max > 0 ? `1.10 x ${max} in last 30 days` : "starter value, no history in last 30 days";
  let cap = max > 0 ? max * SPIKE_FACTOR : starter;
  // counts are whole numbers; epsilon guards float error (e.g. 1.1 * 30)
  if (metric !== "run_distance_m") cap = Math.floor(cap + 1e-9);
  const capped = planned > cap;
  return {
    value: capped ? cap : planned,
    capped,
    reason: capped ? `${metric} capped at ${cap} (${basis})` : `${metric} within cap ${cap} (${basis})`,
    sourceIds: SPIKE_GUARD_SOURCE_IDS,
  };
}
