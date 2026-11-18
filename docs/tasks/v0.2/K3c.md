# K3c: Cues and faults: top upper-body exercises
Project / milestone / feature: OpenPhysio / v0.2 / PRD-002
Lane: Knowledge
Status: Ready
Approved scope reference: docs/tasks/v0.2/README.md, docs/tasks/EXECUTION.md
Approved product specification ID/version: PRD-002 0.2-draft, v0.2 slice (D-18)
Approved technical plan ID/version: TP-002 v1 sections 1–4 (D-19); review states D-21
Acceptance criteria covered: AC-5, AC-6
Repository and base branch/commit: azharmajeed/openphysio, base v0.1
Relevant files/context links: packages/knowledge (README "How to review", src/types.ts); data/cues/lower-body.json, data/faults/lower-body.json, data/sources/technique-lower.json (K3b: follow the same style and level of sourcing); packages/catalog/src/exercises.json (existing cues, avoidIf); data/claims/upper-limb.json (K2b claims you may cite)
Dependencies and required completion state: K1, K2b merged

Expected result:
Same as K3b, for these 10 exercises: lat_pulldown, dumbbell_row, incline_pushup, close_grip_pushup, band_row, dumbbell_curl, hammer_curl, inverted_row, pullup, dumbbell_shoulder_press.
1. 2–4 `Cue` records each in `data/cues/upper-body.json` (≤ 12 words, own wording, phase, source).
2. 2–3 `Fault` records each in `data/faults/upper-body.json` (description, why it matters — especially for the shoulder, neck and lower back — severity, fixing `cueId`).
3. Sources in `data/sources/technique-upper.json`: peer-reviewed technique or EMG papers (PMID/DOI, checked through NCBI E-utilities), cited and paraphrased; coaching convention at grade C. Health claims go in `data/claims/upper-limb.json` with a grade.
4. Every record `review.state: "draft"`, and `review.notes` says what the source does and doesn't support.
5. Never copy sentences from sources or videos.

Allowed changes: packages/knowledge/data/cues/upper-body.json, data/faults/upper-body.json, data/sources/technique-upper.json, data/claims/upper-limb.json (append only)
Explicit exclusions: tests, schema, other data files, app.
Setup and validation commands: pnpm lint; pnpm typecheck; pnpm test
Required evidence/artifacts: a table in the PR per exercise: cues, faults, sources; weakest-sourced items listed
Agent/runtime preference, if any: Claude Sonnet subagent, ponytail lite
Execution budget and retry limit: one implementation run + one repair after review
When to request a product or consequential technical decision: per EXECUTION.md escalation conditions
Completion condition: validated result + PR -> In review
Merge authority: orchestrator into v0.1 after review (D-9); Azhar for v0.1 -> main
