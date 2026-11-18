// Which main (non warm-up) exercises does the plan engine pick most? Guides where cues and faults (K3) go first.
// Run: pnpm --filter @openphysio/knowledge top   (writes data/top-exercises.json)
import { writeFileSync } from "node:fs";
import { exercises, goals } from "@openphysio/catalog";
import { generateBlock, type GenerateBlockInput } from "@openphysio/core";

const base = {
  sports: ["running", "swimming"],
  equipment: ["band", "dumbbell", "gym", "pool"],
  poolDays: [2, 0],
};
const profiles = [
  ...goals.map((g) => ({ ...base, goals: [g.id] })),
  { ...base, goals: goals.map((g) => g.id) },
];
const injuries: GenerateBlockInput["injuries"][] = [
  [],
  [{ status: "active", avoidAreas: ["knee"], deletedAt: null }],
];

const counts = new Map<string, number>();
for (const profile of profiles)
  for (const inj of injuries)
    for (const row of generateBlock({
      profile,
      injuries: inj,
      exercises,
      goals,
      history: { runs: [], plyoContacts: [], hardSetsByMuscle: {} },
      startDate: "2026-11-09",
      seed: 7,
      now: 1,
    }).sessions)
      for (const i of row.items) counts.set(i.exerciseId, (counts.get(i.exerciseId) ?? 0) + 1);

const byId = new Map(exercises.map((e) => [e.id, e]));
const top = [...counts]
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .slice(0, 30)
  .map(([id, planned]) => ({
    id,
    name: byId.get(id)?.name,
    sessionTypes: byId.get(id)?.sessionTypes,
    planned,
  }));
const json = JSON.stringify(top, null, 2) + "\n";
writeFileSync(new URL("../data/top-exercises.json", import.meta.url), json);
console.log(json);
