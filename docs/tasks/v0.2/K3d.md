# K3d: Cues and faults: top trunk, rehab and conditioning exercises
Project / milestone / feature: OpenPhysio / v0.2 / PRD-002
Lane: Knowledge
Status: Ready
Approved scope reference: docs/tasks/v0.2/README.md, docs/tasks/EXECUTION.md
Approved product specification ID/version: PRD-002 0.2-draft, v0.2 slice (D-18)
Approved technical plan ID/version: TP-002 v1 sections 1–4 (D-19); review states D-21
Acceptance criteria covered: AC-5, AC-6
Repository and base branch/commit: azharmajeed/openphysio, base v0.1
Relevant files/context links: packages/knowledge (README "How to review", src/types.ts); data/cues/lower-body.json, data/faults/lower-body.json, data/sources/technique-lower.json (K3b: follow the same style and level of sourcing); packages/catalog/src/exercises.json; data/claims/hip-trunk.json (K2a claims you may cite)
Dependencies and required completion state: K1, K2a merged

Expected result:
Same as K3b, for these 10 exercises, chosen because people with back pain or an injury do them most: bird_dog, dead_bug, plank, side_plank, superman, cat_cow, band_pallof_press, straight_leg_raise, backward_walk, band_pull_apart.
1. 2–4 `Cue` records each in `data/cues/trunk.json` (≤ 12 words, own wording, phase, source).
2. 2–3 `Fault` records each in `data/faults/trunk.json` (description, why it matters — especially for the lower back and neck — severity, fixing `cueId`).
3. Sources in `data/sources/technique-trunk.json`: peer-reviewed papers (PMID/DOI, checked through NCBI E-utilities; McGill's trunk-endurance and spine-load work is relevant), paraphrased; coaching convention at grade C. Health claims go in `data/claims/hip-trunk.json` (append) with a grade.
4. Every record `review.state: "draft"`, and `review.notes` says what the source does and doesn't support.
5. Never copy sentences from sources or videos. Don't promise pain relief: describe what the exercise trains and what to avoid.

Allowed changes: packages/knowledge/data/cues/trunk.json, data/faults/trunk.json, data/sources/technique-trunk.json, data/claims/hip-trunk.json (append only)
Explicit exclusions: tests, schema, other data files, app.
Setup and validation commands: pnpm lint; pnpm typecheck; pnpm test
Required evidence/artifacts: a table in the PR per exercise: cues, faults, sources; weakest-sourced items listed
Agent/runtime preference, if any: Claude Sonnet subagent, ponytail lite
Execution budget and retry limit: one implementation run + one repair after review
When to request a product or consequential technical decision: per EXECUTION.md escalation conditions
Completion condition: validated result + PR -> In review
Merge authority: orchestrator into v0.1 after review (D-9); Azhar for v0.1 -> main
