# AP3b: Points and streak in the app (local)
Project / milestone / feature: OpenPhysio / v0.2 / PRD-002
Lane: App
Status: In review
Approved scope reference: docs/tasks/v0.2/README.md, docs/tasks/EXECUTION.md
Approved product specification ID/version: PRD-002 0.2-draft, v0.2 slice (D-18)
Approved technical plan ID/version: TP-004 v1 section 4, points and streaks only (D-19)
Acceptance criteria covered: AC-8
Repository and base branch/commit: azharmajeed/openphysio, base v0.1
Relevant files/context links: packages/core/src/play (computeLedger, computeStreak, PlayInput); packages/catalog playRules; apps/mobile/src/lib/plandb.ts, logdb.ts, adaptdb.ts (reviewedWeek: the weekly check-in), apps/mobile/src/app/checkin.tsx; apps/mobile/src/lib/*.test.ts (better-sqlite3 test pattern)
Dependencies and required completion state: AP3a merged

Expected result:
1. `apps/mobile/src/play/playdb.ts`: loads planned sessions, finished workouts, set logs and pain entries from SQLite and returns `computeLedger` and `computeStreak` results for today. Nothing new is stored for points: the ledger is recomputed from logs (a stored, synced ledger is v0.4).
2. Check-ins: record the date each time the weekly check-in is completed, in the same expo-sqlite kv-store pattern as `reviewedWeek` (list of YYYY-MM-DD, deduped). Pass them to the engine. Hook the write into the existing check-in completion code only.
3. `usePlay()` hook: `{ streak, thisWeek, ledgerToday }`, refreshed on screen focus. No screen uses it yet (UI2a does); add it to the dev-only debug output if one exists, otherwise nothing.
4. Tests (Vitest + better-sqlite3, as the other lib tests): a seeded week of logs gives the expected points and streak; a check-in is recorded once per week; deleted and unfinished workouts earn nothing.

Allowed changes: apps/mobile/src/play/**, apps/mobile/src/lib/adaptdb.ts (check-in date write only), apps/mobile/src/app/checkin.tsx (only if the completion point lives there)
Explicit exclusions: no screen redesign (UI0 is changing Today; UI2a renders points); no schema or migration; no server.
Setup and validation commands: pnpm lint; pnpm typecheck; pnpm test; `npx expo export -p android` in apps/mobile
Required evidence/artifacts: test output
Agent/runtime preference, if any: Claude Sonnet subagent, ponytail lite
Execution budget and retry limit: one implementation run + one repair after review
When to request a product or consequential technical decision: per EXECUTION.md escalation conditions
Completion condition: validated result + PR -> In review
Merge authority: orchestrator into v0.1 after review (D-9); Azhar for v0.1 -> main

## Checkpoint
# AP3b / run 1
Agent/runtime/model, if reported: Claude Sonnet subagent, ponytail lite
Execution host and checkout: C:\w\AP3b
Base commit / current branch / latest commit: a2f6e31 / feat/ap3b-points-app / see PR
Task/spec version: AP3b contract, PRD-002 0.2-draft, TP-004 v1 section 4
Work completed: play/playdb.ts (loadPlay returns streak, thisWeek, ledgerToday from logs), play/checkins.ts (addCheckIn, once per week), play/usePlay.ts (focus-refreshed hook); checkInDates and recordCheckIn in lib/adaptdb.ts (kv-store key play.checkins); recordCheckIn called from checkin.tsx done(). 4 tests.
Uncommitted changes and where they are preserved: none after commit
Validation performed and results: pnpm lint, typecheck, test pass (285 tests); npx expo export -p android ok
Artifacts, preview, and PR links: PR in review packet
Failures and attempts already made: none
Open decisions/blockers: none
Next action: orchestrator review
Task state and reason: In review, PR open
Usage/cost, or unavailable: unavailable
