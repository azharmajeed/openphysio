# AP3a: Points and streak engine in core, rules in data
Project / milestone / feature: OpenPhysio / v0.2 / PRD-002
Lane: App
Status: Ready
Approved scope reference: docs/tasks/v0.2/README.md, docs/tasks/EXECUTION.md
Approved product specification ID/version: PRD-002 0.2-draft, v0.2 slice (D-18)
Approved technical plan ID/version: TP-004 v1 section 4, points and streaks only (D-19)
Acceptance criteria covered: AC-8
Repository and base branch/commit: azharmajeed/openphysio, base v0.1
Relevant files/context links: docs/tech/TP-004-app.md section 4; packages/core/src/db/schema.ts (planned_session, workout, set_log, pain_entry); packages/core/src/safety/pain-monitor.ts (what counts as a pain stop); packages/core/src/plan/history.ts (buildHistory pattern); packages/catalog/src/goals.ts (data pattern)
Dependencies and required completion state: none

Expected result:
Pure functions in `packages/core/src/play/` that compute consistency points and the weekly streak from the user's logs. Nothing is stored in this task: AP3b wires it into the app.
1. Rules in data: `packages/catalog/src/play.json` (typed export from `@openphysio/catalog`): points per event (`plannedSessionCompleted`, `setLogged`, `painCheckAnswered`, `weeklyCheckIn`, `unplannedSessionLogged`), `dailyCap`, `streak.threshold` (share of planned sessions done for a week to count, default 0.8), `weekStartsOn` (1 = Monday). No numbers in code apart from defaults in types.
2. `computeLedger(input)`: input = planned sessions, workouts, set logs, pain entries, check-in dates, rules. Output = ledger entries `{ id, date, event, points, refId }`, with deterministic ids from the event key, so the same logs always give the same ledger (duplicates and re-runs can't farm points).
3. Guards (code, tested):
   - Sets beyond the planned sets for that exercise in a planned session earn nothing; unplanned sessions earn only `unplannedSessionLogged`, once per day.
   - After a pain stop (the pain-monitor rule), later sets in that workout and any later workout that day earn nothing.
   - `dailyCap` per local date.
   - Workouts not finished (`endedAt` null) or deleted earn nothing.
4. `computeStreak(input)`: weekly streak (local weeks from `weekStartsOn`). A week counts when done/planned ≥ threshold; a week with no planned sessions counts (planned rest never breaks a streak); a week with a pain stop that left sessions undone is frozen (neither counts nor breaks). Returns current streak, best streak, and this week's progress (done, planned, points).
5. Dates use the local YYYY-MM-DD strings the app already uses; no timezone library.
6. Tests: farming (duplicate logs, edits after the fact, over-plan sets), pain stop, daily cap, rest weeks, freeze, threshold edges, unfinished and deleted workouts, determinism.

Allowed changes: packages/core/src/play/**, packages/core/src/index.ts, packages/catalog/src/play.json, packages/catalog/src/index.ts (export only)
Explicit exclusions: no schema or migration changes; no app changes; no levels or badges (v0.3).
Setup and validation commands: pnpm lint; pnpm typecheck; pnpm test
Required evidence/artifacts: test output; a worked example (a week of logs → ledger and streak) in the PR
Agent/runtime preference, if any: Claude Sonnet subagent, ponytail lite
Execution budget and retry limit: one implementation run + one repair after review
When to request a product or consequential technical decision: per EXECUTION.md escalation conditions
Completion condition: validated result + PR -> In review
Merge authority: orchestrator into v0.1 after review (D-9); Azhar for v0.1 -> main
