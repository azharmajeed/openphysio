# PRD-001 verification record

The approved PRD text does not change. This file records how far each acceptance criterion has been checked, so the status page can show it.

Status values:
- **Not checked:** the code may be built, but nobody has checked it.
- **Partly verified:** some of the criterion was checked; the note says what.
- **Verified (emulator):** checked on the emulator.
- **Verified (device):** checked on Azhar's phone.
- **Accepted:** Azhar signs it off after R1 dogfooding.

Whether the code is built comes from the task contracts. This file only records checks.

| AC | Status | Where | Date | Evidence | Note |
| --- | --- | --- | --- | --- | --- |
| AC-1 | Verified (emulator) | emulator | 2026-11-14 | docs/tasks/R0-emulator-findings.md | Intake, injuries, offline save |
| AC-2 | Verified (emulator) | emulator | 2026-11-14 | docs/tasks/R0-emulator-findings.md | Knee injury filters runs and plyos. The coach part is not checked. |
| AC-3 | Partly verified | emulator | 2026-11-14 | docs/tasks/R0-emulator-findings.md | The 4-week calendar shows. Two gym sessions on one day and two sessions on most days are open (R1 finding). |
| AC-4 | Not checked | | | | Unit tests only |
| AC-5 | Partly verified | emulator | 2026-11-13 | docs/tasks/R0-emulator-findings.md | Tap logging works. Voice logging is not checked. |
| AC-6 | Not checked | | | | GPS, Strava and file export |
| AC-7 | Not checked | | | | |
| AC-8 | Not checked | | | | Needs U1 (band paired) |
| AC-9 | Not checked | | | | |
| AC-10 | Not checked | | | | |
| AC-11 | Not checked | | | | Only the "Film it" flag; demo clips deferred (D-8) |
| AC-12 | Partly verified | emulator | 2026-11-13 | docs/tasks/R0-emulator-findings.md | The cards show. The trend adjustment is not checked. |
| AC-13 | Not checked | | | | |
| AC-14 | Partly verified | phone | 2026-11-14 | Azhar (chat) | Azhar reports the phone connects to the server |
