# Decisions

One file per decision (`D-<n>.md`, template: `docs/templates/WORK-TEMPLATES.md` section 5). All decided 2026-11-09:

| ID | Question | Recommendation | Alternatives | State |
| --- | --- | --- | --- | --- |
| D-1 | Approve PRD-001 v0.1? | Approve after review | Revise | Decided ([D-1](D-1.md)) |
| D-2 | Approve TP-001 v1? | Approve after review | Revise | Decided ([D-2](D-2.md)) |
| D-3 | Name | OpenPhysio ("Open Physio" is also a Physiopedia article project; check trademarks before public launch) | OpenAthlete, Kinetiq, Movewell | Decided ([D-3](D-3.md)) |
| D-4 | Licence | AGPL-3.0 + contributor licence agreement | Apache-2.0 | Decided ([D-4](D-4.md)) |
| D-5 | Strava | File export now; API upload if you take a Strava subscription | API only | Decided ([D-5](D-5.md)) |
| D-6 | AI provider | One hosted key (e.g. Claude) behind the server adapter | Local model | Decided ([D-6](D-6.md)) |
| D-7 | Server host | Laptop in Docker for v0.1 | Home mini PC, small VPS | Decided ([D-7](D-7.md)) |
| D-8 | Demo generation | HY-Motion + mannequin render; film yourself for gaps | Wan2.2-Animate for realistic hero clips | Decided ([D-8](D-8.md)): later, no GPU spend this milestone |
| D-9 | Merge flow | Integration branch v0.1 | Stop per merge, stacked PRs | Decided ([D-9](D-9.md)) |
| D-10 | Android build | Local SDK + Gradle | EAS cloud | Decided ([D-10](D-10.md)) |

## v0.2 (gate G2, 2026-11-18)

| ID | Question | Recommendation | Alternatives | State |
| --- | --- | --- | --- | --- |
| D-11 | Hosting for friends | Small VPS | Laptop + tunnel, Fly.io | Deferred to the v0.4 gate |
| D-12 | Friend sign-in | Passkey + Google (orchestrator now suggests invite code + device token first) | Email code | Deferred to the v0.4 gate |
| D-13 | Camera at the gym | Opt-in only | — | Deferred to the v0.3 gate |
| D-14 | Monthly GPU and paid API cap | — | — | Deferred to the v0.3 gate |
| D-15 | Phone model download budget | ~3 GB | — | Deferred to the v0.3 gate |
| D-16 | UI kit | Reusables on Uniwind | HeroUI Native | Decided by the UI0 spike |
| D-17 | Video pipeline inputs | Own, CC and permitted videos | — | Deferred to the v0.4 gate |
| D-18 | Approve PRD-002 for v0.2? | Approve the v0.2 slice | Everything; edits | Decided ([D-18](D-18.md)) |
| D-19 | Approve TP-002/3/4 for v0.2? | Approve the v0.2 slice | Everything; edits | Decided ([D-19](D-19.md)) |
| D-20 | Release split | 3 releases | 2; one | Decided ([D-20](D-20.md)) |
| D-21 | Knowledge reviewer | Azhar, two levels | Plus a physio; one level | Decided ([D-21](D-21.md)) |
| D-22 | Build path for native UI libraries | Windows, then WSL, then GitHub Actions | — | Decided ([D-22](D-22.md)) |

Decided so far (2026-11-09): Android first on Pixel 8a; single user (Azhar); open source and self-hostable with a possible paid hosted layer later; no paid video subscriptions; injuries always considered; scans of both medical reports and old workout logs; expand to running and swimming; private GitHub repo.
