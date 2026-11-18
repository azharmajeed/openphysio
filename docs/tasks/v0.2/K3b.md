# K3b: Cues and faults: top lower-body exercises
Project / milestone / feature: OpenPhysio / v0.2 / PRD-002
Lane: Knowledge
Status: Ready
Approved scope reference: docs/tasks/v0.2/README.md, docs/tasks/EXECUTION.md
Approved product specification ID/version: PRD-002 0.2-draft, v0.2 slice (D-18)
Approved technical plan ID/version: TP-002 v1 sections 1–4 (D-19); review states D-21
Acceptance criteria covered: AC-5, AC-6
Repository and base branch/commit: azharmajeed/openphysio, base v0.1
Relevant files/context links: packages/knowledge (README, src/types.ts: Cue, Fault, Source, Claim); packages/knowledge/data/top-exercises.json; packages/catalog/src/exercises.json (each exercise's existing `cues`, `avoidIf`, `level`); docs/research/sources.md
Dependencies and required completion state: K1 merged

Expected result:
For these 10 exercises (the most-planned lower-body main exercises; ids from the catalogue): glute_bridge, dumbbell_rdl, calf_raise, banded_hip_lift, single_leg_glute_bridge, wall_sit, clam, lateral_band_walk, bodyweight_squat, tibialis_raise.
1. 2–4 `Cue` records each in `data/cues/lower-body.json`: ≤ 12 words, our own wording, with a phase, a source and starting from the catalogue's existing cues where they hold up.
2. 2–3 `Fault` records each in `data/faults/lower-body.json`: what it looks like, why it matters (especially for knees, hips and the lower back), severity, and the cue that fixes it (`cueId`, same exercise).
3. Sources in `data/sources/technique-lower.json`: prefer peer-reviewed technique or EMG papers (PMID/DOI) and position stands (NSCA, ACSM) cited and paraphrased; coaching conventions are fine at grade C with a citation. Where a statement is a health claim (e.g. "reduces knee load"), add a `Claim` with its grade in the same file set (claims go in `data/claims/lower-limb.json` only if K2a has merged; otherwise state the grade in the fault's `why` and note it in the PR).
4. Replace the K1 example cue and fault. Every record `review.state: "draft"`.
5. Never copy sentences from sources or videos.

Allowed changes: packages/knowledge/data/cues/lower-body.json, data/faults/lower-body.json, data/sources/technique-lower.json
Explicit exclusions: other data files; schema; app.
Setup and validation commands: pnpm lint; pnpm typecheck; pnpm test
Required evidence/artifacts: a table in the PR per exercise: cues, faults, sources
Agent/runtime preference, if any: Claude Sonnet subagent, ponytail lite
Execution budget and retry limit: one implementation run + one repair after review
When to request a product or consequential technical decision: per EXECUTION.md escalation conditions
Completion condition: validated result + PR -> In review
Merge authority: orchestrator into v0.1 after review (D-9); Azhar for v0.1 -> main
