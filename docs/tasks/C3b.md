# C3b: Plan engine driven by goals and catalogue data, with no hard-coded ids, injuries or weekdays
Project / milestone / feature: OpenPhysio / v0.1-app / PRD-001
Status: In review
Approved scope reference: docs/tasks/README.md, docs/tasks/EXECUTION.md
Approved product specification ID/version: PRD-001 v0.1 (D-1)
Approved technical plan ID/version: TP-001 v1 (D-2), decisions D-3 to D-10
Acceptance criteria covered: AC-2, AC-3, AC-4 (same as C3; now for any profile, not just Azhar's)
Repository and base branch/commit: azharmajeed/openphysio, base v0.1 after C3
Relevant files/context links: Azhar's instruction 2026-11-09: nothing hard-coded for a specific use case or injury; EXECUTION.md conventions; packages/core/src/plan/generate.ts (C3); packages/catalog (C1); TP-001 Plan engine
Dependencies and required completion state: C3 merged into v0.1
Expected result: (1) Goal definitions as data in packages/catalog (e.g. goals.ts/json): each goal has id, label, and weekly session demands by session type (count range, role mix such as easy/quality/long for runs, technique/endurance for swims, intensity), spacing needs (no two high-impact days back-to-back, long session preferably on a rest-from-work day chosen by data not by weekday constant), and `alternatives` (session types that can stand in when every option for a demand is filtered by injuries or equipment, e.g. run → low-impact conditioning). The five PRD goals are entries; adding a goal needs no code change. (2) Catalogue fields replace id lists in code: `level` 1|2|3 on every exercise (drives week-by-week staging for patterns with no history), `role` on run/swim/conditioning templates (easy, quality, long, technique, endurance, recovery). Add a small set of low-impact conditioning entries (stationary bike, elliptical, rower, pool running/aqua jog, swim) with honest avoidIf so substitution has options. (3) Engine: generateBlock reads profile.goals, sports, equipment, poolDays (and an optional profile.trainingDays if present, else all 7) and the goal definitions; merges demands, schedules sessions across days with the spacing rules, places sessions needing a pool only on poolDays (if none set, any day), uses `level` for staging and `role` for template choice, and when a demand has no allowed exercise after filterForInjuries it uses that goal's alternatives, recording the substitution reason on the session. Spike guard and deload unchanged. Remove PLYO_TIER, ADVANCED_STRENGTH, POOL_FALLBACK and every literal exercise id or weekday from generate.ts. (4) Tests: Azhar's profile still meets AC-3 counts; a different profile (only 'gain_weight', gym, no pool) yields a strength-focused week with no runs/swims; knee injury profile gets alternatives instead of runs/plyos with reasons; adding a fake goal in a test fixture changes the week without code changes; a grep-style test asserts generate.ts contains no catalogue ids.
Allowed changes: packages/core/src/plan/**, packages/core/src/index.ts, packages/catalog/** (data + types), docs/research/sources.md, pnpm-lock.yaml
Explicit exclusions: no mobile changes; no change to safety rule semantics.
Setup and validation commands: pnpm lint; pnpm typecheck; pnpm test
Required evidence/artifacts: test output; printed example weeks for Azhar's profile, the gain-weight-only profile and the knee-injury profile in the PR
Agent/runtime preference, if any: Claude Sonnet subagent, ponytail lite
Execution budget and retry limit: one implementation run + one repair after review
When to request a product or consequential technical decision: per EXECUTION.md escalation conditions
Completion condition: validated result + PR -> In review
Merge authority: orchestrator into v0.1 after review (D-9); Azhar for v0.1 -> main

## Checkpoint
# C3b / run 1
Agent/runtime/model, if reported: Claude Sonnet subagent, ponytail lite
Execution host and checkout: local Windows, C:\Users\rahza\Documents\work\openphysio-wt\C3b
Base commit / current branch / latest commit: fbe2954 / feat/c3b-data-driven-plan / see PR
Task/spec version: C3b contract, PRD-001 v0.1, TP-001 v1
Work completed: goal definitions in packages/catalog (goals.ts, five PRD goals); catalogue fields level, role, intensity on every relevant exercise; new "conditioning" session type (bike, elliptical, rower, pool running) and "pool" equipment; session type mobility_knee renamed mobility; generate.ts rewritten to read profile.goals, sports, equipment, poolDays, optional trainingDays and the goal data; greedy weekly layout with impact spacing; alternatives with reasons; tests rewritten.
Uncommitted changes and where they are preserved: none after commit
Validation performed and results: pnpm lint, typecheck, test pass (114 tests).
Artifacts, preview, and PR links: PR to v0.1
Failures and attempts already made: none
Open decisions/blockers: none
Next action: review
Task state and reason: In review
Usage/cost, or unavailable: unavailable

# C3b / run 2 (repair)
Work completed: demands merged across goals as a shared session (max count, union muscles, max priority) instead of stacked; priority field on demands; two-pass placement (minimums by priority, then extras); generateBlock returns { sessions, warnings } and reports every dropped or option-less demand; AC-3 test now uses the all-five-goals fixture; new warning tests.
Validation performed and results: pnpm lint, typecheck, test pass (117 tests).
Task state and reason: In review
