# K2a: Muscle atlas: hip, trunk and lower limb
Project / milestone / feature: OpenPhysio / v0.2 / PRD-002
Lane: Knowledge
Status: In review
Approved scope reference: docs/tasks/v0.2/README.md, docs/tasks/EXECUTION.md
Approved product specification ID/version: PRD-002 0.2-draft, v0.2 slice (D-18)
Approved technical plan ID/version: TP-002 v1 sections 1–4 (D-19); review states D-21
Acceptance criteria covered: AC-5, AC-6
Repository and base branch/commit: azharmajeed/openphysio, base v0.1
Relevant files/context links: packages/knowledge (README, src/types.ts, src/validate.ts, data/body-map-areas.json); packages/catalog/src/exercises.json (`primaryMuscles` group names); docs/tech/TP-002-data-ai.md sections 2–3
Dependencies and required completion state: K1 merged

Expected result:
Draft records, written in our own words from open sources, for every muscle a user needs to understand the hip, trunk and lower-limb exercises in the catalogue.
1. `MuscleGroup` records in `data/muscle-groups/lower.json`, one per catalogue group name in this region: quads, hamstrings, glutes, calves, abductors, adductors, tibialis, hip_flexors, abdominals, lower_back. The group id is the catalogue name exactly, so K3a can map exercises without guessing. `bodyMapAreas` from body-map-areas.json.
2. `Muscle` records in `data/muscles/lower-limb.json` and `data/muscles/hip-trunk.json` (about 22–25 muscles: e.g. rectus femoris, vastus lateralis/medialis/intermedius, biceps femoris, semitendinosus, semimembranosus, gluteus maximus/medius/minimus, tensor fasciae latae, adductor group, gastrocnemius, soleus, tibialis anterior, iliopsoas, rectus abdominis, obliques, transversus abdominis, erector spinae, multifidus, quadratus lumborum). Each: actions, a one-sentence daily-life role, `bodyMapArea`. Replace the K1 example record.
3. A muscle with no body-map slug (e.g. iliopsoas, transversus abdominis) may omit `bodyMapArea`: make that field optional in types.ts and validate.ts (the only schema change allowed).
4. Sources in `data/sources/anatomy-lower.json`: OpenStax Anatomy & Physiology 2e (CC BY 4.0) chapter pages, Wikidata items (CC0), and peer-reviewed papers where an action is debated (PMID/DOI). Optional `Claim` records in `data/claims/lower-limb.json` and `hip-trunk.json` (grade A/B/C) for statements beyond basic anatomy.
5. Every record `review.state: "draft"`. Azhar sets `source-checked` later; never set it yourself.
6. Paraphrase only. Never copy sentences from a source. No CC BY-SA text.

Allowed changes: packages/knowledge/data/muscles/lower-limb.json, data/muscles/hip-trunk.json, data/muscle-groups/lower.json, data/sources/anatomy-lower.json, data/claims/lower-limb.json, data/claims/hip-trunk.json; packages/knowledge/src/types.ts and src/validate.ts (optional bodyMapArea only); tests for that change
Explicit exclusions: no other data files (K2b owns the upper body); no exercise links (K3a); no app changes.
Setup and validation commands: pnpm lint; pnpm typecheck; pnpm test
Required evidence/artifacts: a table in the PR: muscle, group, body-map area, actions, source
Agent/runtime preference, if any: Claude Sonnet subagent, ponytail lite
Execution budget and retry limit: one implementation run + one repair after review
When to request a product or consequential technical decision: per EXECUTION.md escalation conditions
Completion condition: validated result + PR -> In review
Merge authority: orchestrator into v0.1 after review (D-9); Azhar for v0.1 -> main

## Checkpoint
# K2a / run 1
Agent/runtime/model, if reported: Claude Sonnet subagent, ponytail lite
Execution host and checkout: local, worktree openphysio-wt/K2a
Base commit / current branch / latest commit: a2f6e31 / feat/k2a-muscles-lower / see PR
Task/spec version: K2a contract
Work completed: 25 draft Muscle records (13 lower-limb, 12 hip-trunk), 10 MuscleGroup records, 3 OpenStax sources, 7 claims; bodyMapArea made optional (types, validate, test)
Uncommitted changes and where they are preserved: none after commit
Validation performed and results: pnpm lint, typecheck, test pass (282 tests)
Artifacts, preview, and PR links: see PR
Failures and attempts already made: OpenStax section URLs guessed wrong at first; found 11.3, 11.4, 11.6. Wikidata not used (no item ids verified)
Open decisions/blockers: questions in review.notes (gluteus minimus action, hip_flexors body-map area)
Next action: review
Task state and reason: In review, PR open
Usage/cost, or unavailable: unavailable

# K2a / run 2 (repair)
Work completed: rebased on origin/v0.1 (conflict in knowledge.test.ts); took v0.1 tests using fixture.test-data.ts and re-added only the optional-bodyMapArea test.
Validation performed and results: pnpm lint, typecheck, test pass.
Task state and reason: In review, PR #43 awaiting CI.
