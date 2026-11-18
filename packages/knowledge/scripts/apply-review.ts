// Apply a decisions file (from the review page) to the data JSON.
// Run: pnpm --filter @openphysio/knowledge apply-review <decisions.json> [--reviewer Name] [--clinician]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { applyReview } from "../src/review.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { reviewer: { type: "string" }, clinician: { type: "boolean" } },
});
if (!positionals[0]) {
  console.error("usage: apply-review <decisions.json> [--reviewer Name] [--clinician]");
  process.exit(2);
}
// pnpm runs from the package folder, so resolve against where the user ran it
const path = resolve(process.env.INIT_CWD ?? process.cwd(), positionals[0]);
const r = applyReview(JSON.parse(readFileSync(path, "utf8")), values);
if (r.refused.length) {
  console.error(`Refused, nothing changed:\n${r.refused.map((m) => "  " + m).join("\n")}`);
  process.exit(1);
}
console.log(`Updated ${r.applied} record(s).`);
if (r.problems.length) {
  console.log(`Validation problems (${r.problems.length}):\n${r.problems.map((m) => "  " + m).join("\n")}`);
  process.exit(1);
}
console.log("Validation: ok.");
