import type { BodyArea, Injury } from "../types/index.ts";

export const INJURY_FILTER_SOURCE_IDS = ["src-ioc-load-2016"] as const;

type InjuryLike = Pick<Injury, "status" | "avoidAreas"> & { deletedAt?: number | null };

export interface Excluded<T> {
  exercise: T;
  /** Areas that matched: exercise.avoidIf ∩ avoidAreas of active/recovering injuries. */
  areas: BodyArea[];
  reason: string;
}

/** Drop exercises whose avoidIf hits an active or recovering injury's avoidAreas. Resolved and deleted injuries are ignored. */
export function filterForInjuries<T extends { id: string; avoidIf: readonly BodyArea[] }>(
  exercises: readonly T[],
  injuries: readonly InjuryLike[],
): { allowed: T[]; excluded: Excluded<T>[] } {
  const blocked = new Set<BodyArea>();
  for (const i of injuries) {
    if (i.status !== "resolved" && i.deletedAt == null) i.avoidAreas.forEach((a) => blocked.add(a));
  }
  const allowed: T[] = [];
  const excluded: Excluded<T>[] = [];
  for (const exercise of exercises) {
    const areas = exercise.avoidIf.filter((a) => blocked.has(a));
    if (areas.length === 0) allowed.push(exercise);
    else excluded.push({ exercise, areas, reason: `avoid if ${areas.join(", ")} injury` });
  }
  return { allowed, excluded };
}
