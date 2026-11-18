# K2b: Muscle atlas: upper limb, neck and shoulder
Project / milestone / feature: OpenPhysio / v0.2 / PRD-002
Lane: Knowledge
Status: Blocked
Approved scope reference: docs/tasks/v0.2/README.md, docs/tasks/EXECUTION.md
Approved product specification ID/version: PRD-002 0.2-draft, v0.2 slice (D-18)
Approved technical plan ID/version: TP-002 v1 sections 1–4 (D-19); review states D-21
Acceptance criteria covered: AC-5, AC-6
Repository and base branch/commit: azharmajeed/openphysio, base v0.1
Relevant files/context links: packages/knowledge (README, src/types.ts, src/validate.ts, data/body-map-areas.json); packages/catalog/src/exercises.json (`primaryMuscles` group names); docs/tech/TP-002-data-ai.md sections 2–3
Dependencies and required completion state: K1 merged

Expected result:
Draft records, written in our own words from open sources, for every muscle a user needs to understand the upper-body exercises in the catalogue.
1. `MuscleGroup` records in `data/muscle-groups/upper.json`, one per catalogue group name in this region: chest, shoulders, upper_back, lats, biceps, triceps, forearms. The group id is the catalogue name exactly. `bodyMapAreas` from body-map-areas.json.
2. `Muscle` records in `data/muscles/upper-limb.json` and `data/muscles/neck-shoulder.json` (about 20 muscles: e.g. pectoralis major/minor, anterior/lateral/posterior deltoid, rotator cuff (supraspinatus, infraspinatus, teres minor, subscapularis), trapezius (upper, middle, lower), rhomboids, serratus anterior, latissimus dorsi, biceps brachii, brachialis, triceps brachii, forearm flexors and extensors, deep neck flexors, levator scapulae). Each: actions, a one-sentence daily-life role, `bodyMapArea`.
3. If K2a has not merged yet and a muscle has no body-map slug (e.g. subscapularis), use the nearest drawn slug and say so in `review.notes`; don't edit types.ts (K2a owns that change).
4. Sources in `data/sources/anatomy-upper.json`: OpenStax Anatomy & Physiology 2e (CC BY 4.0) chapter pages, Wikidata items (CC0), and peer-reviewed papers where an action is debated (PMID/DOI). Optional `Claim` records in `data/claims/upper-limb.json` (grade A/B/C).
5. Every record `review.state: "draft"`. Never set a checked state.
6. Paraphrase only. Never copy sentences from a source. No CC BY-SA text.

Allowed changes: packages/knowledge/data/muscles/upper-limb.json, data/muscles/neck-shoulder.json, data/muscle-groups/upper.json, data/sources/anatomy-upper.json, data/claims/upper-limb.json
Explicit exclusions: no other data files (K2a owns the lower body and the schema change); no exercise links (K3a); no app changes.
Setup and validation commands: pnpm lint; pnpm typecheck; pnpm test
Required evidence/artifacts: a table in the PR: muscle, group, body-map area, actions, source
Agent/runtime preference, if any: Claude Sonnet subagent, ponytail lite
Execution budget and retry limit: one implementation run + one repair after review
When to request a product or consequential technical decision: per EXECUTION.md escalation conditions
Completion condition: validated result + PR -> In review
Merge authority: orchestrator into v0.1 after review (D-9); Azhar for v0.1 -> main

## Checkpoint
# K2b / run 1
Agent/runtime/model, if reported: Claude Sonnet implementer, ponytail lite
Execution host and checkout: openphysio-wt/K2b, branch feat/k2b-muscles-upper
Base commit / current branch / latest commit: a2f6e31 / feat/k2b-muscles-upper / see PR
Task/spec version: K2b contract as of a2f6e31
Work completed: 23 muscles, 7 groups, 2 sources, 16 claims, all draft
Uncommitted changes and where they are preserved: none after commit
Validation performed and results: lint and typecheck pass; test: 1 failure (the K1 fixture test above), 280 pass
Artifacts, preview, and PR links: PR title "K2b: Muscle atlas: upper limb, neck and shoulder"
Failures and attempts already made: none
Open decisions/blockers: claim grade for textbook anatomy; unsourced part-level actions listed in review.notes
Next action: Azhar review
Task state and reason: Blocked. packages/knowledge/src/knowledge.test.ts "a published record needs its references published" assumes the K1 example data set (one source, one claim, one cue), so any real data fails it; fix is outside the contract
Usage/cost, or unavailable: unavailable
