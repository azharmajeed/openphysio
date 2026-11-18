# v0.3 tasks: camera and local AI (planned, waiting for the v0.3 gate)

PRD: PRD-002

Covers PRD-002 AC-7, AC-9 and AC-12 to AC-15 ([D-20](../../decisions/D-20.md)). Needs the v0.3 gate: approval of the remaining TP-002 sections, D-13 (camera at the gym), D-14 (spend cap) and D-15 (download budget). Contracts are written after that gate.

| ID | Task | Lane | Needs | Size | ACs | Done when | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AI1 | Spike: Vision Camera v5 + MediaPipe Pose Nitro plugin, fps readout in the app | AI | — | M | AC-12 | ≥ 15 fps landmarks on the Pixel | Opus |
| AI2 | Form-rule schema, joint-angle maths, rep state machine in core (revives C5) | AI | — | M | AC-12, AC-13 | Unit tests on synthetic frames | Sonnet |
| AI3 | Dataset capture mode, labelling, pose evaluation harness | AI | AI1, AI2 | M | AC-12, AC-13 | Harness reports accuracy on recorded sets | Sonnet |
| AI4 | On-device counting and cues in the session | AI | AI1, AI2, AI3 | M | AC-12, AC-13 | Gates met for the 6 exercises | Opus |
| AI5 | EmbeddingGemma 2, SQLite search pack (FTS5 + sqlite-vec), retrieval evaluation | AI | — | M | AC-7, AC-14 | ≥ 85% top-5 offline | Opus |
| AI6 | AI SDK provider layer, OpenRouter PKCE, local-llm profile | AI | — | M | AC-14, AC-15 | One interface, all tiers | Sonnet |
| AI7 | Spike with go/no-go: on-device coach (Gemma 4 E2B, llama.rn) | AI | AI5, AI6 | M | AC-14 | Measured tokens/s and RAM; decision recorded | Opus |
| AI8 | Coach evaluation suite across tiers | AI | AI6 | S | AC-7, PRD-001/AC-10 | 100% safety items | Sonnet |
| AI10 | Learned rep counter (only if AI3 misses the gate) | AI | AI3 | L | AC-12 | Beats the rules in the harness | Opus |
| K4 | Guidelines and claims per goal and muscle group, graded | Knowledge | — | L | AC-6, AC-7 | Every goal and group has checked guidelines | Sonnet |
| K6b | Harvest → extract → verify scripts | Knowledge | — | M | AC-6 | One region runs end to end | Sonnet |
| AP3c | Muscle levels and data-defined badges | App | — | M | AC-9 | Levels follow logged sets; badges come from data | Sonnet |
| AP6 | Provider settings, consent sheet, key storage, model manager | App | AI6 | M | AC-14, AC-15 | Routing and fallback work | Sonnet |
| UI5 | Progress body map, levels, badges | UI | AP3c | M | AC-9 | Levels fill from sets | Sonnet |
| UI7 | Camera counting screen and overlay | UI | AI4 | M | AC-12, AC-13 | Counter and cues on screen | Sonnet |
| UI8 | Settings: providers, models | UI | AP6 | S | AC-14, AC-15 | Download and key flows work | Sonnet |
| R2 | Device gate for v0.3 | Release | all above | S | AC-7, AC-9, AC-12 to AC-15 | Azhar signs off | Opus |

## Waves (same wave can run in parallel; UI tasks run one at a time)

| Wave | Tasks |
| --- | --- |
| 1 | AI1, AI2, AI5, AI6, AP3c |
| 2 | AI3, AI8, K4, K6b, UI5 |
| 3 | AI4, AI7, AP6 |
| 4 | UI7, UI8, AI10 |
| 5 | R2 |
