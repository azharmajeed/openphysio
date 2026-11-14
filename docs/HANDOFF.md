# Handoff — OpenPhysio (2026-11-09)

## Current state (orchestrator checkpoint, 2026-11-14)

### Where things stand
- **Branch:** `v0.1` @ `95e62e3`, clean, no open PRs. 36 task PRs merged, 231 tests passing (lint, typecheck and test are green in CI). `main` has not been updated: Azhar merges `v0.1` → `main`.
- **Built:** every task in `docs/tasks/README.md` except the deferred C5 and V1–V4 (D-8). Plus the hard-coding fixes C3b and H1–H3, the A2M Coach tab, the R0 fixes F1–F3, and TR1, the status page.
- **v0.2 is planned, not built:** drafts are waiting for Azhar's review at gate G2 (see "v0.2 planning" below).
- **Process:** G1 passed (D-1, D-2), decisions D-3 to D-10 recorded. One branch, worktree (`C:\w\<ID>`) and PR per task into `v0.1`. The orchestrator reviews and squash-merges (D-9). Implementers are Sonnet subagents with ponytail lite, briefed with `docs/tasks/AGENT-BRIEF.md`. Conventions and the no-hard-coding rule ("code holds rules; data holds choices") are in `docs/tasks/EXECUTION.md`. Framework: stay on React Native (Azhar, 2026-11-09). Revisit KMP or Lynx only after the first round of testing.

### What happened this session (2026-11-09 → 11-14)
1. **Planning and approvals:** set up the repo and private GitHub remote; G1 approved PRD-001 v0.1 and TP-001 v1 as-is; defaults accepted for D-3 to D-8; D-9 (integration branch) and D-10 (local Android SDK build) recorded.
2. **Toolchain:** installed the Android SDK and JDK 17 (no-admin zip) locally. The Windows build lessons are below and in AGENT-BRIEF.
3. **Build waves:** T01, T02, M1–M7, S1–S4, A1–A3, A2M, C1–C4, N1, L1, I-tasks and so on, all via contracts in `docs/tasks/<ID>.md`. Notable repairs:
   - N1 double-counted calories.
   - C3's first week was too aggressive.
   - C3b was rewritten as goal-data-driven (demands, priority, alternatives, warnings).
4. **No-hard-coding sweep** (Azhar's rule, 2026-11-09):
   - H1 moved channels, red flags and the scan timezone into data and tables.
   - H2 made nutrition come from goal data.
   - H3 made one `buildHistory` in core, shared by phone and server.
5. **Device testing:** the developer options on Azhar's Pixel are blocked (likely company MDM or Duo), so testing moved to sideloading plus an emulator.
   - Set up the AVD `openphysio_pixel` (Pixel 8a, Android 36, x86_64, WHPX).
   - The arm64 APK can't run on the x86 emulator, so the emulator uses a separate x86_64 build.
6. **R0 emulator pass:** found 6 bugs (3 of them safety) and 5 polish items (`docs/tasks/R0-emulator-findings.md`).
   - Fixed by F1 (#35, injury form and UI), F2 (#34, catalogue `avoidIf` plus a data test) and F3 (#33, rest days, one same-type session a day, visible stand-ins and warnings).
   - The re-test on the emulator confirmed every item fixed.
7. **APK v0.1.1 sent to Azhar:** `C:\Users\rahza\Documents\work\openphysio-apk\openphysio-v0.1.1.apk` (arm64, 48.6 MB, includes F1–F3).

8. **Phone and server:** Azhar reports the phone connects to the server and has walked through the app on the emulator. His verdict: "a good start", but the UI is too basic and the buttons are too big.
   - His screenshot shows a v0.1 bug: two gym sessions on one Saturday, and two sessions on most days while injured. This becomes F4.
   - The emulator server test (Docker, sync, Coach, Learn, Scan) was never run step by step. If it's needed, use the mock provider and the server `http://10.0.2.2:8787`. Release builds may block cleartext `http://`.
9. **Traceability:**
   - `docs/prd/PRD-001-verification.md` records the check state of each AC.
   - TR1 (PR #36) added `pnpm status`, which writes `docs/status.html` (gitignored). The page shows lanes, waves, PRD → AC → task traceability and gaps.
   - Status tracking: task contracts move to `Status: Done` on merge (the merge script does it); ACs are verified through the verification file.
10. **v0.2 planning** (Azhar, 2026-11-14) is in the next section.

### v0.2 planning (drafts committed in 95e62e3, waiting for G2)
**Azhar's direction:**
- UI like Strava and Whoop, built on reused open-source components.
- The Learn feed shows YouTube; Instagram is set aside for later.
- A gamified experience: consistency points.
- A science panel per exercise, with the muscles worked and a video (Squat University style).
- A large, evidence-graded knowledge base, collected in parallel.
- Camera rep counting and form cues, sparing and not intrusive.
- Friends-only social.
- A hosted multi-user server: yes.
- **All inference local by default.** Users can add their own API keys or provider logins.
- Spend on RunPod and APIs is allowed in principle; the cap is not set yet (D-14).
- An LLM pipeline that understands YouTube videos: lower priority, can run in parallel.
- Keep the current docs-in-git process, plus the status page.

**Documents:**
- `docs/prd/PRD-002.md`: 16 ACs, with exclusions and edge cases.
- `docs/tech/TP-002-data-ai.md`: knowledge schema, what to collect (sources and licences), a parallel harvest → extract → verify → review → publish pipeline, retrieval, coach tiers, pose and rep counting, the video pipeline, deployment and evaluation gates.
- `docs/tech/TP-003-ui.md`: design language, tokens, component inventory, screens, Maestro screenshot checks.
- `docs/tech/TP-004-app.md`: multi-user server, Better Auth, hosting, gamification engine, social module, providers and model manager, sync, F4.
- `docs/tasks/v0.2/README.md`: 33 tasks in the lanes UI, Knowledge, AI and App, with waves. No contracts yet.

**Research conclusions (2026-11-14), recorded in the plans:**
- **UI:** React Native Reusables on Uniwind (runner-up: HeroUI Native), react-native-body-highlighter, MapLibre, victory-native-xl (licence to confirm), lucide icons, Lottie. Switch to an Expo dev build.
- **Embeddings:** EmbeddingGemma 2 (Apache 2.0, October 2026), 256-dim vectors, stored with expo-sqlite's sqlite-vec plus FTS5. Fallback: Qwen3-Embedding-0.6B.
- **Coach:** Gemma 4 E2B via llama.rn on the phone; Ollama on the server (optional Compose profile); Vercel AI SDK 6 for own keys. OpenRouter PKCE is allowed, and so is OpenAI "Sign in with ChatGPT" (open-source apps). **Claude and Gemini subscription logins are not allowed** by their providers: API keys only.
- **Pose:** MediaPipe Pose Landmarker with Vision Camera v5 and our own Nitro plugin. No YOLO-pose (AGPL). v1 counts reps with a joint-angle state machine. A learned model only if the evaluation fails; public datasets have unclear licences, so we collect our own with consent.
- **Video:** YouTube's terms forbid downloading and scraping. Only own, Creative Commons or permitted videos, or the user's own Gemini key with a link. Qwen3-VL-8B runs batches on RunPod.

**Open decisions for G2:**
- D-11, hosting (a VPS is recommended).
- D-12, sign-in (passkey and Google).
- D-13, camera at the gym (opt-in).
- D-14, spend cap.
- D-15, phone download budget (about 3 GB).
- D-16, UI kit (after the UI0 spike).
- D-17, video pipeline inputs.
- Who reviews knowledge entries besides Azhar.

**Next, after G2:**
1. Record approvals as D-11 and onward, and set the documents' Status lines.
2. Write contracts in `docs/tasks/v0.2/<ID>.md` with the `contracts.py` pattern (it was in the old session's scratchpad, so recreate it if missing). Add a `Lane:` field.
3. Run wave 1: F4 first; then UI0, K1, AI1, AI2, AI6 and AP1 in parallel. UI tasks run one at a time. Knowledge tasks run in parallel by body region.

### Not yet verified on any device
GPS run (it can be simulated on the emulator), voice logging, Health Connect, sync, Coach, Learn, Scan (two legacy native modules), GPX/TCX export, and the weekly check-in.

### Known follow-ups
- Swims need a stroke column (the stroke is stored in notes for now).
- GPS jitter needs tuning after a real run.
- Scan cards are read-only (no edit-on-approve).
- Band heart rate isn't attached to runs.
- C5 and V1–V4 are deferred.
- A development build (dev client) would make UI iteration faster than release APKs (UI0 in v0.2).
- On the status page, the F, H and A2M tasks show under the "Other" lane: they aren't in the README table and have no `Lane:` field.

### Needs Azhar
- **G2:** review PRD-002 and TP-002 to TP-004, and answer D-11 to D-17.
- Install and use APK v0.1.1 on the Pixel.
- Pair the band with Gadgetbridge (U1).
- Approve spend before any real Claude API call. Everything uses the mock provider.
- Review and merge `v0.1` → `main`.

### How to build and run (Windows lessons, also in AGENT-BRIEF)
- **Environment:**
  - `JAVA_HOME=%LOCALAPPDATA%\Programs\jdk-17`
  - `ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk`
  - `JAVA_TOOL_OPTIONS=-Djava.net.preferIPv4Stack=true`
  - `node-linker=hoisted`
- **Paths and Gradle:** use a short worktree path (`C:\w\<ID>`). Run Gradle with `--no-daemon` (the laptop has 15 GB RAM). Call gradlew by its full path through `cmd /c "cd /d … && C:\…\gradlew.bat …"`.
- **Phone APK:** `pnpm --filter mobile android:apk` builds arm64-v8a.
- **Emulator APK:** build the same way with `-PreactNativeArchitectures=x86_64`. `C:\w\apk` is a detached worktree of `origin/v0.1` used for this.
- **Agent validation:** mobile agents check with `npx expo export -p android` instead of Gradle.
- **Emulator:**
  - Start with `emulator -avd openphysio_pixel`. The host is `10.0.2.2` from inside the emulator.
  - Stylus handwriting is off (`settings put secure stylus_handwriting_enabled 0`).
- **Merging:** always wait for CI before merging. A "workflow file issue" with no jobs is transient: `gh run rerun`.

### Leftover scratch folders, safe to delete
`C:\op`, `C:\b`, anything under `..\openphysio-wt\`, and finished `C:\w\<ID>` worktrees (check with `git worktree list` first).

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
