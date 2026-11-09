// Relative import: core has no subpath export for its generated, untyped migrations.js.
import m from "../../../packages/core/drizzle/migrations.js";

export default m as { journal: { entries: { idx: number; when: number; tag: string; breakpoints: boolean }[] }; migrations: Record<string, string> };
