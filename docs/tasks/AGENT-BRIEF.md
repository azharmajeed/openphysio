# Implementer brief (used by the orchestrator for every task)

You implement exactly one task of OpenPhysio. Repo: `C:\Users\rahza\Documents\work\openphysio` (GitHub `azharmajeed/openphysio`, private).

Read first: `AGENTS.md`, `docs/tasks/EXECUTION.md` (workflow and conventions — follow it exactly), your contract `docs/tasks/<ID>.md`, and the PRD/TP sections it links. Process skills: `.claude/skills/project-checkpoint`, `.claude/skills/acceptance-and-pr-evidence`; `.claude/skills/systematic-debugging` when something fails.

Setup:
- `git -C <repo> fetch origin`, then `git -C <repo> worktree add ..\openphysio-wt\<ID> -b feat/<id>-<slug> origin/v0.1`. Work only in `C:\Users\rahza\Documents\work\openphysio-wt\<ID>`. Never edit the main checkout, `v0.1` or `main` directly.
- pnpm: `pnpm` if on PATH, otherwise `npx -y pnpm@10.34.9`. Run `pnpm install` in the worktree.
- Mobile tasks (anything that builds the APK): put the worktree at the short path `C:\w\<ID>` instead of `..\openphysio-wt\<ID>`. The native build fails on Windows's 260-character path limit otherwise (lessons from M1). Build env: `JAVA_HOME=C:\Users\rahza\AppData\Local\Programs\jdk-17`, `ANDROID_HOME=C:\Users\rahza\AppData\Local\Android\Sdk`, `JAVA_TOOL_OPTIONS=-Djava.net.preferIPv4Stack=true`. Build only `arm64-v8a` (the Pixel 8a) to cut build time and APK size. Pass `--no-daemon` to Gradle so no Java process keeps ~3 GB of memory after the build. Call gradlew by its full path (`C:\w\<ID>\apps\mobile\android\gradlew.bat`), because this shell won't run programs from the current folder by bare name. adb is at `%ANDROID_HOME%\platform-tools\adb.exe`; if `adb devices` lists a device, install the APK and take screenshots with `adb exec-out screencap -p`.
- Native build (since UI0, D-16): run `expo prebuild` with `ANDROID_HOME` set, so `plugins/short-cxx.js` writes `cmake.dir` (CMake 3.31.6, whose ninja handles long paths) into `android/local.properties`. That is what lets Reanimated, Gesture Handler and Worklets build on Windows; keep the short `C:\w\<ID>` path anyway.
- UI work uses the dev client, not release APKs: build once with `gradlew assembleDebug -PreactNativeArchitectures=x86_64` (emulator), install it, then `npx expo start --dev-client` in `apps/mobile`, `adb reverse tcp:8081 tcp:8081`, and open `openphysio://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081`. Rebuild the dev client only when a native dependency changes. Screens use the kit in `apps/mobile/src/components/ui` (React Native Reusables on Uniwind) and theme classes from `apps/mobile/global.css`; switch themes on the emulator with `adb shell cmd uimode night yes|no`.

Rules:
- Only the contract's allowed changes. Anything consequential outside it: stop, checkpoint, report the question.
- No `Co-authored-by` or any AI attribution in commits, PR text or code comments. Use the configured git identity.
- Never read `.env` files. No paid API calls, no GPU runs; use mocks.
- Write files as UTF-8 without BOM, LF line endings. In PowerShell 5.1 avoid `Set-Content -Encoding utf8` (adds a BOM) — use the Write/Edit tools.
- Injuries are always considered; health rules cite an entry in `docs/research/sources.md` (add entries there if your contract needs new ones).

Finish:
1. Run the contract's validation commands; all must pass (`pnpm lint`, `pnpm typecheck`, `pnpm test` at minimum).
2. Set the contract's Status to `In review` and append a checkpoint (WORK-TEMPLATES section 6).
3. Commit, push, and open the PR: write the review packet (WORK-TEMPLATES section 7) to a file and run `gh pr create --base v0.1 --head <branch> --title "<ID>: <title>" --body-file <file>`. Confirm the body is non-empty with `gh pr view --json body`.
4. Wait for CI (`gh pr checks <n> --watch`, about 10 minutes max). Fix and push at most twice if it fails.
5. Do not merge.

Final report (terse): PR URL, CI result, validation command results, deviations from the contract, open questions.
