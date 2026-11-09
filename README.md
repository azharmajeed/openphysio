# OpenPhysio

An open-source, self-hostable AI physio and training coach: plans training around your body, goals and past injuries; logs gym, home, run and swim sessions; reads band data; and lets you talk to an evidence-backed AI coach.

**Status:** planning. Nothing is implemented yet. See `docs/HANDOFF.md`.

- Product plan (living doc): https://claude.ai/artifact/P4HHsbmc7kHbwoM9TP52oS
- Technical plan (living doc): https://claude.ai/artifact/V5xvMu14HDF2xtRuWDPYyY
- Repo copies: `docs/prd/PRD-001.md`, `docs/tech/TP-001.md`, `docs/tasks/README.md`

## Layout

```
apps/mobile            Expo (React Native) app, Android first
apps/server            Hono API: sync, AI proxy, scans, Strava, clip hosting
packages/core          plan engine, safety rules, form rules, nutrition
packages/catalog       exercise data, evidence sources, import scripts
packages/integrations  Health Connect mapping, FIT/GPX/TCX writer, Xiaomi export parser
workers/motion         Python: text-to-motion demos, auto-check, mannequin render (GPU pod)
docs/                  brief, PRD, technical plan, tasks, decisions, templates
```

## Licence

Not chosen yet (AGPL-3.0 with a contributor licence agreement is proposed; see `docs/decisions/README.md`). The repository is private until then.
