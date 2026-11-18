# TP-003: UI plan for PRD-002 (design system and screens)

Status: Approved (D-19), 2026-11-18. D-16 is decided by the UI0 spike; build fallback is WSL, then GitHub Actions (D-22). Screens for later releases (Friends, Camera, Settings providers) are built in v0.3/v0.4.
Version: 1-draft, 2026-11-14
Covers: PRD-002 AC-1 to AC-5, AC-9 to AC-11 and AC-13 (screens), plus every v0.1 screen
Research: UI research, 2026-11-14 (the sources are in the appendix)
Current state: plain `StyleSheet` with no shared theme. Tabs are Today, Plan, Log, Learn and Coach, with Progress and Settings as header icons. Buttons are full-width and oversized. Testing uses release APKs, which take about 10 minutes per change.

## 1. Decisions to make

| ID | Question | Recommendation | Runner-up |
| --- | --- | --- | --- |
| D-16 | Component kit | **React Native Reusables** (MIT, shadcn for RN, the components are copied into our repo, accessible primitives, very active) | HeroUI Native (Apache-2.0, a ready-made v1 kit) |
| D-16a | Styling engine | **Uniwind** (Tailwind v4, Expo-native, no PostCSS step) | NativeWind (v5 is still a preview) |
| D-16b | Dev loop | **Switch to an Expo development build** (dev client) now: UI changes reload in seconds. Release APKs only for handing over a build. | Keep release APKs (slow) |

The spike decides D-16 (UI0 below). It ports the Today screen in Reusables, checks it on SDK 58 and the emulator, and only falls back to the runner-up if the setup fails.

## 2. Design language (patterns, not brands)

From Whoop:
- **Tiles are doorways:** the home screen is 3–4 summary tiles (readiness or load, today's session, streak, this week). Each tile opens one deeper screen.
- **Three levels:** overview, then trends, then detail. Each level answers one question.
- **One big number per tile:** large display figure, small labels, generous spacing.
- **Colour means something:** green, amber or red only for state (good, watch, stop). One accent colour for actions, no decorative colour.
- **Dark first:** near-black background, light theme second.

From Strava:
- **Activity cards:** type icon, title, a row of 3 stats (time, distance or volume, effort), the map for runs, and a kudos bar.
- **The feed is the motivation loop:** your activity and your friends', with one-tap kudos. Explain kudos the first time it appears; critics note that Strava doesn't.

OpenPhysio's own:
- **The body map is the hero visual.** It shows muscle levels (gamification), the muscles an exercise works (Why and how), and injured areas (marked, never "levelled").
- **Safety colours outrank everything:** pain, stop and red-flag states always use the stop colour and come first.
- **Calm by default:** cues and celebrations are brief. One celebration per session at most.

## 3. Theme and tokens (AC-1)
- `packages/ui-tokens/tokens.json` is the single source of truth:
  - semantic colours (`background`, `card`, `foreground`, `muted`, `accent`, `good`, `watch`, `stop`, and one colour per session type)
  - spacing scale (4 pt base)
  - type scale
  - radii
  - motion durations
- A small script generates `global.css` (Tailwind v4 variables for Uniwind and Reusables) and `tokens.ts` (for SVG, Skia and charts, which can't use classes). The generated files are committed. A test fails if they drift from `tokens.json`.
- Session-type colours are assigned in order from a palette in tokens. This keeps the F1 rule (no type → colour table in code).
- **Lint rule:** no hex or `rgb()` literals and no raw `fontSize` numbers in `apps/mobile/src/app/**` and the screens. Tokens only.
- **Sizes:**
  - minimum touch target 44 dp
  - buttons are sized to their label: `sm` 32 dp tall, `md` 40 dp, `lg` 48 dp (one main action per screen)
  - full-width buttons only in sheets and forms

## 4. Component inventory
All components are built on the kit and live in `apps/mobile/src/ui/`, with a gallery screen (dev builds only) for review.

| Group | Components |
| --- | --- |
| Base (from the kit) | Button, IconButton, Card, Badge/Chip, Tabs/SegmentedControl, Sheet, Dialog, Input, Switch, Toast, Skeleton, Avatar |
| Data | StatTile (big number + label + trend), Ring/Gauge (react-native-svg arcs + Reanimated), Sparkline, TrendChart (victory-native-xl; check its licence first, fallback gifted-charts), WeekStrip (7-day dots) |
| Training | SessionCard, ExerciseRow, SetRow, RestTimerRing, PainCheck, ActivityCard, RouteMap (MapLibre, keyless; fallback react-native-maps) |
| Learn | VideoCard and VideoSegmentPlayer (react-native-youtube-iframe with start/end), ChannelRow, CitationChip, WhyHowSheet |
| Body | BodyMap (react-native-body-highlighter: front/back, intensity per area; injured areas shown as an outline, not a fill) |
| Play and social | StreakBadge, PointsPill, LevelBar, BadgeTile, LeaderboardRow, KudosButton, InviteCard |
| Camera | CameraOverlay (skeleton lines, rep counter, one cue line), CameraPermissionCard |
| Feedback | EmptyState, ErrorState, OfflineBanner, ModelDownloadCard (size, Wi-Fi only) |

Also: Icons are lucide-react-native. Haptics use expo-haptics: a light tap on a logged set and a success on finish. Celebrations use Lottie, with one short animation and a reduced-motion check.

## 5. Navigation and screens

Tabs: **Today · Plan · Feed · Learn · Coach**. The **Profile** avatar in the header holds Progress, badges, friends and Settings. Log becomes Feed, with a "You" view and a "Friends" view.

| Screen | Change | ACs |
| --- | --- | --- |
| Today | Tiles: readiness/load gauge, today's session card (Start), streak + points, week strip. No scrolling needed on the Pixel 8a. | AC-2 |
| Plan | A compact week strip with small type dots, replacing the big grid. Tap a day for its sessions. A collapsible "Not everything fit" note instead of a large banner. Regenerate moves to the overflow menu. | AC-1 |
| Session player | One exercise per screen, with a big rep/load number and the set list below. The rest timer is a ring. A "Why and how" sheet and a camera toggle (opt-in). The pain check is a sheet, so it is always in view. | AC-5, AC-13 |
| Feed | Activity cards (you or friends), kudos, and filters. Share settings per activity. | AC-3, AC-11 |
| Learn | Segments: Feed · Channels (add, remove, search) · Saved · Body (browse the knowledge base by body map → muscle → exercises) | AC-4, AC-5, AC-7 |
| Coach | Chat with citation chips and a badge showing which model answered (on phone / my server / my key) | AC-7, AC-14, AC-15 |
| Progress | A body map of muscle levels, trends, nutrition, badges | AC-9 |
| Friends | Weekly leaderboard, invite link or code, requests, per-friend sharing | AC-10, AC-11 |
| Settings | Providers and keys, models (download or delete, with sizes), sharing defaults, server, theme | AC-14, AC-15 |
| Camera counting | Full-screen preview with skeleton overlay, a large rep count and one cue line. A summary sheet after the set. | AC-12, AC-13 |

Also fix the plan bug from the screenshot: two gym sessions on one day and two sessions on most days. That's an engine fix (F4, application plan), not UI.

## 6. Tasks (lane: UI, run one at a time because they share `apps/mobile` layout files)

| ID | Task | Needs | Size | ACs | Done when |
| --- | --- | --- | --- | --- | --- |
| UI0 | Dev-build setup + kit spike: Reusables on Uniwind, Today ported, decision note D-16 | — | S | AC-1 | Today renders in both themes on the emulator; D-16 written |
| UI1 | Tokens package + generator, theme, lint rule, base components, gallery screen | UI0 | M | AC-1 | Lint blocks raw colours; gallery shows every base component |
| UI2 | Today, Plan and session player redesign | UI1, F4 | M | AC-1, AC-2 | Screenshot set approved by Azhar |
| UI3 | Activity cards + Feed (You); route maps | UI1 | M | AC-3 | Runs show maps; cards match the spec |
| UI4 | Learn: channels, search, save, video segments; Why-and-how sheet | UI1, K2 (data) | M | AC-4, AC-5 | Sheet shows body map, cues and a sourced segment |
| UI5 | Progress body map, levels, badges, streak UI | UI1, AP3 | M | AC-9 | Levels fill from logged sets |
| UI6 | Friends, leaderboard, kudos, share settings | UI3, AP5 | M | AC-10, AC-11 | Two emulator users see each other's shared items only |
| UI7 | Camera counting screen + overlay | UI1, AI4 | M | AC-12, AC-13 | Counter and cues shown from the on-device model |
| UI8 | Settings: providers, models, sharing | UI1, AP6 | S | AC-14, AC-15 | Model download and key flows work |

## 7. Validation
- **Maestro** (open source, Apache-2.0) flows run on the emulator for the main journeys. They take screenshots into the PR, so I can review UI changes without building an APK by hand.
- Each screen task ships a before-and-after screenshot pair, in dark and light.
- Accessibility checks: contrast of token pairs (a unit test on `tokens.json`), font scaling at 130%, and screen-reader labels on icon buttons.
- Performance: Today renders in under 500 ms after launch on the emulator; lists use the kit's virtualised list.

## 8. Risks
- Running Reusables on Uniwind is the newer setup and unverified on SDK 58. UI0 checks it first, and NativeWind is the fallback.
- @gorhom/bottom-sheet has had no release since 2026-05. Check it against Reanimated on SDK 58; fallback: Expo Router modal sheets.
- The victory-native-xl licence isn't confirmed. Check it before use.
- Uniwind has a paid Pro tier. We use only the MIT core.

## Appendix: sources
- https://github.com/founded-labs/react-native-reusables
- https://github.com/heroui-inc/heroui-native
- https://docs.uniwind.dev
- https://expo.dev/changelog/sdk-58
- https://github.com/HichamELBSI/react-native-body-highlighter
- https://www.925studios.co/blog/whoop-design-breakdown
- https://runningmagazine.ca/?p=91520
- https://ixd.prattsi.org/2025/09/design-critique-strava-ios-app-2/
