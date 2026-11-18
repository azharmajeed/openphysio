# @openphysio/knowledge

The evidence-backed knowledge base (TP-002 sections 2 and 4, D-19, D-21). JSON data plus types, validation and a reviewed-only export. Consumed as TypeScript source, like `@openphysio/catalog`.

## Record types (`src/types.ts`)

`Source`, `Muscle`, `MuscleGroup`, `ExerciseMuscle`, `Cue`, `Fault`, `Claim`, `VideoSegment`. `Guideline` and `FormRule` arrive in v0.3. Each record has `review: { state, reviewer?, date?, notes? }`.

## Layout

`data/<record>/<region-or-topic>.json`, each file an array. Parallel tasks add their own file, so they never edit the same one:

```
data/sources/  muscles/  muscle-groups/  exercise-muscles/  cues/  faults/  claims/  video-segments/
data/body-map-areas.json   slugs of react-native-body-highlighter 3.2.0 (Muscle.bodyMapArea must be one)
data/top-exercises.json    the 30 most-planned exercises (pnpm --filter @openphysio/knowledge top)
```

`src/data.ts` imports every file statically (Metro has no globbing).

## Review states (D-21)

| State | Meaning | Ships |
| --- | --- | --- |
| `draft` | written, not checked | no |
| `source-checked` | Azhar confirmed the source supports the entry | yes |
| `clinician-reviewed` | a clinician checked it (later) | yes |
| `rejected` | refused, reason in `notes` | no |

`published()` returns only shipping records whose references (source, muscle, claim, cue) also ship. The app reads `published()`, never `allRecords`.

## Add a record

1. Put it in a new or existing file under `data/<record>/`, with `review.state: "draft"`.
2. New file: add one import and one spread line in `src/data.ts`.
3. Every claim, cue, fault and exercise link needs a `sourceId`; add the source under `data/sources/` (DOI, PMID or URL, plus licence). Paraphrase and cite; never paste source text.
4. `pnpm test`. `validate()` reports broken references, grades, cue length (12 words) and body-map slugs.
5. Review sets `state` to `source-checked` with `reviewer` and `date`.

## How to review

1. `pnpm --filter @openphysio/knowledge review` writes `packages/knowledge/review.html` (gitignored). Open it in a browser. Each entry shows its fields in plain words, its source with links, what it points at, and what to check. Raw JSON is behind a toggle.
2. Per entry choose `source-checked`, `rejected` or `leave as draft`, and add notes. Choices are kept in the browser. Filters: file, state, "Needs a decision".
3. Click "Download decisions" (saves `review-decisions.json`).
4. `pnpm --filter @openphysio/knowledge apply-review path/to/review-decisions.json` updates the data files (reviewer defaults to Azhar, `--reviewer Name` to change; date is today) and runs validation. `clinician-reviewed` is refused unless `--clinician` is passed. Unknown ids or files refuse the whole file, nothing is written. Applying the same file again changes nothing. `leave as draft` clears reviewer and date.
5. Review the diff, then commit the data files.

Files are rewritten as 2-space JSON with a trailing newline, so the first apply on a hand-formatted file may reformat it once.
