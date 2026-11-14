# TR1: Status page: requirements → tasks → status, generated from the repo
Project / milestone / feature: OpenPhysio / tooling / traceability (Azhar, 2026-11-14)
Lane: Tooling
Status: In review
Approved scope reference: Azhar 2026-11-14: "keep the current setup; one nice HTML page that updates from what is in the repo, broken down per work section and parallel stream"
Approved product specification ID/version: none (developer tooling)
Approved technical plan ID/version: none
Acceptance criteria covered: none (tooling)
Repository and base branch/commit: azharmajeed/openphysio, base v0.1
Relevant files/context links:
- docs/prd/PRD-*.md: acceptance criteria are lines `- AC-n …`, plus a `Status:` line
- docs/prd/PRD-*-verification.md: one table, columns AC | Status | Where | Date | Evidence | Note
- docs/tech/TP-*.md: `Status:` line
- docs/tasks/*.md: contracts with header lines `Status:`, `Acceptance criteria covered:`, `Approved product specification ID/version:`, optional `Lane:`, and `## Checkpoint` sections
- docs/tasks/README.md (and any docs/tasks/**/README.md): markdown tables with columns ID | Task | Lane | Needs | Size | ACs | Done when, plus a Waves table
- docs/decisions/D-*.md
- git log: merge commits titled `<ID>: … (#<PR>)`
Dependencies and required completion state: none

Expected result: `node scripts/status-page.mjs` (also `pnpm status`) writes `docs/status.html`, a single self-contained page: inline CSS and JS, no network, light and dark themes, readable on a phone.

The page shows:
1. **Header:** the date generated, the branch and commit, and totals (tasks by status, ACs by build and verification state).
2. **Work streams:** one column or section per Lane, listing each task with ID, title, status chip, PR link (from git log, `https://github.com/azharmajeed/openphysio/pull/<n>`), dependencies, and ACs. Parallel waves are shown too.
3. **Traceability, per PRD:** each AC in turn, with the tasks covering it and their statuses. Each AC also gets:
   - a computed **build state**:
     - all covering tasks Done → Built
     - some Done → In progress
     - none → Not started
     - no tasks → Unmapped (highlighted)
   - its **verification state** from the verification file (Not checked if missing), with the evidence and note
4. **Gaps:** ACs with no task, tasks with no AC (fine for foundation or tooling; show them plainly), tasks listed in a README without a contract (Planned), and Done tasks whose ACs are Not checked.
5. **Documents:** PRDs, TPs and decisions, each with its status line.

Task status comes from the contract's `Status:` line. A task listed in a README but without a contract is `Planned`. Lane comes from the README row, falling back to the contract's `Lane:`.

Everything is parsed generically: new PRDs (PRD-002, …), new READMEs and new lanes appear without code changes. An AC is identified by PRD plus AC id (e.g. PRD-002/AC-3). A contract's PRD comes from its `Approved product specification` field (the first `PRD-\d+` in it). Contracts without one, and README rows, default to PRD-001 for now.

`docs/status.html` goes into `.gitignore`: it is generated, not committed.

Parsing lives in pure functions with Vitest tests using small fixture strings (one PRD, one verification table, two contracts, one README table).

Allowed changes: scripts/**, package.json (script entry only), .gitignore, eslint config only if needed to lint scripts, tests next to the script
Explicit exclusions: no new dependencies (Node built-ins only), no changes to docs content, apps or packages.
Setup and validation commands: pnpm lint; pnpm typecheck; pnpm test; node scripts/status-page.mjs (must run cleanly on the real repo)
Required evidence/artifacts: test output; the counts printed by the script on the real repo; a short list of any real-repo gaps the page found
Agent/runtime preference, if any: Claude Sonnet subagent, ponytail lite
Execution budget and retry limit: one implementation run + one repair after review
When to request a product or consequential technical decision: per EXECUTION.md escalation conditions
Completion condition: validated result + PR -> In review
Merge authority: orchestrator into v0.1 after review (D-9); Azhar for v0.1 -> main

## Checkpoint
# TR1 / run 1
Agent/runtime/model, if reported: Claude Sonnet subagent, ponytail lite
Execution host and checkout: local, ..\openphysio-wt\TR1
Base commit / current branch / latest commit: b40ea6a / feat/tr1-status-page / see PR
Task/spec version: TR1 contract plus orchestrator addition (README `PRD:` line, `PRD-n/AC-n` qualified ids, milestone from folder)
Last activity time: 2026-11-14
Work completed: scripts/status-page.mjs (parsers, model, HTML renderer, Node built-ins only), scripts/status-page.test.mjs (fixtures), `pnpm status`, docs/status.html in .gitignore.
Uncommitted changes and where they are preserved: none after commit
Validation performed and results: pnpm lint, typecheck, test (231 passed) all pass; node scripts/status-page.mjs runs cleanly on the real repo.
Artifacts, preview, and PR links: see PR
Failures and attempts already made: none
Open decisions/blockers: none
Next action: review
Task state and reason: In review, PR open
Usage/cost, or unavailable: unavailable
