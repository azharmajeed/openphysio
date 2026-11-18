# @openphysio/ui-tokens

`tokens.json` is the single source of truth for the mobile theme (TP-003 section 3).
`pnpm --filter @openphysio/ui-tokens gen` writes `apps/mobile/global.css` and `src/tokens.ts`.
Never edit the generated files; a test fails if they drift.
Colours are OKLCH in `tokens.json`; `tokens.ts` carries sRGB hex for SVG, charts and RN styles.
