# v0.4 tasks: friends (planned, waiting for the v0.4 gate)

PRD: PRD-002

Covers PRD-002 AC-10, AC-11, AC-16 and the sharing part of AC-3 ([D-20](../../decisions/D-20.md)). Needs the v0.4 gate: approval of TP-004 sections 1–3 and 5–7, D-11 (hosting), D-12 (sign-in) and D-17 (video inputs). Contracts are written after that gate.

| ID | Task | Lane | Needs | Size | ACs | Done when | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AP1 | Multi-user server: accounts, userId on server rows, v0.1 migration, export and delete | App | — | L | AC-10 | Two users isolated; delete removes everything | Opus |
| AP2 | Hosting: Compose, HTTPS, backups, deploy script | App | AP1 | S | AC-10 | Friends reach it over HTTPS; restore tested | Sonnet |
| AP4 | Points ledger sync and server recompute | App | AP1 | S | AC-8 | Phone and server points match | Sonnet |
| AP5 | Social: invites, friendships, share settings, feed, kudos, leaderboard | App | AP1, AP4 | M | AC-3, AC-10, AC-11 | A non-friend sees nothing | Opus |
| AP7 | Notifications, quiet hours, opt-out | App | AP5 | S | AC-11 | Opt-out works | Sonnet |
| UI6 | Friends, leaderboard, kudos, share settings, friends' feed | UI | AP5 | M | AC-3, AC-10, AC-11 | Two users see only shared items | Sonnet |
| AI9 | Video understanding on permitted inputs | AI | — | M | AC-16 | A permitted video gives reviewed drafts | Sonnet |
| R3 | Device gate for v0.4 with two phones | Release | all above | S | AC-3, AC-10, AC-11, AC-16 | Azhar and a friend sign off | Opus |

## Waves (same wave can run in parallel; UI tasks run one at a time)

| Wave | Tasks |
| --- | --- |
| 1 | AP1, AI9 |
| 2 | AP2, AP4 |
| 3 | AP5 |
| 4 | AP7, UI6 |
| 5 | R3 |
