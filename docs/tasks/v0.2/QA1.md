# QA1: Maestro flows for the main journeys, screenshots for PRs
Project / milestone / feature: OpenPhysio / v0.2 / PRD-002
Lane: UI
Status: Ready
Approved scope reference: docs/tasks/v0.2/README.md, docs/tasks/EXECUTION.md
Approved product specification ID/version: PRD-002 0.2-draft, v0.2 slice (D-18)
Approved technical plan ID/version: TP-003 v1 section 7 (D-19)
Acceptance criteria covered: AC-1 (validation support; no product behaviour)
Repository and base branch/commit: azharmajeed/openphysio, base v0.1
Relevant files/context links: docs/tech/TP-003-ui.md section 7; docs/tasks/AGENT-BRIEF.md (emulator, dev client); docs/tasks/R0-emulator-findings.md (the journeys tested by hand in v0.1)
Dependencies and required completion state: UI0 merged

Expected result:
1. Install Maestro CLI (open source, Apache-2.0) from its official release on this Windows laptop (JDK 17 is installed); document the install and run commands in AGENT-BRIEF.
2. Flows in `apps/mobile/.maestro/`: (a) first launch → intake with a profile (goals, equipment, one knee injury) → Today; (b) Plan: generate the plan, open a day; (c) start today's session, log a set, open the pain check, finish; (d) Learn opens; (e) Coach opens and shows its offline/mock state; (f) Today in light and dark. Each flow ends with `takeScreenshot`.
3. Selectors use visible text or `testID`s; add `testID`s to existing components only where text is ambiguous (the only screen edits allowed).
4. `pnpm --filter @openphysio/mobile e2e` runs all flows against the running emulator + dev client and writes screenshots to `apps/mobile/.maestro/screenshots/` (gitignored). A short section in AGENT-BRIEF: UI task PRs attach these screenshots.
5. Flows must pass on the current v0.1 screens; UI2 tasks update them as screens change.

Allowed changes: apps/mobile/.maestro/**, apps/mobile/package.json (script), apps/mobile/.gitignore, testID props in apps/mobile/src/** (no other edits), docs/tasks/AGENT-BRIEF.md
Explicit exclusions: no CI integration (no emulator in CI); no screen changes beyond testIDs.
Setup and validation commands: pnpm lint; pnpm typecheck; pnpm test; pnpm --filter @openphysio/mobile e2e (all flows pass on the emulator)
Required evidence/artifacts: Maestro output and the screenshots list in the PR
Agent/runtime preference, if any: Claude Sonnet subagent, ponytail lite
Execution budget and retry limit: one implementation run + one repair after review
When to request a product or consequential technical decision: per EXECUTION.md escalation conditions
Completion condition: validated result + PR -> In review
Merge authority: orchestrator into v0.1 after review (D-9); Azhar for v0.1 -> main
