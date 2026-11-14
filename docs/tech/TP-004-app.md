# TP-004: Application-layer plan for PRD-002 (accounts, social, gamification, providers, sync)

Status: Draft, for Azhar's review (gate G2)
Version: 1-draft, 2026-11-14
Covers: PRD-002 AC-3 and AC-8 to AC-15 (logic and server). The screens are in TP-003, the models in TP-002.
Lane: **App** (AP tasks), plus F4 (a v0.1 bug fix)

## 1. Architecture change

v0.1 is one phone, one self-hosted server and one token. v0.2 adds friends:

```
Phone (local-first SQLite, on-device models)
  │  sync over HTTPS
  ▼
OpenPhysio server (same Hono codebase, now multi-user)
  ├─ personal data: profile, injuries, logs, scans  → visible only to the owner
  ├─ inference tiers: local-llm profile, BYO keys    (TP-002)
  └─ social module: friendships, shared projections, kudos, leaderboard
```

- **One codebase, two modes.** `MODE=single` keeps today's self-hosted single-user behaviour. `MODE=multi` adds accounts and the social module. Friends join Azhar's hosted instance (D-11).
- **Sharing is a projection, not access.** Friends never read personal tables. When an activity is shared, the server writes a small `shared_activity` row: type, duration, points, the route only if opted in, and the date. The leaderboard reads only the points ledger. Injuries, weight, heart rate, notes and scans have no path to any shared table. A test checks the column list of every social table.
- **HTTPS everywhere** for the hosted instance. This also removes the cleartext-HTTP problem in release builds. The laptop keeps working over the LAN in a debug build.

## 2. Hosting (D-11)

| Option | Cost | Notes |
| --- | --- | --- |
| **Small VPS** (e.g. Hetzner CX22) + Docker Compose + Caddy for HTTPS | ~€4–5/month | **Recommended.** Always on, same Compose file, nightly SQLite backups to object storage |
| Laptop + Cloudflare Tunnel | Free | Friends lose access whenever the laptop sleeps |
| Fly.io / Railway | ~$5+/month | Fine, but more platform lock-in |

The on-device-first design keeps the server small: no GPU, 2 GB RAM. The local-llm profile stays on the laptop or another home box, not the VPS.

## 3. Accounts and sign-in (D-12)
- **Library:** **Better Auth** (MIT, TypeScript, works with Hono and SQLite). It covers sessions, passkeys and OAuth, so we don't hand-roll auth. *Verify that it works with better-sqlite3 and Drizzle in AP1.*
- **Sign-in options** (recommended order):
  1. **Passkey** (no password; Android supports it natively)
  2. Google sign-in as a fallback
  3. Email one-time code only if needed (it needs an email sender, e.g. Resend's free tier)
- **Moving v0.1 over:** the existing single-user token becomes Azhar's account. Every synced table gets a `userId`, and the existing rows are assigned to him in one migration.
- **Data rights:** account delete (removes every row plus files) and export (a JSON and files zip). Both are needed before friends join.

## 4. Gamification engine (`packages/core/src/play`, rules in data) (AC-8, AC-9)

| Concept | Rule (data in `packages/catalog/play/*.json`) | Safety guard (code) |
| --- | --- | --- |
| Consistency points | Event → points table: planned session completed, rehab or mobility completed, sets logged, weekly check-in, pain check answered | No points for volume beyond the plan; no points for sessions after a pain stop; daily cap |
| Streak | Weekly: a week counts if ≥ X% of its planned sessions are done (X in data, default 80%). Planned rest days count as done. | An injury flare-up that pauses the plan freezes the streak instead of breaking it |
| Muscle levels | Weekly hard sets per muscle (from `buildHistory` + K3 exercise↔muscle links) → level bands from guideline data (e.g. 10+ sets/week, ACSM) | Injured areas are shown as protected, never as "low level" |
| Badges | Data-defined: `{event, count, window, conditions}` (first run, 4-week streak, 10 rehab sessions…) | No badges for maximum loads or distances |

- **Points ledger:** points are computed from logs as an append-only ledger. The phone computes them for instant feedback; the server recomputes from the synced logs and its value wins. That keeps the friends leaderboard fair.
- Pure functions with unit tests, including "can't farm points" tests: duplicate logs, edits after the fact, over-plan volume.

## 5. Social module (AC-3, AC-10, AC-11)
- **Friendships:** an invite link or 6-character code (expires in 7 days) → accept → mutual friendship. Remove or block at any time.
- **Share settings:**
  - defaults: points, streak and completed sessions on
  - routes off
  - can be overridden for each friend and each activity
- **Feed:** shared activities from friends, newest first, with kudos (one per person per activity).
- **Leaderboard:** weekly consistency points among friends. The week follows each user's own timezone, Monday–Sunday. It resets weekly, so nobody falls behind for good.
- **Notifications:** kudos received, friend requests, and a gentle streak reminder (maximum 1 a day, can be turned off). Delivery: Expo push (simplest; it goes through Expo's service) or self-hosted **ntfy** (open source) for a fully self-hosted path. Recommendation: Expo push for v0.2, ntfy as an option later.
- **API:**
  - `/api/friends` (invite, accept, list, remove)
  - `/api/feed`
  - `/api/kudos`
  - `/api/leaderboard`
  - `/api/share-settings`

  Every route is checked with tests that a non-friend sees nothing.

## 6. Providers and model manager (AC-14, AC-15)
- **Settings → AI:** per feature (coach, knowledge search, scan extraction, video summaries), choose **On phone / My server / My key**. The default is On phone, falling back to My server.
- **Keys:**
  - stored in SecureStore on the phone when used directly
  - stored encrypted on the server when the server makes the call
  - never synced to friends or logs
  - test call before saving
- **Consent:** before the first call through a provider key, a sheet shows what will be sent (e.g. "your question, your injuries, last 2 weeks of sets") and which provider receives it.
- **Fallback:** a failing key falls back to the local tier with a notice. It never silently drops safety checks.
- **Model manager:** reads `models.json` (TP-002 §9), shows size and status, downloads on Wi-Fi only, checks the hash, and deletes. It covers the knowledge-pack version too.

## 7. Sync changes
- Synced rows carry `userId`. The pull cursor is per user. The push validates ownership.
- New synced tables: `points_ledger`, `badge_award`, `share_setting`, `knowledge_pack_version`.
- Server-only tables: `friendship`, `invite`, `shared_activity`, `kudos`.
- Conflicts: the existing last-write-wins on `updatedAt` stays. The ledger is append-only, so it has no conflicts.

## 8. Plan engine fix (F4, from Azhar's screenshot, 2026-11-14)
- **Bug:** two gym sessions on one Saturday. F3's rule ("same type never shares a day") isn't holding for gym, or stand-ins are mapped to "gym" after the check.
- **Load:** two sessions on almost every day while injured is too much. Add `PLAN_CONFIG.maxSessionsPerDay` (default 1, or 2 only when one is mobility or rehab) and a weekly session cap from goal data. Reduce the load when an injury is active (a data-driven factor).
- Reproduce with the R0 knee profile first, then fix with tests. **Do this before any v0.2 work.**

## 9. Tasks (lane: App)

| ID | Task | Needs | Size | ACs | Done when |
| --- | --- | --- | --- | --- | --- |
| F4 | Plan engine: same-type fix, max sessions per day, injury load reduction | — | S | PRD-001/AC-3, PRD-001/AC-2 | R0 knee profile: ≤ 1 hard session a day, no duplicates |
| AP1 | Multi-user server: Better Auth (passkey + Google), userId on rows, v0.1 migration, export and delete | — | L | AC-10 | Two users isolated; delete removes everything |
| AP2 | Hosting: VPS Compose + Caddy HTTPS + backups + deploy script (after D-11) | AP1 | S | AC-10 | Friends reach it over HTTPS; restore tested |
| AP3 | Gamification engine + rule data (points, streaks, levels, badges) | K3 for levels | M | AC-8, AC-9 | Farming tests pass; levels follow sets |
| AP4 | Points ledger sync + server recompute | AP1, AP3 | S | AC-8 | Phone and server points match |
| AP5 | Social module: invites, friendships, share settings, feed, kudos, leaderboard | AP1, AP4 | M | AC-3, AC-10, AC-11 | Non-friend sees nothing; leaderboard is weekly |
| AP6 | Provider settings, consent sheet, key storage, model manager | AI6 | M | AC-14, AC-15 | Per-feature routing + fallback work |
| AP7 | Notifications (Expo push), quiet hours, opt-out | AP5 | S | AC-11 | Kudos and reminder arrive; opt-out works |

## 10. Decisions this plan needs
- **D-11:** hosting (recommended: a VPS at ~€5/month).
- **D-12:** sign-in (recommended: passkey + Google).
- **Push:** Expo push for now (it goes through Expo's servers), or self-hosted ntfy.
