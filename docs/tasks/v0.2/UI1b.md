# UI1b: Base components on the kit, dev-only gallery screen
Project / milestone / feature: OpenPhysio / v0.2 / PRD-002
Lane: UI
Status: Ready
Approved scope reference: docs/tasks/v0.2/README.md, docs/tasks/EXECUTION.md
Approved product specification ID/version: PRD-002 0.2-draft, v0.2 slice (D-18)
Approved technical plan ID/version: TP-003 v1 sections 2–4 (D-19); kit D-16
Acceptance criteria covered: AC-1
Repository and base branch/commit: azharmajeed/openphysio, base v0.1
Relevant files/context links: docs/tech/TP-003-ui.md sections 2–4 (design language, sizes, component inventory); docs/decisions/D-16.md; apps/mobile/src/components/ui (UI0's kit components); packages/ui-tokens (UI1a); the Reusables Uniwind registry source (github.com/founded-labs/react-native-reusables, packages/registry/src/uniwind); apps/mobile/src/app/(tabs)/index.tsx (UI0's Today, the usage pattern)
Dependencies and required completion state: UI1a merged

Expected result:
1. Kit components added from the Reusables Uniwind registry (copy the registry source, fix `@/registry/uniwind/` imports to `@/`): input, switch, tabs, dialog, separator, skeleton, avatar, toggle-group (segmented control). Add only their @rn-primitives dependencies.
2. Our components in `apps/mobile/src/components/` (not `ui/`), on the kit and theme classes only:
   - `StatTile`: one big number, small label, optional trend and state colour (good/watch/stop).
   - `Ring`: a progress ring/gauge (react-native-svg + Reanimated), value 0–1, label in the middle, state colour.
   - `WeekStrip`: 7 days, each with dots for planned/done sessions (session-type colours from tokens), today marked, tap a day.
   - `EmptyState` and `ErrorState`: icon, one line, optional action.
   - `IconButton`: 44 dp touch target around a smaller icon (TP-003 sizes).
   Button sizes follow TP-003: sm 32, md 40, lg 48 dp; touch targets ≥ 44 dp (use hitSlop where the visual is smaller).
3. Sheets: a reusable pattern on Expo Router `formSheet` (D-16), demonstrated by one gallery sheet route.
4. Dev-only gallery: `/gallery` route reachable from Settings only when `__DEV__`, showing every component in its states. Not linked in release builds.
5. Screenshots of the gallery in light and dark from the emulator (dev client, see AGENT-BRIEF), in docs/evidence/UI1b/.
6. Unit tests for any pure helpers (e.g. WeekStrip's day building); visual review by screenshot.

Allowed changes: apps/mobile/src/components/**, apps/mobile/src/app/gallery*.tsx and a gallery sheet route, apps/mobile/src/app/settings.tsx (dev-only link), apps/mobile/src/app/_layout.tsx (register routes only), apps/mobile/package.json, pnpm-lock.yaml, docs/evidence/UI1b/**
Explicit exclusions: no redesign of existing screens (UI2a–d); no lint rule (UI1c); no charts (later tasks pick a chart library after its licence check).
Setup and validation commands: pnpm lint; pnpm typecheck; pnpm test; npx expo export -p android; gallery screenshots
Required evidence/artifacts: gallery screenshots, light and dark
Agent/runtime preference, if any: Claude Sonnet subagent, ponytail lite
Execution budget and retry limit: one implementation run + one repair after review
When to request a product or consequential technical decision: per EXECUTION.md escalation conditions; any new native dependency (needs a dev-client rebuild: ask the orchestrator first)
Completion condition: validated result + PR -> In review
Merge authority: orchestrator into v0.1 after review (D-9); Azhar for v0.1 -> main
