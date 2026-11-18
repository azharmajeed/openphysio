// Review tooling (K6a): load the data files from disk and apply a decisions file to them.
// Reads files directly (not data.ts) so tests can point it at a temp copy.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "./validate.ts";
import { REVIEW_STATES } from "./types.ts";
import type { KnowledgeData, Review, ReviewState } from "./types.ts";

export const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "data");

/** data/ folder name -> KnowledgeData key. */
export const KINDS = {
  sources: "sources",
  muscles: "muscles",
  "muscle-groups": "muscleGroups",
  "exercise-muscles": "exerciseMuscles",
  cues: "cues",
  faults: "faults",
  claims: "claims",
  "video-segments": "videoSegments",
} as const satisfies Record<string, keyof KnowledgeData>;

export type Rec = { id?: string; exerciseId?: string; muscleId?: string; review: Review };
export type DataFile = { file: string; kind: keyof KnowledgeData; records: Rec[] };
export type Decision = { file: string; id: string; state: ReviewState; notes?: string };

/** The id a decision uses; exercise-muscle links have none, so exercise/muscle. */
export const recordId = (r: Rec) => r.id ?? `${r.exerciseId}/${r.muscleId}`;

export function loadFiles(dataDir = DATA_DIR): DataFile[] {
  const out: DataFile[] = [];
  for (const [dir, kind] of Object.entries(KINDS)) {
    const d = join(dataDir, dir);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d).filter((n) => n.endsWith(".json")).sort())
      out.push({
        file: `${dir}/${f}`,
        kind,
        records: JSON.parse(readFileSync(join(d, f), "utf8")) as Rec[],
      });
  }
  return out;
}

export function toData(files: DataFile[]): KnowledgeData {
  const d: Record<string, Rec[]> = {};
  for (const k of Object.values(KINDS)) d[k] = [];
  for (const f of files) d[f.kind]!.push(...f.records);
  return d as unknown as KnowledgeData;
}

export type ApplyOptions = { reviewer?: string; clinician?: boolean; today?: string; dataDir?: string };

/**
 * Applies decisions to the data files. All-or-nothing: any refusal means nothing is written.
 * A decision equal to the record's current state and notes is skipped, so re-applying changes nothing.
 * `draft` clears reviewer and date (nobody has reviewed it).
 */
export function applyReview(decisions: Decision[], opts: ApplyOptions = {}) {
  const { reviewer = "Azhar", clinician = false, today = new Date().toISOString().slice(0, 10) } = opts;
  const files = loadFiles(opts.dataDir);
  const refused: string[] = [];
  const changed = new Set<DataFile>();
  let applied = 0;

  for (const dec of decisions) {
    const label = `${dec.file} ${dec.id}`;
    const file = files.find((f) => f.file === dec.file);
    const rec = file?.records.find((r) => recordId(r) === dec.id);
    if (!file || !rec) refused.push(`${label}: unknown ${file ? "id" : "file"}`);
    else if (!REVIEW_STATES.includes(dec.state)) refused.push(`${label}: unknown state ${dec.state}`);
    else if (dec.state === "clinician-reviewed" && !clinician)
      refused.push(`${label}: clinician-reviewed needs --clinician`);
    else {
      const notes = dec.notes === undefined ? rec.review.notes : dec.notes.trim() || undefined;
      if (rec.review.state === dec.state && rec.review.notes === notes) continue;
      const review: Review = { state: dec.state };
      if (dec.state !== "draft") Object.assign(review, { reviewer, date: today });
      if (notes) review.notes = notes;
      rec.review = review;
      changed.add(file);
      applied++;
    }
  }
  if (refused.length) return { applied: 0, refused, problems: [] as string[] };
  for (const f of changed)
    writeFileSync(join(opts.dataDir ?? DATA_DIR, f.file), JSON.stringify(f.records, null, 2) + "\n");
  return { applied, refused, problems: validate(toData(loadFiles(opts.dataDir))) };
}
