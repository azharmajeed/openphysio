# Handoff — OpenPhysio (2026-11-09)

## Current state (orchestrator checkpoint, 2026-11-10)

- **Process:** G1 passed (D-1, D-2), decisions D-3 to D-10 recorded. Every implementation task gets its own branch, worktree and PR into the integration branch `v0.1`. The orchestrator merges a PR after review (D-9), and Azhar merges `v0.1` into `main`. Implementers are Sonnet subagents with ponytail lite, briefed with `docs/tasks/AGENT-BRIEF.md`. Conventions and the no-hard-coding rule are in `docs/tasks/EXECUTION.md`. Framework decision: stay on React Native (Azhar, 2026-11-09).
- **Milestone v0.1-app is built (32 PRs in v0.1, 210 tests):** every task in `docs/tasks/README.md` except the deferred C5 and V1–V4 (D-8). Plus hard-coding fixes H1–H3, C3b, and the A2M Coach tab.
- **Not verified on a device:** nothing has run on a phone or emulator yet. The developer options on Azhar's Pixel appear blocked by a company device policy, so the plan is to sideload the APK (no developer options needed). Device checks in every task checkpoint say "not run".
- **First-test APK sent 2026-11-10:** setup, plan, Today, session player, logging. A combined APK with every feature is next.
- **Known follow-ups:** a stroke column for swims (currently stored in notes); GPS jitter tuning after a real run; scan cards are read-only (no edit-on-approve); band heart rate isn't attached to runs yet; the two scan modules are legacy (non-TurboModule) and need a device check.
- **Windows build lessons** (in AGENT-BRIEF): short worktree path `C:\w\<ID>`, JDK 17 at `%LOCALAPPDATA%\Programs\jdk-17`, `JAVA_TOOL_OPTIONS=-Djava.net.preferIPv4Stack=true`, `node-linker=hoisted`, arm64-v8a only, Gradle `--no-daemon`, call gradlew by full path.
- **Needs Azhar:** install and test the APK; pair the band with Gadgetbridge (U1); approve spend before any real Claude API calls (everything uses the mock provider); review and merge `v0.1` into `main`.
- **Leftover scratch folders, safe to delete:** `C:\op`, `C:\b`, and anything under `..\openphysio-wt\`.

## Original handoff (planning session)

Planning happened in a Claude (Cowork) session. This repo holds everything needed to continue in Claude Code.

## Living docs (diagrams, comments)
- Product plan: https://claude.ai/artifact/P4HHsbmc7kHbwoM9TP52oS (broad vision: AI coach, catalogue, evidence base, ages 13–80+, demo videos)
- Technical plan: https://claude.ai/artifact/V5xvMu14HDF2xtRuWDPYyY (v0.1 for Azhar: architecture, data in, AI demos, nutrition, workflow, task graph, tracker)
- Repo copies: `docs/prd/PRD-001.md`, `docs/tech/TP-001.md`, `docs/tasks/README.md`. Where the product plan and TP-001 differ, TP-001 wins for v0.1 (e.g. no paid MuscleWiki videos; AI-generated demos instead).

## Decisions Azhar already made
- Start with his Pixel 8a (Android) and himself as the only user.
- Open source and self-hostable; maybe a paid hosted layer later. Working name OpenPhysio.
- Previous injuries must always be considered.
- Scans: both medical/injury reports and old paper workout logs.
- Sports: add running and swimming (basketball later).
- Goals: run faster and longer; swim more; jump higher; strengthen back (long sitting) and get fitter; gain healthy weight.
- Equipment: home (bodyweight, resistance bands, a few dumbbells) and gym. No video recording at the gym; the app must still collect data (tap/voice logging, band data).
- No paid video subscriptions; generate demos with AI. Follow trainers like Knees Over Toes in the Learn tab.
- Band: Xiaomi Smart Band 10 Pro, China version (can't connect Strava). Wants band data downloaded and synced to OpenPhysio and Strava. Plan: Gadgetbridge → Health Connect → OpenPhysio → Strava.
- Private GitHub repo.
- Reuse the work-control delivery process (two approval gates, task contracts, checkpoints, review packets).

## Open decisions (batch them in one request)
`docs/decisions/README.md`: D-1/D-2 approvals (G1), D-3 name, D-4 licence, D-5 Strava path, D-6 AI provider, D-7 server host, D-8 demo generation licence check. Also still needed: his injuries (or scans), height and weight, pool days.

## First session in Claude Code, in order
1. **GitHub:** create the private remote and push (the planning session had no GitHub login):
   `gh repo create azharmajeed/openphysio --private --source . --remote origin --push`
2. **G1:** walk Azhar through PRD-001 and TP-001, apply his edits, record approvals as `docs/decisions/D-1.md` and `D-2.md` with the approved version, and set both docs' Status to Approved.
3. **Task contracts:** with the requirements-to-ready-task skill, write `docs/tasks/T01.md`, `T02.md`, `M1.md`, `S1.md` (waves 1–2) from the template; mark Ready.
4. **T01:** implement on branch `feat/t01-scaffold` in a worktree, open a PR with the review packet, stop for Azhar's merge.
5. **Wave 2:** T02 first (shared types hub), with M1 and S1 in parallel worktrees. Max 2 implementers plus review.
6. Meanwhile Azhar does **U1** (pair band with Gadgetbridge, enable Health Connect sync) and **U2** (Xiaomi export request, scans, injury list).

## Facts and gotchas
- Gadgetbridge lists Band 10 Pro as "mostly supported", experimental. Needs an auth key from Mi Fitness logs or Xiaomi Cloud Tokens Extractor; unpairing or hard reset invalidates it. Swim parsing unconfirmed.
- Strava API now requires a Strava subscription; Strava terms forbid using API data in AI features. Free fallback: export GPX/FIT and upload on strava.com.
- HY-Motion 1.0 community licence excludes EU, UK and South Korea; confirm generated clips can be distributed in an open-source app before relying on it.
- No local GPU. GPU runs follow video-tracker's RunPod playbook (`../video-tracker/docs/runpod.md`) and need Azhar's approval per batch.
- Reusable code/patterns: `../posture-lab` (PoseBackend, threshold + dwell rules, FN/FP feedback, cached Piper voice cues), `../video-tracker` (review desk, events table, worker), `../video-gen` (take-review UI), `../work-control` (process, Paperclip; register OpenPhysio as a 4th project once the remote exists).
- Commit identity used for the initial commit: azharmajeed <azharmajeed1997@gmail.com>. No co-author trailers, ever.
