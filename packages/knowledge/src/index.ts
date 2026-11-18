import { all } from "./data.ts";
import { publish } from "./publish.ts";

export * from "./types.ts";
export { publish } from "./publish.ts";
export { validate, coverage, BODY_MAP_SLUGS } from "./validate.ts";

/** Everything, drafts included: for review tooling and tests only. */
export const allRecords = all;
/** What the app may show: source-checked or clinician-reviewed, with published references only. */
export const published = () => publish(all);
