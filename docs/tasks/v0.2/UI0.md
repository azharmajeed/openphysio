# UI0: Dev build with native UI libraries, kit spike on Today, D-16 note
Project / milestone / feature: OpenPhysio / v0.2 / PRD-002
Lane: UI
Status: Ready
Approved scope reference: docs/tasks/v0.2/README.md, docs/tasks/EXECUTION.md
Approved product specification ID/version: PRD-002 0.2-draft, v0.2 slice (D-18)
Approved technical plan ID/version: TP-003 v1 (D-19); build path D-22
Acceptance criteria covered: AC-1 (foundation)
Repository and base branch/commit: azharmajeed/openphysio, base v0.1
Relevant files/context links: docs/tech/TP-003-ui.md sections 1, 3, 8; docs/tasks/M1.md (why Reanimated, Gesture Handler and Worklets were excluded); apps/mobile/package.json (expo.autolinking.exclude); apps/mobile/plugins/short-cxx.js; apps/mobile/src/app/(tabs)/index.tsx
Dependencies and required completion state: none

Expected result:
1. Re-enable `react-native-reanimated`, `react-native-gesture-handler` and `react-native-worklets` and build a working Android app with them. Try Windows first (short worktree path, CMake/ninja long-path workarounds). If it can't build, set up the WSL Ubuntu build (JDK 17, Node 22, pnpm, Android SDK from official sources) per D-22 and document it in AGENT-BRIEF.md; GitHub Actions only if WSL fails too.
2. Expo development build (expo-dev-client) for the emulator (x86_64) so UI changes reload from Metro; release APK builds still work for the phone.
3. Spike: React Native Reusables on Uniwind (fallback NativeWind, then HeroUI Native). Port the Today screen with the kit, in light and dark. Confirm @gorhom/bottom-sheet (or the Expo Router sheet fallback) works on SDK 58.
4. Write `docs/decisions/D-16.md` with what was tried, what worked and the choice; ask Azhar only if the kit choice changes the plan.
5. Update the build lessons in docs/tasks/AGENT-BRIEF.md and docs/HANDOFF.md.

Allowed changes: apps/mobile/** (config, Today screen, kit setup), docs/tasks/AGENT-BRIEF.md, docs/HANDOFF.md, docs/decisions/D-16.md, pnpm-lock.yaml, .npmrc, .github/workflows/** (only for the Actions fallback)
Explicit exclusions: no other screens redesigned; no tokens package (UI1a); no logic changes.
Setup and validation commands: pnpm lint; pnpm typecheck; pnpm test; `npx expo export -p android`; dev client and release APK both build; Today screenshots in both themes from the emulator
Required evidence/artifacts: before/after screenshots of Today (light and dark); build commands that worked
Agent/runtime preference, if any: orchestrator (Opus)
Execution budget and retry limit: Windows attempt, then WSL; stop and report if both fail
When to request a product or consequential technical decision: per EXECUTION.md escalation conditions; any paid service; .wslconfig changes
Completion condition: validated result + PR -> In review
Merge authority: orchestrator into v0.1 after CI (D-9); Azhar for v0.1 -> main
