# UI1a: Tokens package: tokens.json, generator, drift and contrast tests
Project / milestone / feature: OpenPhysio / v0.2 / PRD-002
Lane: UI
Status: Done
Approved scope reference: docs/tasks/v0.2/README.md, docs/tasks/EXECUTION.md
Approved product specification ID/version: PRD-002 0.2-draft, v0.2 slice (D-18)
Approved technical plan ID/version: TP-003 v1 section 3 (D-19); kit D-16
Acceptance criteria covered: AC-1
Repository and base branch/commit: azharmajeed/openphysio, base v0.1
Relevant files/context links: docs/tech/TP-003-ui.md sections 2–3; docs/decisions/D-16.md; apps/mobile/global.css (UI0's hand-written theme: the starting values); apps/mobile/src/lib/plan.ts (PALETTE / typeColors: session-type colours handed out in order, the F1 rule); apps/mobile/src/app/_layout.tsx (useNavTheme reads CSS variables)
Dependencies and required completion state: UI0 merged

Expected result:
1. New package `packages/ui-tokens` (`@openphysio/ui-tokens`, TS source export): `tokens.json` is the single source of truth: semantic colours for light and dark (the variables in UI0's global.css, incl. good/watch/stop), a session-type palette (ordered list, light and dark), spacing (4 pt base), type scale, radii, motion durations.
2. Generator script (`pnpm --filter @openphysio/ui-tokens gen`) writes `apps/mobile/global.css` (same structure as UI0's: `@theme` + light/dark `@variant` blocks) and `packages/ui-tokens/src/tokens.ts` (typed values for SVG, charts and anything that can't take a class). Generated files are committed with a "generated, do not edit" header.
3. Drift test: running the generator in memory equals the committed files.
4. Contrast test: every foreground/background pair the theme uses (foreground on background, card-foreground on card, primary-foreground on primary, muted-foreground on background and card, good/watch/stop on background) meets WCAG AA 4.5:1 for text in both modes (OKLCH → sRGB conversion in the test; no new runtime dependency). Fix token values that fail and list them in the PR.
5. `apps/mobile/src/lib/plan.ts`: the session-type palette comes from tokens (still handed out in order of first appearance, per F1), for the active theme.
6. Visual result unchanged except contrast fixes; screenshot Today light/dark on the emulator through the dev client (see AGENT-BRIEF) and attach before/after.

Allowed changes: packages/ui-tokens/**, apps/mobile/global.css (generated), apps/mobile/src/lib/plan.ts (palette source only), apps/mobile/package.json (dependency), pnpm-lock.yaml, docs/evidence/UI1a/**
Explicit exclusions: no new components (UI1b), no lint rule (UI1c), no screen changes.
Setup and validation commands: pnpm lint; pnpm typecheck; pnpm test; pnpm --filter @openphysio/ui-tokens gen (no diff after); npx expo export -p android
Required evidence/artifacts: contrast table (pair, ratio, light/dark); Today screenshots
Agent/runtime preference, if any: Claude Sonnet subagent, ponytail lite
Execution budget and retry limit: one implementation run + one repair after review
When to request a product or consequential technical decision: per EXECUTION.md escalation conditions
Completion condition: validated result + PR -> In review
Merge authority: orchestrator into v0.1 after review (D-9); Azhar for v0.1 -> main

## Checkpoint (UI1a implementation)
Done: packages/ui-tokens (tokens.json, src/gen.ts + scripts/gen.ts, generated tokens.ts and apps/mobile/global.css, color.ts OKLCH maths, drift and contrast tests). plan.ts takes the session-type palette from tokens for the active theme (Uniwind.currentTheme, read lazily; dark in unit tests). Contrast fixes: light good and watch (see docs/evidence/UI1a/contrast.md). pnpm lint, typecheck, test, gen (no diff) and expo export pass. Open: Today before/after emulator screenshots were not taken because the shared adb server hung; session-type colours changed from the old hex list to the token palette (new hues per mode).

# UI1a / orchestrator merge note
Merged without emulator screenshots: the shared adb server hung during the run. Visual change is limited to two light-mode state colours (good, watch) and the session-type palette; screenshots are captured in UI1b.
