import js from "@eslint/js";
import tseslint from "typescript-eslint";

const COLOUR_FN = "\\b(rgba?|hsla?|oklch)\\(";
const HEX = "^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$";
const STYLE_PROP = "^(fontSize|color|backgroundColor|borderColor)$";
const MSG = "No raw colours or font sizes in screens: use theme classes or ui-tokens (TP-003 section 3).";

// Selectors for UI1c; exported so the test can check them against the allowlist.
export const colourSelectors = [
  `Literal[value=/${HEX}/]`,
  `Literal[value=/${COLOUR_FN}/i]`,
  `TemplateElement[value.raw=/${COLOUR_FN}/i]`,
  `Property[key.name=/${STYLE_PROP}/][value.type='Literal'][value.raw=/^[0-9.]+$/]`,
].map((selector) => ({ selector, message: MSG }));

export const screenFiles = ["apps/mobile/src/**/*.tsx"];
export const screenIgnores = ["apps/mobile/src/components/ui/**", "**/*.test.tsx"];

// Legacy files that still break the rule; shrinks to empty in UI2a-UI2d.
// scripts/colour-allowlist.test.mjs fails if a listed file has no violations left.
export const legacyColourAllowlist = [
  "apps/mobile/src/ProfileForm.tsx",
  "apps/mobile/src/app/(tabs)/log.tsx",
  "apps/mobile/src/app/(tabs)/plan.tsx",
  "apps/mobile/src/app/checkin.tsx",
  "apps/mobile/src/app/health.tsx",
  "apps/mobile/src/app/progress.tsx",
  "apps/mobile/src/app/scan/[id].tsx",
  "apps/mobile/src/app/scan/index.tsx",
  "apps/mobile/src/app/session/[id].tsx",
  "apps/mobile/src/app/settings.tsx",
  "apps/mobile/src/coach/CoachScreen.tsx",
  "apps/mobile/src/export/ExportActions.tsx",
  "apps/mobile/src/health/BandCard.tsx",
  "apps/mobile/src/learn/ChannelsScreen.tsx",
  "apps/mobile/src/learn/LearnScreen.tsx",
  "apps/mobile/src/log/Pain.tsx",
  "apps/mobile/src/log/Picker.tsx",
  "apps/mobile/src/log/Rest.tsx",
  "apps/mobile/src/log/Session.tsx",
  "apps/mobile/src/plan/QuickLog.tsx",
  "apps/mobile/src/plan/SessionCard.tsx",
  "apps/mobile/src/progress/Charts.tsx",
  "apps/mobile/src/progress/NutritionCard.tsx",
  "apps/mobile/src/run/RunDetail.tsx",
  "apps/mobile/src/run/Tracker.tsx",
  "apps/mobile/src/ui.tsx",
];

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/dist/**", ".expo/**", "workers/**", ".claude/**"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: screenFiles,
    ignores: screenIgnores,
    rules: { "no-restricted-syntax": ["error", ...colourSelectors] },
  },
  {
    // escape glob characters in route paths like (tabs) and [id]
    files: legacyColourAllowlist.map((p) => p.replace(/[()[\]]/g, "\\$&")),
    rules: { "no-restricted-syntax": "off" },
  },
);
