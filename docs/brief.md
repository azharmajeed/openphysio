# OpenPhysio — project brief

Owner: Azhar (azharmajeed)
Repository and default branch: `openphysio`, `main` (GitHub remote: to be created, private)
Last verified commit/date: initial planning commit, 2026-11-09
Purpose and intended users: an elite AI physio/training coach. v0.1 user: Azhar only. Later: anyone from teens starting a sport to older adults staying fit.
Current milestone: v0.1 dogfood — Azhar follows a generated plan on his Pixel 8a for 2 weeks (task R1).
Success measure: 2 weeks of sessions logged with the plan respecting injuries; progress visible on the five goals.
Priority relative to other projects: set by Azhar.
Constraints and explicit exclusions: open source, self-hostable, no paid video libraries, no video recording at the gym. Excluded from v0.1: other users, iOS, store release, live pose coaching, basketball video.
Existing architecture/instructions: `AGENTS.md`, `docs/tech/TP-001.md`.
Setup and validation references: defined by T01 (scaffold).
Environment and external dependencies: Pixel 8a (Android), Xiaomi Smart Band 10 Pro (China version) via Gadgetbridge + Health Connect, self-hosted server (Docker on laptop), AI provider key, optional Strava subscription, on-demand GPU pod for demo generation.
Delegation policy and action-specific restrictions: agents implement, test and open PRs within approved scope. Azhar owns product decisions, consequential technical choices, merges, GPU and paid API spend.
Related projects: `posture-lab` (pose + voice cues; desk posture), `video-tracker` (review desk, events model, GPU worker), `video-gen` (take review UI for generated demos), `work-control` (delivery process, Paperclip).
Open decisions: see `docs/decisions/README.md`.
