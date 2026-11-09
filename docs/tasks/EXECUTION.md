# PRD-001 / Execution handoff (milestone v0.1-app)

Approved PRD version and user approval: PRD-001 v0.1 — [D-1](../decisions/D-1.md)
Approved technical plan version and user approval: TP-001 v1 — [D-2](../decisions/D-2.md); decisions D-3 to D-10
Milestone and acceptance criteria: a working Android app on Azhar's Pixel 8a plus the Docker server. All tasks in `README.md` except V1–V4 (D-8). AC-1 to AC-14; AC-11 is met by the "film it" flag until clips exist.
Ready task IDs and dependency order: see `README.md` waves; a task is Ready only when its contract `docs/tasks/<ID>.md` exists with Status: Ready.
Budget/concurrency/retry policy: at most 3 implementers at once plus 1 reviewer; one retry after a failed review, then the task goes Blocked with a checkpoint.
Escalation conditions: anything outside the contract's allowed changes, any new consequential technical choice (data model compatibility, new external service, security model, cost), paid API calls, GPU runs.
Merge authority: task PRs → `v0.1` merged by the orchestrator after an independent review passes ([D-9](../decisions/D-9.md)); `v0.1` → `main` by Azhar only.

## Workflow for every task

1. Branch `feat/<id>-<slug>` from the latest `origin/v0.1`, in its own worktree `../openphysio-wt/<id>`.
2. Set the contract's Status to Running. Implement only the allowed changes.
3. Run the contract's validation commands; keep the output.
4. Append a checkpoint (WORK-TEMPLATES section 6) to the task file; set Status to In review.
5. Push and open a PR with base `v0.1`; the description is the review packet (WORK-TEMPLATES section 7).
6. A separate reviewer agent checks the diff against the contract; the orchestrator squash-merges into `v0.1` and sets Status to Done.

## Engineering conventions (all lanes)

- pnpm workspaces (`pnpm@10`), Node ≥ 22, TypeScript strict, ESM.
- Package scope `@openphysio/*`: `core`, `catalog`, `integrations` (packages), `mobile`, `server` (apps).
- Internal packages are consumed as TypeScript source (`"exports": { ".": "./src/index.ts" }`), no build step. Metro and tsx/Vitest read them directly.
- Tests: Vitest from the repo root (`pnpm test`). Lint: ESLint flat config + Prettier (`pnpm lint`). Types: `pnpm typecheck` (tsc --noEmit per package).
- Database: one Drizzle schema in `packages/core/src/db` (sqlite-core) shared by phone (expo-sqlite) and server. Every synced row has `id` (uuid text), `updatedAt` (ms), `deletedAt` (ms, nullable).
- Pure logic (safety rules, plan engine, nutrition, file writers) lives in packages and has unit tests; apps stay thin.
- No hard-coding for a specific user, goal, injury, body area, exercise id or weekday in logic (Azhar, 2026-11-09). Behaviour comes from data: the profile, the catalogue (exercise fields such as level, role, sessionTypes, avoidIf) and goal definitions. Code holds rules; data holds choices. Tests may use Azhar-like fixtures, but production code must never special-case them.
- Ponytail lite: build what the contract asks, no speculative abstractions; name lazier alternatives in one line.
- Hard rules from `AGENTS.md` apply: no co-author or AI attribution in commits/PRs, never read `.env`, no paid API calls or GPU runs (use the mock AI provider), injuries always read first, health rules cite `docs/research/sources.md`.
