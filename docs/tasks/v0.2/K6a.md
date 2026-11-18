# K6a: Review page generator and bulk review update
Project / milestone / feature: OpenPhysio / v0.2 / PRD-002
Lane: Knowledge
Status: In review
Approved scope reference: docs/tasks/v0.2/README.md, docs/tasks/EXECUTION.md
Approved product specification ID/version: PRD-002 0.2-draft, v0.2 slice (D-18)
Approved technical plan ID/version: TP-002 v1 section 4 step 5 (D-19); review states D-21
Acceptance criteria covered: AC-6
Repository and base branch/commit: azharmajeed/openphysio, base v0.1
Relevant files/context links: packages/knowledge (README, src/types.ts, src/data.ts, src/validate.ts); scripts/status-page.mjs (a static HTML page generated from repo data; reuse its approach and look)
Dependencies and required completion state: K1 merged

Expected result:
Azhar reviews knowledge entries in a browser, not in JSON.
1. `pnpm --filter @openphysio/knowledge review` writes `packages/knowledge/review.html` (gitignored): one self-contained static page, no network calls, grouped by data file. Each record shows its fields in plain words, its source (citation, link, licence, grade where present), what it references (e.g. a fault's cue), its current state and notes, and validation problems if any.
2. For each record: buttons `source-checked`, `rejected`, `leave as draft`, and a notes box. Filters: by file, by state, "needs a decision". The page keeps choices in localStorage and has "Download decisions" that saves `review-decisions.json` (`[{ file, id, state, notes }]`).
3. `pnpm --filter @openphysio/knowledge apply-review <path>` applies a decisions file to the data JSON: sets `review.state`, `review.reviewer` (from `--reviewer`, default "Azhar"), `review.date` (today) and notes; refuses `clinician-reviewed` unless `--clinician` is passed; refuses unknown ids; keeps file formatting stable (2-space JSON, trailing newline). Then runs validate and prints problems.
4. Tests for apply-review (state change, refusal cases, idempotence) on the K1 test fixture or temp files, never the real data.
5. README section "How to review".

Allowed changes: packages/knowledge/scripts/**, packages/knowledge/src/review*.ts (if shared code is needed), packages/knowledge/package.json (scripts), packages/knowledge/.gitignore, packages/knowledge/README.md, tests
Explicit exclusions: no data JSON edits (K2/K3 tasks are writing them); no app changes.
Setup and validation commands: pnpm lint; pnpm typecheck; pnpm test; pnpm --filter @openphysio/knowledge review
Required evidence/artifacts: a screenshot or description of the page in the PR
Agent/runtime preference, if any: Claude Sonnet subagent, ponytail lite
Execution budget and retry limit: one implementation run + one repair after review
When to request a product or consequential technical decision: per EXECUTION.md escalation conditions
Completion condition: validated result + PR -> In review
Merge authority: orchestrator into v0.1 after review (D-9); Azhar for v0.1 -> main

## Checkpoint
# K6a / run 1
Agent/runtime/model, if reported: Claude Sonnet subagent, ponytail lite
Execution host and checkout: local, C:\Users\rahza\Documents\work\openphysio-wt\K6a
Base commit / current branch / latest commit: bf68d0d / feat/k6a-review-page / see PR
Task/spec version: K6a contract (Ready)
Work completed: review page generator (scripts/review.ts, src/review-page.ts), apply-review (scripts/apply-review.ts, src/review.ts), tests on temp copies of the K1 fixture, README "How to review", package scripts, .gitignore
Uncommitted changes and where they are preserved: none after commit
Validation performed and results: pnpm lint, typecheck, test pass; pnpm --filter @openphysio/knowledge review writes review.html
Artifacts, preview, and PR links: see PR
Failures and attempts already made: none
Open decisions/blockers: none
Next action: review
Task state and reason: In review, PR open
Usage/cost, or unavailable: unavailable
