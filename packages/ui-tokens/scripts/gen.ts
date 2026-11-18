import { writeFileSync } from "node:fs";
import { build } from "../src/gen.ts";

const { css, ts } = build();
writeFileSync(new URL("../../../apps/mobile/global.css", import.meta.url), css);
writeFileSync(new URL("../src/tokens.ts", import.meta.url), ts);
