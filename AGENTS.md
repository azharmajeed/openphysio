# OpenPhysio — agent instructions

OpenPhysio is an open-source, self-hostable AI physio and training coach. v0.1 is an Android app (Expo / React Native, TypeScript) for one user (Azhar, Pixel 8a) plus a small self-hosted server.

## Read first

1. `docs/HANDOFF.md` — current state and next steps
2. `docs/brief.md` — project brief
3. `docs/prd/PRD-001.md` — product requirements with acceptance criteria (AC-n)
4. `docs/tech/TP-001.md` — technical plan
5. `docs/tasks/README.md` — task graph, dependencies, parallel lanes
6. `docs/templates/WORK-PIPELINES.md` and `WORK-TEMPLATES.md` — the delivery process and templates (from work-control)

## Delivery process (from work-control)

- Product scope (PRD) and technical plan (TP) each need Azhar's explicit, versioned approval, recorded in `docs/decisions/`. A missing answer is not approval.
- Tasks stay **Draft** until both approvals exist. Then a task contract (`docs/tasks/<ID>.md`, template in `docs/templates/WORK-TEMPLATES.md` section 4) moves it to **Ready**.
- Task states: Draft, Ready, Running, Blocked, In review, Done, Cancelled. An open PR is **In review**, never Done. Only Azhar merges.
- One task = one branch = one git worktree. One active claim per task.
- Save a checkpoint (template section 6) in the task file at handoff, blocking or completion.
- Use the review packet (template section 7) as the PR description.
- Batch product questions and consequential technical decisions into one decision request (template section 5); keep independent ready work moving.

## Hard rules

- Never add `Co-authored-by` or any co-author attribution to commits, PRs or messages.
- Never read `.env` files. Use `.env.example`.
- GPU pod runs (motion generation) and paid AI/API credits need Azhar's approval per batch.
- Injuries are always considered: any plan, exercise choice or coach answer must read the injury list first.
- Health claims need a source in the evidence registry (see TP-001, Evidence). Coaching conventions are labelled grade C.
- Never copy or re-host trainer content (YouTube, blogs). Embed or link only.
- Strava API data must not be fed into AI features (Strava terms). Data flows out to Strava only.
- Do not embed AGPL code from wger or ExerciseDB; import data only, respecting licences.

## Lanes (folders) for parallel work

| Lane | Folder |
| --- | --- |
| Foundation | repo root, `packages/core/src/types` |
| Mobile | `apps/mobile` |
| Core logic | `packages/core` |
| Server + AI | `apps/server` |
| Catalogue | `packages/catalog` |
| Integrations | `packages/integrations` |
| AI demos | `workers/motion` |

T02 (shared types) is the hub and must merge before lanes fan out. Start with 2 implementers in parallel plus review.

## Skills

Project skills live in `.claude/skills/` (copied from `work-control/skills`): requirements-to-ready-task, project-checkpoint, acceptance-and-pr-evidence, systematic-debugging, ponytail (use lite mode; approved scope and required tests win). The requirements-to-ready-task skill mentions `/pilot-documents/`; in this repo the templates are in `docs/templates/`.
