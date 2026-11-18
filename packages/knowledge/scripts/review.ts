// Writes review.html: one static page to review knowledge entries in a browser.
// Run: pnpm --filter @openphysio/knowledge review
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildReviewPage } from "../src/review-page.ts";
import { loadFiles } from "../src/review.ts";

const out = fileURLToPath(new URL("../review.html", import.meta.url));
const files = loadFiles();
writeFileSync(out, buildReviewPage(files));
console.log(`Wrote ${out} (${files.reduce((n, f) => n + f.records.length, 0)} records). Open it in a browser.`);
