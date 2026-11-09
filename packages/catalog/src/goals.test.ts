import { expect, test } from "vitest";
import { ROLES, SESSION_TYPES, exercises, goals } from "./index.ts";

test("goal ids unique; demands use real session types and roles", () => {
  expect(new Set(goals.map((g) => g.id)).size).toBe(goals.length);
  for (const g of goals)
    for (const d of [...g.demands, ...g.demands.flatMap((x) => x.alternatives ?? [])]) {
      expect(SESSION_TYPES as readonly string[], `${g.id} ${d.sessionType}`).toContain(
        d.sessionType,
      );
      if (d.role) expect(ROLES as readonly string[]).toContain(d.role);
    }
});

test("every exercise has a level; templates have roles; no conditioning without a role", () => {
  for (const e of exercises) {
    expect([1, 2, 3], e.id).toContain(e.level);
    if (["run", "swim", "conditioning"].some((t) => e.sessionTypes.includes(t as never)))
      expect(e.role, e.id).toBeDefined();
  }
});
