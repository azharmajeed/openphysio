// Builds src/exercises.json from free-exercise-db (public domain) + scripts/curated.ts.
// Run: pnpm --filter @openphysio/catalog import:fed (needs network). Commit the output.
import { writeFileSync } from "node:fs";
import { rows } from "./curated.ts";

const FED_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
type Fed = { id: string; name: string; equipment: string | null; primaryMuscles: string[] };

const TYPES: Record<string, string> = {
  w: "warmup",
  l: "lower_strength",
  u: "upper_strength",
  b: "back_core",
  p: "plyo",
  m: "mobility_knee",
  r: "run",
  s: "swim",
};
const MUSCLES: Record<string, string> = {
  quadriceps: "quads",
  abdominals: "abdominals",
  "middle back": "upper_back",
  "lower back": "lower_back",
  traps: "upper_back",
};
const equip = (e: string | null) =>
  e === "bands"
    ? "band"
    : e === "dumbbell" || e === "kettlebells"
      ? "dumbbell gym"
      : e && !["body only", "foam roll", "other"].includes(e)
        ? "gym"
        : "bodyweight";
const range = (s: string) => s.split("-").map(Number).slice(0, 2);
const list = (s: string) => s.split(" ").filter(Boolean);

const fed: Fed[] = await (await fetch(FED_URL)).json();
const byId = new Map(fed.map((f) => [f.id, f]));

const out = rows.map((r) => {
  const f = r.fed ? byId.get(r.fed) : undefined;
  if (r.fed && !f) throw new Error(`free-exercise-db id not found: ${r.fed}`);
  const [s0, s1 = s0] = range(r.sets);
  const [a0, a1 = a0] = range(r.amt);
  return {
    id: r.id,
    name: f?.name ?? r.o.n,
    sessionTypes: [...r.t].map((c) => TYPES[c]),
    equipment: list(r.o.eq ?? equip(f?.equipment ?? null)),
    loads: list(r.loads),
    avoidIf: list(r.avoid),
    primaryMuscles: f ? f.primaryMuscles.map((m) => MUSCLES[m] ?? m) : list(r.o.m ?? ""),
    cues: r.cues.split("|"),
    unit: r.unit,
    rx: { sets: [s0, s1], amount: [a0, a1] },
    ...(r.o.fc ? { footContactsPerRep: r.o.fc } : {}),
    ...(r.o.reg ? { regressionId: r.o.reg } : {}),
    ...(r.o.prog ? { progressionId: r.o.prog } : {}),
    demo: { status: "film-it" },
  };
});
writeFileSync(
  new URL("../src/exercises.json", import.meta.url),
  JSON.stringify(out, null, 2) + "\n",
);
console.log(`wrote ${out.length} exercises`);
