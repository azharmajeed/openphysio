import {
  INJURY_FILTER_SOURCE_IDS,
  PAIN_MONITOR_SOURCE_IDS,
  SPIKE_GUARD_SOURCE_IDS,
} from "@openphysio/core";
import { expect, test } from "vitest";
import { exercises, getSource, sources } from "./index.ts";
import { loadNotes, parseNote, searchNotes } from "./knowledge.ts";

const notes = loadNotes();

test("every sourceId used in core, catalogue and notes is in the registry", () => {
  const used = new Set<string>([
    ...INJURY_FILTER_SOURCE_IDS,
    ...PAIN_MONITOR_SOURCE_IDS,
    ...SPIKE_GUARD_SOURCE_IDS,
    ...exercises.flatMap((e) => (e.sourceId ? [e.sourceId] : [])),
    ...notes.flatMap((n) => n.sourceIds),
  ]);
  const missing = [...used].filter((id) => !getSource(id));
  expect(missing).toEqual([]);
  expect(new Set(sources.map((s) => s.id)).size).toBe(sources.length);
});

test("notes: 20-40, valid, red-flags present", () => {
  expect(notes.length).toBeGreaterThanOrEqual(20);
  expect(notes.length).toBeLessThanOrEqual(40);
  expect(notes.find((n) => n.id === "red-flags")).toBeDefined();
});

test("parseNote reads frontmatter and rejects bad notes", () => {
  const n = parseNote("x", "---\ntopic: T\nsourceIds: [a, b]\ngrade: B\n---\nBody here\n");
  expect(n).toEqual({ id: "x", topic: "T", sourceIds: ["a", "b"], grade: "B", body: "Body here" });
  expect(() => parseNote("x", "no frontmatter")).toThrow();
});

test("search ranks the relevant note first and attaches sources", () => {
  const hit = searchNotes(notes, "how much protein per kg")[0]!;
  expect(hit.id).toBe("protein-intake");
  expect(hit.sources[0]!.id).toBe("src-issn-protein-2017");
  expect(searchNotes(notes, "my knee locks and gives way", 3).map((h) => h.id)).toContain(
    "red-flags",
  );
  expect(searchNotes(notes, "swim breathing")[0]!.id).toBe("swim-technique");
  expect(searchNotes(notes, "zzzz")).toEqual([]);
  expect(searchNotes(notes, "run", 2).length).toBeLessThanOrEqual(2);
});
