import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import tokens from "../tokens.json" with { type: "json" };
import { contrast } from "./color.ts";
import { build } from "./gen.ts";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("generated files", () => {
  it("match tokens.json (run pnpm --filter @openphysio/ui-tokens gen)", () => {
    const { css, ts } = build();
    expect(read("../../../apps/mobile/global.css")).toBe(css);
    expect(read("./tokens.ts")).toBe(ts);
  });
});

const TEXT_PAIRS = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["good", "background"],
  ["watch", "background"],
  ["stop", "background"],
  ["good", "card"],
  ["watch", "card"],
  ["stop", "card"],
] as const;

describe("WCAG AA contrast", () => {
  for (const mode of ["light", "dark"] as const) {
    const c = tokens.color[mode];
    it.each(TEXT_PAIRS)(`${mode}: %s on %s is at least 4.5:1`, (fg, bg) => {
      expect(contrast(c[fg], c[bg])).toBeGreaterThanOrEqual(4.5);
    });
    // Session-type colours are dots and bars, not text: 3:1 non-text rule (WCAG 1.4.11).
    it(`${mode}: session-type colours are at least 3:1 on background and card`, () => {
      for (const col of tokens.sessionType[mode]) {
        expect(contrast(col, c.background)).toBeGreaterThanOrEqual(3);
        expect(contrast(col, c.card)).toBeGreaterThanOrEqual(3);
      }
    });
  }
});
