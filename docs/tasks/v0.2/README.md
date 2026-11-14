# v0.2 tasks (draft, waiting for gate G2)

PRD: PRD-002

Plans: `docs/tech/TP-002-data-ai.md` (Knowledge, AI), `docs/tech/TP-003-ui.md` (UI), `docs/tech/TP-004-app.md` (App). Contracts (`docs/tasks/v0.2/<ID>.md`) are written after G2 approves PRD-002 and the plans. Until then every task shows as Planned.

| ID | Task | Lane | Needs | Size | ACs | Done when |
| --- | --- | --- | --- | --- | --- | --- |
| F4 | Plan engine: same-type fix, max sessions per day, injury load reduction | App | — | S | PRD-001/AC-2, PRD-001/AC-3 | R0 knee profile: ≤ 1 hard session a day, no duplicates |
| UI0 | Dev build + kit spike (Reusables on Uniwind), D-16 note | UI | — | S | AC-1 | Today renders in both themes |
| UI1 | Tokens package, theme, lint rule, base components, gallery | UI | UI0 | M | AC-1 | Lint blocks raw colours |
| UI2 | Today, Plan, session player redesign | UI | UI1, F4 | M | AC-1, AC-2 | Screenshots approved |
| UI3 | Activity cards + Feed (You), route maps | UI | UI1 | M | AC-3 | Cards match spec |
| UI4 | Learn: channels, search, save, segments; Why-and-how sheet | UI | UI1, K2 | M | AC-4, AC-5 | Sheet shows body map, cues, sourced segment |
| UI5 | Progress body map, levels, badges, streak UI | UI | UI1, AP3 | M | AC-9 | Levels fill from sets |
| UI6 | Friends, leaderboard, kudos, share settings | UI | UI3, AP5 | M | AC-10, AC-11 | Two users see only shared items |
| UI7 | Camera counting screen + overlay | UI | UI1, AI4 | M | AC-12, AC-13 | Counter and cues on screen |
| UI8 | Settings: providers, models, sharing | UI | UI1, AP6 | S | AC-14, AC-15 | Download and key flows work |
| K1 | Knowledge schema, tests, review fields, pack export | Knowledge | — | M | AC-6 | Empty pack builds |
| K2 | Muscle atlas (~45 muscles) | Knowledge | K1 | M | AC-5, AC-6 | Muscles reviewed |
| K3 | Exercise ↔ muscle links, top-30 cues and faults | Knowledge | K1, K2 | L | AC-5, AC-6 | 100% links reviewed |
| K4 | Guidelines and claims per goal and muscle group | Knowledge | K1 | L | AC-6, AC-7 | Every goal covered |
| K5 | Curated video segments | Knowledge | K1, K2 | M | AC-5 | 3–5 per major group |
| K6 | Harvest → extract → verify pipeline + review page | Knowledge | K1 | M | AC-6 | One region end to end |
| AI1 | Vision Camera v5 + MediaPipe Pose spike | AI | — | M | AC-12 | ≥ 15 fps on Pixel |
| AI2 | Form-rule schema, angle maths, rep state machine (C5) | AI | — | M | AC-12, AC-13 | Unit tests pass |
| AI3 | Dataset capture, labelling, pose eval harness | AI | AI1, AI2 | M | AC-12, AC-13 | Harness reports accuracy |
| AI4 | On-device counting + cues in session | AI | AI1, AI2, AI3 | M | AC-12, AC-13 | Gates met, 6 exercises |
| AI5 | EmbeddingGemma 2 + hybrid search + retrieval eval | AI | K1 | M | AC-7, AC-14 | ≥ 85% top-5 offline |
| AI6 | AI SDK provider layer, OpenRouter PKCE, local-llm profile | AI | — | M | AC-14, AC-15 | One interface, all tiers |
| AI7 | On-device coach (Gemma 4 E2B, llama.rn) | AI | AI5, AI6 | M | AC-14 | Coach works offline |
| AI8 | Coach eval suite | AI | AI6 | S | AC-7, PRD-001/AC-10 | 100% safety items |
| AI9 | Video understanding on permitted inputs | AI | K1, K6 | M | AC-16 | Permitted video → reviewed drafts |
| AI10 | Learned rep counter (conditional) | AI | AI3 | L | AC-12 | Beats rules in harness |
| AP1 | Multi-user server, Better Auth, migration, export and delete | App | — | L | AC-10 | Users isolated |
| AP2 | VPS hosting, HTTPS, backups | App | AP1 | S | AC-10 | Friends reach it over HTTPS |
| AP3 | Gamification engine + rule data | App | K3 | M | AC-8, AC-9 | Farming tests pass |
| AP4 | Points ledger sync + server recompute | App | AP1, AP3 | S | AC-8 | Points match |
| AP5 | Social: invites, friends, share, feed, kudos, leaderboard | App | AP1, AP4 | M | AC-3, AC-10, AC-11 | Non-friend sees nothing |
| AP6 | Provider settings, consent, keys, model manager | App | AI6 | M | AC-14, AC-15 | Routing + fallback |
| AP7 | Notifications | App | AP5 | S | AC-11 | Opt-out works |

## Waves (same wave can run in parallel; UI tasks run one at a time)

| Wave | UI | Knowledge | AI | App |
| --- | --- | --- | --- | --- |
| 1 | UI0 | K1 | AI1, AI2, AI6 | F4, AP1 |
| 2 | UI1 | K2, K4, K6 | AI3, AI5, AI8 | AP2 |
| 3 | UI2, UI3 | K3, K5 | AI7, AI9 | AP3, AP6 |
| 4 | UI4, UI5, UI8 | — | AI4 | AP4 |
| 5 | UI6, UI7 | — | AI10 (if needed) | AP5, AP7 |
