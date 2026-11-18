# K3a: Exercise ↔ muscle links for the whole catalogue
Project / milestone / feature: OpenPhysio / v0.2 / PRD-002
Lane: Knowledge
Status: Done
Approved scope reference: docs/tasks/v0.2/README.md, docs/tasks/EXECUTION.md
Approved product specification ID/version: PRD-002 0.2-draft, v0.2 slice (D-18)
Approved technical plan ID/version: TP-002 v1 sections 1–4 (D-19); review states D-21
Acceptance criteria covered: AC-5 (muscles worked on a body map), AC-6 (every catalogue exercise links to its primary and secondary muscles)
Repository and base branch/commit: azharmajeed/openphysio, base v0.1
Relevant files/context links: packages/catalog/src/exercises.json (131 exercises; `primaryMuscles` are group names that equal MuscleGroup ids); packages/knowledge/data/muscle-groups/*.json, data/muscles/*.json (K2a, K2b); data/sources/*.json; src/validate.ts and coverage(); the technique sources K3b–K3d added (EMG papers name the muscles they measured)
Dependencies and required completion state: K2a, K2b merged

Expected result:
1. `ExerciseMuscle` records in `data/exercise-muscles/lower-body.json` (rename the file is not allowed; it is the one registered file — the name is historical) for every catalogue exercise: at least one `primary`, plus `secondary` and `stabiliser` where they matter. Link to muscle ids (not groups). Start from each exercise's catalogue `primaryMuscles` group and choose the specific muscles in that group that the movement trains.
2. Every link has a `sourceId`: an EMG/technique source already in the data when it measured that exercise or movement pattern, otherwise the OpenStax anatomy source for the muscle's action (the action explains the link). Say which in `review.notes` when it's inference from the action.
3. Cardio and swim entries (e.g. elliptical, swim drills) get the main working muscles only; don't over-link.
4. Make the coverage test strict for exercises: every catalogue exercise has ≥ 1 primary link (change the coverage test from report to assertion for exercises only; body-map areas stay a report).
5. Every record `review.state: "draft"`. Replace the K1 example link.

Allowed changes: packages/knowledge/data/exercise-muscles/lower-body.json; packages/knowledge/src/knowledge.test.ts (only the coverage test's exercise assertion)
Explicit exclusions: no muscle, group, cue or source edits (report gaps instead); no app changes.
Setup and validation commands: pnpm lint; pnpm typecheck; pnpm test
Required evidence/artifacts: a table in the PR: exercise → primary / secondary / stabiliser muscles; list of links inferred from anatomy only
Agent/runtime preference, if any: Claude Sonnet subagent, ponytail lite
Execution budget and retry limit: one implementation run + one repair after review
When to request a product or consequential technical decision: per EXECUTION.md escalation conditions
Completion condition: validated result + PR -> In review
Merge authority: orchestrator into v0.1 after review (D-9); Azhar for v0.1 -> main

## Checkpoint
# K3a / run 1
Agent/runtime/model, if reported: Claude Sonnet subagent, ponytail lite
Execution host and checkout: local, ..\openphysio-wt\K3a
Base commit / current branch / latest commit: 90d13f4 / feat/k3a-exercise-muscles / see PR
Work completed: 777 ExerciseMuscle links (320 primary, 384 secondary, 73 stabiliser) for all 131 catalogue exercises; K1 example replaced; coverage test now asserts every exercise has a primary.
Uncommitted changes and where they are preserved: none after commit
Validation performed and results: pnpm lint, typecheck, test pass (one run timed out in apps/server; that file passes alone).
Open decisions/blockers: see PR (catalogue group mismatches, no missing muscles).
Next action: Azhar review of links and sources.
Task state and reason: In review, PR open.
Usage/cost, or unavailable: unavailable
