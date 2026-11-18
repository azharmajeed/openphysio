import bodyMap from "../data/body-map-areas.json" with { type: "json" };
import { catalogCtx } from "./publish.ts";
import {
  GRADES,
  PHASES,
  REGIONS,
  REVIEW_STATES,
  ROLES,
  SEVERITIES,
  SOURCE_TYPES,
} from "./types.ts";
import type { KnowledgeData } from "./types.ts";

export const BODY_MAP_SLUGS: readonly string[] = bodyMap.slugs;
const inSet = (set: readonly string[], v: unknown) => set.includes(v as string);

/** All structural problems in a data set, as readable strings. Empty = valid. */
export function validate(d: KnowledgeData, ctx = catalogCtx): string[] {
  const errs: string[] = [];
  const bad = (cond: boolean, msg: string) => cond || errs.push(msg);
  const ids = (name: string, list: { id: string }[]) =>
    bad(new Set(list.map((r) => r.id)).size === list.length, `${name}: duplicate ids`);

  ids("sources", d.sources);
  ids("muscles", d.muscles);
  ids("muscleGroups", d.muscleGroups);
  ids("cues", d.cues);
  ids("faults", d.faults);
  ids("claims", d.claims);
  ids("videoSegments", d.videoSegments);
  const pairs = d.exerciseMuscles.map((r) => `${r.exerciseId}/${r.muscleId}`);
  bad(new Set(pairs).size === pairs.length, "exerciseMuscles: duplicate exercise/muscle pair");

  const src = new Set(d.sources.map((r) => r.id));
  const mus = new Set(d.muscles.map((r) => r.id));
  const clm = new Set(d.claims.map((r) => r.id));
  const cues = new Map(d.cues.map((r) => [r.id, r]));
  const subject = (s: string) => mus.has(s) || ctx.exerciseIds.has(s) || ctx.goalIds.has(s);
  const everything = [
    d.sources,
    d.muscles,
    d.muscleGroups,
    d.exerciseMuscles,
    d.cues,
    d.faults,
    d.claims,
    d.videoSegments,
  ].flat();
  for (const r of everything)
    bad(inSet(REVIEW_STATES, r.review?.state), `bad review state: ${JSON.stringify(r)}`);

  for (const s of d.sources) {
    bad(inSet(SOURCE_TYPES, s.type), `${s.id}: bad type`);
    bad(Boolean(s.doi || s.pmid || s.url), `${s.id}: needs a DOI, PMID or URL`);
    bad(Boolean(s.licence), `${s.id}: needs a licence`);
  }
  for (const m of d.muscles) {
    bad(inSet(REGIONS, m.region), `${m.id}: bad region`);
    if (m.bodyMapArea !== undefined)
      bad(BODY_MAP_SLUGS.includes(m.bodyMapArea), `${m.id}: ${m.bodyMapArea} is not a body-map slug`);
    for (const c of m.claims) bad(clm.has(c), `${m.id}: claim ${c} unknown`);
  }
  for (const g of d.muscleGroups) {
    for (const id of g.muscleIds) bad(mus.has(id), `${g.id}: muscle ${id} unknown`);
    for (const a of g.bodyMapAreas)
      bad(BODY_MAP_SLUGS.includes(a), `${g.id}: ${a} is not a body-map slug`);
  }
  for (const r of d.exerciseMuscles) {
    const id = `${r.exerciseId}/${r.muscleId}`;
    bad(ctx.exerciseIds.has(r.exerciseId), `${id}: exercise not in catalogue`);
    bad(mus.has(r.muscleId), `${id}: muscle unknown`);
    bad(inSet(ROLES, r.role), `${id}: bad role`);
    bad(src.has(r.sourceId), `${id}: source ${r.sourceId} unknown`);
  }
  for (const c of d.cues) {
    bad(ctx.exerciseIds.has(c.exerciseId), `${c.id}: exercise not in catalogue`);
    bad(src.has(c.sourceId), `${c.id}: source ${c.sourceId} unknown`);
    bad(inSet(PHASES, c.phase), `${c.id}: bad phase`);
    bad(c.text.trim().split(/\s+/).length <= 12, `${c.id}: cue longer than 12 words`);
  }
  for (const f of d.faults) {
    bad(ctx.exerciseIds.has(f.exerciseId), `${f.id}: exercise not in catalogue`);
    bad(src.has(f.sourceId), `${f.id}: source ${f.sourceId} unknown`);
    bad(inSet(SEVERITIES, f.severity), `${f.id}: bad severity`);
    bad(cues.has(f.cueId), `${f.id}: cue ${f.cueId} unknown`);
    bad(cues.get(f.cueId)?.exerciseId === f.exerciseId, `${f.id}: cue is for another exercise`);
  }
  for (const c of d.claims) {
    bad(src.has(c.sourceId), `${c.id}: source ${c.sourceId} unknown`);
    bad(inSet(GRADES, c.grade), `${c.id}: grade must be A, B or C`);
    for (const s of c.subjects) bad(subject(s), `${c.id}: subject ${s} unknown`);
  }
  for (const v of d.videoSegments) {
    bad(src.has(v.sourceId), `${v.id}: source ${v.sourceId} unknown`);
    bad(v.endSec > v.startSec, `${v.id}: endSec must be after startSec`);
    for (const s of v.subjects) bad(subject(s), `${v.id}: subject ${s} unknown`);
  }
  return errs;
}

/** Reported, not failed (becomes strict later): exercises with no primary muscle, body-map areas with no muscle. */
export function coverage(d: KnowledgeData, ctx = catalogCtx) {
  const primary = new Set(
    d.exerciseMuscles.filter((r) => r.role === "primary").map((r) => r.exerciseId),
  );
  const areas = new Set(d.muscles.map((m) => m.bodyMapArea));
  return {
    exercisesWithoutPrimary: [...ctx.exerciseIds].filter((id) => !primary.has(id)),
    areasWithoutMuscle: BODY_MAP_SLUGS.filter((a) => !areas.has(a)),
  };
}
