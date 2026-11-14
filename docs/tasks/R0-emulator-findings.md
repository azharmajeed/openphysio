# R0: first device pass on the emulator (2026-11-13)

Build: release APK from `v0.1` @ 2a4cb54, x86_64, on an Android 16 emulator (Pixel 8a profile). The phone APK is arm64-only and can't run on an x86 emulator: React Native's library loader doesn't use the emulator's arm64 translation. That's an emulator limit, not a bug.
Test data: profile "Tester", all five goals, all equipment, pool days Sun and Tue, an active left-knee injury.

## Works

- First launch goes to setup. Goal, equipment, sport and body-area options all come from data. The profile saves and the app opens on Today.
- Today: the band card ("No band data yet") and a link to generate the plan.
- Plan: a 4-week calendar is generated. The day view shows warm-up, main set, targets, cues and the "Film it" flags.
- Session player: steps through the session; reps start at the target; logging a set with RPE works; rest timer with −15/+15/Skip; Repeat and Undo last set.
- Pain check: sharp pain gives "Stop this session now and see a physio" with End session. The pain area is preselected from the exercise data.
- Log: history shows the session and its set.
- Progress: cards chosen by goals; the logged hard set appears under shoulders; weight and nutrition cards show.
- Learn without a server: a plain "needs your server" message with a Settings link.
- No crashes during the whole pass.

## Bugs, in fix order

1. **Safety: injury "avoid areas" doesn't follow the body area.** A new injury card takes the default avoid area, and changing the body area leaves avoid areas unchanged. A knee injury saved this way protects the neck. Fix: avoid areas follow the body area until the user edits them.
2. **Safety: catalogue gaps.** A-skip is only flagged for foot and Achilles, so with a knee injury the plyo sessions are all A-skips. Review the `avoidIf` flags on every plyo and running entry (skipping and landing load the knee).
3. **A new injury card preselects Neck** (the first body area). It should start with nothing selected and require a choice before saving.
4. **The plan ignores its own spacing:** two swims on the same day (week 1, Sunday).
5. **No rest day:** 2 sessions every day for 4 weeks, even with an active injury. Needs a weekly session cap or rest-day rule in the goal or profile data.
6. **Stand-ins aren't visible:** with the knee injury there are no runs, but no low-impact conditioning sessions appear and no warning says why. Check that `alternatives` apply and that warnings show on the Plan tab.

## UX polish

7. Tab icons are placeholder boxes.
8. The "Progress" header link crowds the screen title on every tab.
9. The pain check opens below the fold: scroll it into view.
10. "1 sets" should read "1 set".
11. "plyo" and "gym" share a colour (palette hash collision).

## Not covered in this pass

GPS run, voice logging, Health Connect, sync, Coach, Learn and Scan with a running server, GPX/TCX export, the weekly check-in. These need the Docker server running and test data; on the emulator, GPS can be simulated.

## Re-test after fixes (2026-11-14, v0.1 @ F1–F3 merged)

Same profile on the emulator. Confirmed on screen: a new injury starts with no body area; avoid areas follow the body area (Knee → Knee); the Plan tab shows a "Not everything fit" card listing each stand-in with its reason; Monday is a rest day every week; at most one swim a day, only on pool days; no runs or plyos with the knee injury (low-impact cardio and lower-body strength stand in); real tab icons; Progress and Settings are header icons; each session type has its own colour. Bugs 1–6 and polish 7–11 are fixed.
