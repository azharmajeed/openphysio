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
