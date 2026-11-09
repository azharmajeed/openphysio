import type { PainKind } from "../types/index.ts";

// Coaching convention, evidence grade C (not a validated clinical threshold).
export const PAIN_MONITOR_GRADE = "C";
export const PAIN_MONITOR_SOURCE_IDS = ["src-ioc-load-2016"] as const;

export type PainAdvice = "continue" | "easier_variant" | "stop_see_physio";

export const PAIN_CONTINUE_MAX = 5;

export function painAdvice(p: {
  score: number;
  kind: PainKind;
  settledNextMorning?: boolean;
  worsening?: boolean;
}): PainAdvice {
  if (p.kind !== "ache") return "stop_see_physio"; // sharp, swelling, giving way
  if (p.score > PAIN_CONTINUE_MAX || p.worsening || p.settledNextMorning === false) return "easier_variant";
  return "continue";
}
