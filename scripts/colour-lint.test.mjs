import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";
import { colourSelectors, legacyColourAllowlist } from "../eslint.config.js";

const RULE = "no-restricted-syntax";
const bad = `export const S = { a: "#fff", b: "rgba(0,0,0,.5)", fontSize: 14, color: 3 };
export const T = \`hsl(\${1}, 2%, 3%)\`;\n`;
const ok = `export const S = { fontSize: size, color: tokens.foreground, id: "#123456789" };\n`;

const hits = (r) => r[0].messages.filter((m) => m.ruleId === RULE);

describe("colour lint (UI1c)", () => {
  it("fails a raw colour or font size in a non-allowlisted screen", async () => {
    const r = await new ESLint().lintText(bad, { filePath: "apps/mobile/src/app/fixture.tsx" });
    expect(hits(r)).toHaveLength(5);
  });

  it("passes token usage, and exempts the kit and test files", async () => {
    const e = new ESLint();
    expect(hits(await e.lintText(ok, { filePath: "apps/mobile/src/app/fixture.tsx" }))).toHaveLength(0);
    for (const filePath of ["apps/mobile/src/components/ui/x.tsx", "apps/mobile/src/app/x.test.tsx"]) {
      expect(hits(await e.lintText(bad, { filePath }))).toHaveLength(0);
    }
  });

  // The allowlist can only shrink: a listed file with no violations left must be removed.
  it.each(legacyColourAllowlist)("allowlisted %s still has violations", async (file) => {
    const e = new ESLint({
      overrideConfig: [{ files: ["**/*.tsx"], rules: { [RULE]: ["error", ...colourSelectors] } }],
    });
    expect(hits(await e.lintFiles([file]))).not.toHaveLength(0);
  });
});
