# packages/catalog

Exercise catalogue and evidence sources (C1, A1).

- `src/exercises.json` is the committed, curated catalogue (120 entries). `src/index.ts` types it and exports `exercises`, `getExercise`, `bySessionType`.
- Regenerate with `pnpm --filter @openphysio/catalog import:fed` (fetches free-exercise-db, merges `scripts/curated.ts`). `curated.ts` holds our session types, injury flags (`avoidIf`), prescriptions and cues.
- Runs and swims are session templates (unit minutes / meters), not movements.
- `demo.status: "film-it"` until a clip exists.

## Attribution

Exercise names, equipment and primary muscles for part of the list come from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain, Unlicense). Cues and prescriptions are our own; free-exercise-db instructions and images are not used. Import data only from wger/ExerciseDB; never their AGPL code.
