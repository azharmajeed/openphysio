import { exercises, goals } from "@openphysio/catalog";
import type { KnowledgeData, Review } from "./types.ts";

const SHIPS = new Set<Review["state"]>(["source-checked", "clinician-reviewed"]);

type Ctx = { exerciseIds: ReadonlySet<string>; goalIds: ReadonlySet<string> };
export const catalogCtx: Ctx = {
  exerciseIds: new Set(exercises.map((e) => e.id)),
  goalIds: new Set(goals.map((g) => g.id)),
};

const count = (x: KnowledgeData) => Object.values(x).reduce((a, l) => a + l.length, 0);

/**
 * Only records that are source-checked or clinician-reviewed AND whose references are also published.
 * Greatest fixed point: drop records with an unpublished reference until nothing changes (claims and muscles
 * reference each other, so a single pass would not do). Exercises and goals come from the catalogue.
 */
export function publish(d: KnowledgeData, ctx: Ctx = catalogCtx): KnowledgeData {
  const ok = (r: { review: Review }) => SHIPS.has(r.review.state);
  let cur: KnowledgeData = {
    sources: d.sources.filter(ok),
    muscles: d.muscles.filter(ok),
    muscleGroups: d.muscleGroups.filter(ok),
    exerciseMuscles: d.exerciseMuscles.filter(ok),
    cues: d.cues.filter(ok),
    faults: d.faults.filter(ok),
    claims: d.claims.filter(ok),
    videoSegments: d.videoSegments.filter(ok),
  };
  for (;;) {
    const src = new Set(cur.sources.map((r) => r.id));
    const mus = new Set(cur.muscles.map((r) => r.id));
    const clm = new Set(cur.claims.map((r) => r.id));
    const cue = new Set(cur.cues.map((r) => r.id));
    const ex = ctx.exerciseIds;
    const subject = (s: string) => mus.has(s) || ex.has(s) || ctx.goalIds.has(s);
    const next: KnowledgeData = {
      sources: cur.sources,
      muscles: cur.muscles.filter((m) => m.claims.every((c) => clm.has(c))),
      muscleGroups: cur.muscleGroups.filter((g) => g.muscleIds.every((m) => mus.has(m))),
      exerciseMuscles: cur.exerciseMuscles.filter(
        (r) => ex.has(r.exerciseId) && mus.has(r.muscleId) && src.has(r.sourceId),
      ),
      cues: cur.cues.filter((r) => ex.has(r.exerciseId) && src.has(r.sourceId)),
      faults: cur.faults.filter(
        (r) => ex.has(r.exerciseId) && src.has(r.sourceId) && cue.has(r.cueId),
      ),
      claims: cur.claims.filter((r) => src.has(r.sourceId) && r.subjects.every(subject)),
      videoSegments: cur.videoSegments.filter(
        (r) => src.has(r.sourceId) && r.subjects.every(subject),
      ),
    };
    if (count(next) === count(cur)) return next;
    cur = next;
  }
}
