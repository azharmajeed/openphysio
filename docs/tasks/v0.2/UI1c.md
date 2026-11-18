# UI1c: Lint rule: no raw colours or font sizes in screens
Project / milestone / feature: OpenPhysio / v0.2 / PRD-002
Lane: UI
Status: Ready
Approved scope reference: docs/tasks/v0.2/README.md, docs/tasks/EXECUTION.md
Approved product specification ID/version: PRD-002 0.2-draft, v0.2 slice (D-18)
Approved technical plan ID/version: TP-003 v1 section 3 (D-19)
Acceptance criteria covered: AC-1 ("a lint rule blocks raw colour values in screens")
Repository and base branch/commit: azharmajeed/openphysio, base v0.1
Relevant files/context links: eslint.config.js (flat config); docs/tech/TP-003-ui.md section 3; apps/mobile/src (screens and components); packages/ui-tokens (UI1a)
Dependencies and required completion state: UI1a merged

Expected result:
1. A local ESLint rule (in-repo, no new plugin dependency; `no-restricted-syntax` selectors are fine if they cover the cases) that reports, in `apps/mobile/src/**/*.tsx`:
   - string literals that are colours: `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb(`/`rgba(`/`hsl(`/`oklch(`;
   - numeric `fontSize`, `color`, `backgroundColor`, `borderColor` in style objects.
   Exempt: `apps/mobile/src/components/ui/**` (vendored kit), `packages/ui-tokens/**` (the source of values), test files.
2. A legacy allowlist: every file that violates today is listed in one array in eslint.config.js with a comment "shrinks to empty in UI2a–UI2d". A test or script fails if a listed file no longer has violations (so the list can only shrink, and stale entries are removed).
3. Proof: a fixture snippet with a raw colour in a non-allowlisted screen fails lint (a Vitest test that runs ESLint's API on a string, or a small fixture file excluded from the normal run).

Allowed changes: eslint.config.js, scripts/** (allowlist check), a test for the rule, package.json scripts if needed
Explicit exclusions: no screen edits (UI2a–d fix them).
Setup and validation commands: pnpm lint; pnpm typecheck; pnpm test
Required evidence/artifacts: the allowlist (file count) and the failing-fixture output in the PR
Agent/runtime preference, if any: Claude Sonnet subagent, ponytail lite
Execution budget and retry limit: one implementation run + one repair after review
When to request a product or consequential technical decision: per EXECUTION.md escalation conditions
Completion condition: validated result + PR -> In review
Merge authority: orchestrator into v0.1 after review (D-9); Azhar for v0.1 -> main
