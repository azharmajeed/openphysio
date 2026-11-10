# A2M: Coach tab: chat with the AI coach, with citations and an offline notice
Project / milestone / feature: OpenPhysio / v0.1-app / PRD-001
Status: In review
Approved scope reference: docs/tasks/README.md, docs/tasks/EXECUTION.md
Approved product specification ID/version: PRD-001 v0.1 (D-1)
Approved technical plan ID/version: TP-001 v1 (D-2), decisions D-3 to D-10
Acceptance criteria covered: AC-10, AC-2 (phone side)
Repository and base branch/commit: azharmajeed/openphysio, base v0.1 after A2 (server) and M7
Relevant files/context links: docs/api.md (POST /api/coach/chat → {text, citations:[{id,title,url,grade}], redFlag}); A2 checkpoint in docs/tasks/A2.md; M7 sync module and Settings (server URL + token in expo-secure-store)
Dependencies and required completion state: A2 server and M7 merged
Expected result: Coach tab: message list plus input box. Sends the conversation to /api/coach/chat using the configured server URL and token. Shows the reply with tappable citation chips (title and grade; opens the URL in the browser). A red-flag reply is styled as a clear warning. Plain-language errors for not configured (link to Settings), server unreachable (offline notice) and AI not configured (503) — never a raw error. Keeps the last conversation locally so reopening the tab shows it. Before sending, the app runs a sync so the coach sees today's logs (reuse the M7 sync function; don't block the send if sync fails). Pure helpers (request building, error mapping, citation formatting) get unit tests.
Allowed changes: apps/mobile/src/app/(tabs)/coach.tsx, apps/mobile/src/coach/**, apps/mobile/src/lib/** (new files only), pnpm-lock.yaml
Explicit exclusions: no server changes; no new native modules (use Linking for URLs); no real Claude calls — the server runs the mock provider unless Azhar approves spend.
Setup and validation commands: pnpm lint; pnpm typecheck; pnpm test; npx expo export -p android in apps/mobile (no Gradle build: another agent is building)
Required evidence/artifacts: test output; export ok; device check 'not run' unless a phone is attached
Agent/runtime preference, if any: Claude Sonnet subagent, ponytail lite
Execution budget and retry limit: one implementation run + one repair after review
When to request a product or consequential technical decision: per EXECUTION.md escalation conditions
Completion condition: validated result + PR -> In review
Merge authority: orchestrator into v0.1 after review (D-9); Azhar for v0.1 -> main

## Checkpoint
# A2M / run 1
Agent/runtime/model, if reported: Claude Sonnet subagent, ponytail lite
Execution host and checkout: local Windows, C:\w\A2M
Base commit / current branch / latest commit: 97a1e7a / feat/a2m-coach-tab / see PR
Work completed: Coach tab (apps/mobile/src/coach: chat.ts pure helpers + tests, CoachScreen.tsx); citation chips open URL via Linking; red-flag warning style; plain-language errors (not configured with Settings link, offline, 503, bad token); last conversation kept in expo-sqlite kv-store; syncNow() before send, failures ignored.
Uncommitted changes and where they are preserved: none
Validation performed and results: pnpm lint, typecheck, test pass (159 tests); expo export -p android ok (output deleted). Gradle build not run. Device check: not run.
Failures and attempts already made: none
Open decisions/blockers: sync/index.ts does not export its config reader, so the screen reads serverUrl/serverToken from SecureStore itself (4 lines, same keys). Uses expo-sqlite/kv-store (already-installed package, no new native module). syncNow ignores the 5 min throttle, so each send syncs.
Next action: review
