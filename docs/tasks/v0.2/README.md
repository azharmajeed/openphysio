# v0.2 tasks: look, learn, streaks

PRD: PRD-002

Approved 2026-11-18 ([D-18](../../decisions/D-18.md), [D-19](../../decisions/D-19.md), release split [D-20](../../decisions/D-20.md)). Covers PRD-002 AC-1 to AC-6 and AC-8. Camera and local AI are in [v0.3](../v0.3/README.md); friends are in [v0.4](../v0.4/README.md).

Plans: `docs/tech/TP-003-ui.md` (UI), `docs/tech/TP-002-data-ai.md` sections 1–4 (Knowledge), `docs/tech/TP-004-app.md` section 4 (App). Contracts are `docs/tasks/v0.2/<ID>.md`; F4 is a v0.1 bug fix (`docs/tasks/F4.md`) that v0.2 needs first.

Owner: **Sonnet** = a Sonnet implementer subagent (ponytail lite); **Opus** = the orchestrator takes it (larger, riskier or safety-sensitive work). Every PR is reviewed by the orchestrator and waits for CI before merge.

| ID | Task | Lane | Needs | Size | ACs | Done when | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UI0 | Dev build with Reanimated, Gesture Handler and Worklets (Windows, else WSL, D-22), kit spike on Today, D-16 note | UI | — | M | AC-1 | Dev client runs on the emulator; Today renders in both themes in the kit; D-16 written | Opus |
| UI1a | Tokens package: `tokens.json`, generator (`tokens.ts`, `global.css`), drift and contrast tests | UI | UI0 | S | AC-1 | Generated files match; token pairs pass contrast | Sonnet |
| UI1b | Base components on the kit, dev-only gallery screen | UI | UI1a | M | AC-1 | Gallery shows every base component in both themes | Sonnet |
| UI1c | Lint rule: no raw colours or font sizes in screens (legacy allowlist that only shrinks) | UI | UI1a | S | AC-1 | Lint fails on a raw colour in a migrated screen | Sonnet |
| QA1 | Maestro flows for the main journeys, screenshots in PRs | UI | UI0 | S | AC-1 | Flows pass on the emulator; screenshots attached | Sonnet |
| UI2a | Today: load gauge, session card, streak and points, week strip | UI | UI1b, AP3b, F4 | M | AC-1, AC-2 | No scrolling on a Pixel 8a screen size; screenshots approved | Sonnet |
| UI2b | Plan: compact week strip, day detail, collapsible "Not everything fit" | UI | UI1b, F4 | S | AC-1 | Screenshots approved | Sonnet |
| UI2c | Session player: one exercise per screen, rest ring, pain check as a sheet | UI | UI1b | M | AC-1 | Pain flow unchanged in tests; screenshots approved | Opus |
| UI3 | Activity cards and history (You), route map for runs | UI | UI1b | M | AC-3 | Runs show maps; cards match the spec | Sonnet |
| UI4a | "Why and how" sheet: body map, muscle roles, cues, faults, citations, review level | UI | UI1b, K3a, K3b, K3c, K3d | M | AC-5 | Sheet shows reviewed data for any planned exercise | Sonnet |
| UI4b | Learn restyle, save videos, segment player | UI | UI1b, K5 | S | AC-4, AC-5 | Saved videos persist; segments start at their time | Sonnet |
| K1 | Knowledge package: schemas, review states (D-21), reference tests, reviewed-only export | Knowledge | — | M | AC-6 | Schema and reference tests pass; export drops drafts | Sonnet |
| K6a | Review page generator and bulk review update | Knowledge | K1 | S | AC-6 | Azhar can review a region from one HTML page | Sonnet |
| K2a | Muscle atlas: hip and lower limb | Knowledge | K1 | M | AC-5, AC-6 | Every lower-body body-map area has drafted muscles with sources | Sonnet |
| K2b | Muscle atlas: trunk, upper limb, neck and shoulder | Knowledge | K1 | M | AC-5, AC-6 | Every upper-body body-map area has drafted muscles with sources | Sonnet |
| K3a | Exercise ↔ muscle links for all catalogue exercises | Knowledge | K2a, K2b | M | AC-5, AC-6 | 100% of exercises have ≥ 1 primary link | Sonnet |
| K3b | Cues and faults: top lower-body exercises (10) | Knowledge | K1 | S | AC-5, AC-6 | 10 exercises with 2–4 cues and faults, sourced | Sonnet |
| K3c | Cues and faults: top upper-body exercises (10) | Knowledge | K1 | S | AC-5, AC-6 | as K3b | Sonnet |
| K3d | Cues and faults: top trunk, rehab and conditioning exercises (10) | Knowledge | K1 | S | AC-5, AC-6 | as K3b | Sonnet |
| K5 | Video segments: candidate segments from followed channels for the top 30 (Azhar picks timestamps) | Knowledge | K1 | S | AC-5 | Segment drafts ready for review | Sonnet |
| AP3a | Points and streak engine in core, rules in data, farming tests | App | — | M | AC-8 | Over-plan volume and post-pain-stop sessions earn nothing; rest days never break a streak | Sonnet |
| AP3b | Local points ledger table and migration, hooked to finish, check-in and pain | App | AP3a | S | AC-8 | Points appear after a logged session, offline | Sonnet |
| R1 | Device gate: APK on Azhar's phone, checklist, findings | Release | all above | S | AC-1 to AC-6, AC-8 | Azhar signs off or findings become F-tasks | Opus |

Top-30 exercises (K3b–K5): the 30 exercises the plan engine places most often across the goal profiles in `packages/core` tests; K1 adds the script that lists them.

## Waves (same wave can run in parallel; UI tasks run one at a time)

| Wave | Tasks |
| --- | --- |
| 1 | F4, UI0, K1, AP3a |
| 2 | UI1a, K6a, K2a, K2b, K3b, AP3b |
| 3 | UI1b, K3c, K3d, K5 |
| 4 | UI1c, QA1, K3a |
| 5 | UI2a, UI2b, UI2c |
| 6 | UI3, UI4a, UI4b |
| 7 | R1 |
