# A2M: Coach tab: chat with the AI coach, with citations and an offline notice
Project / milestone / feature: OpenPhysio / v0.1-app / PRD-001
Status: Ready
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
