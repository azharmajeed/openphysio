import { expect, test } from "vitest";
import { allRecords, coverage, publish, published, validate } from "./index.ts";
import { fixture } from "./fixture.test-data.ts";
import type { KnowledgeData, ReviewState } from "./types.ts";

// Mutation and publish tests use the fixed fixture, never the real content (which K tasks keep changing).
const clone = fixture;
/** The fixture with every record set to one review state. */
const withState = (state: ReviewState): KnowledgeData => {
  const d = clone();
  for (const list of Object.values(d)) for (const r of list) r.review = { state };
  return d;
};
const count = (d: KnowledgeData) => Object.values(d).reduce((a, l) => a + l.length, 0);

test("shipped data is valid", () => {
  expect(validate(allRecords)).toEqual([]);
});

test("a muscle may omit bodyMapArea", () => {
  const d = fixture();
  d.muscles[0]!.bodyMapArea = undefined;
  expect(validate(d)).toEqual([]);
});

test("validate catches broken data", () => {
  const cases: [string, (d: KnowledgeData) => void, string][] = [
    ["duplicate id", (d) => d.muscles.push(d.muscles[0]!), "duplicate ids"],
    ["unknown source", (d) => (d.claims[0]!.sourceId = "nope"), "source nope unknown"],
    ["bad grade", (d) => ((d.claims[0] as { grade: string }).grade = "D"), "grade must be"],
    ["no locator", (d) => (d.sources[0]!.url = undefined), "DOI, PMID or URL"],
    ["no licence", (d) => (d.sources[0]!.licence = ""), "needs a licence"],
    ["bad slug", (d) => (d.muscles[0]!.bodyMapArea = "glutes"), "not a body-map slug"],
    ["unknown exercise", (d) => (d.cues[0]!.exerciseId = "nope"), "not in catalogue"],
    [
      "long cue",
      (d) =>
        (d.cues[0]!.text =
          "one two three four five six seven eight nine ten eleven twelve thirteen"),
      "12 words",
    ],
    ["bad role", (d) => ((d.exerciseMuscles[0] as { role: string }).role = "main"), "bad role"],
    ["dangling fault cue", (d) => (d.faults[0]!.cueId = "nope"), "cue nope unknown"],
    ["unknown claim subject", (d) => d.claims[0]!.subjects.push("nope"), "subject nope unknown"],
  ];
  for (const [name, mutate, want] of cases) {
    const d = clone();
    mutate(d);
    expect(validate(d).join("\n"), name).toContain(want);
  }
});

test("published() ships nothing while every record is draft", () => {
  expect(count(published())).toBe(0);
});

test("drafts and rejected records never publish", () => {
  expect(count(publish(withState("draft")))).toBe(0);
  expect(count(publish(withState("rejected")))).toBe(0);
});

test("the fixture is valid", () => {
  expect(validate(fixture())).toEqual([]);
});

test("both checked states publish", () => {
  const total = count(fixture());
  expect(count(publish(withState("source-checked")))).toBe(total);
  expect(count(publish(withState("clinician-reviewed")))).toBe(total);
});

test("a published record needs its references published", () => {
  const d = withState("source-checked");
  d.sources[0]!.review.state = "rejected";
  expect(count(publish(d))).toBe(0); // everything cites the one source

  const e = withState("source-checked");
  e.claims[0]!.review.state = "draft"; // muscle lists the claim, so it falls too
  const out = publish(e);
  expect(out.claims).toHaveLength(0);
  expect(out.muscles).toHaveLength(0);
  expect(out.exerciseMuscles).toHaveLength(0);
  expect(out.cues).toHaveLength(1);

  const f = withState("source-checked");
  f.cues[0]!.review.state = "draft";
  expect(publish(f).faults).toHaveLength(0);
});

test("coverage: every catalogue exercise has a primary muscle (body-map areas are only reported)", () => {
  const c = coverage(allRecords);
  console.info(`coverage: ${c.areasWithoutMuscle.length} body-map areas without a muscle`);
  expect(c.exercisesWithoutPrimary).toEqual([]);
});

test("a video segment's endSec is optional, but must follow startSec when given", () => {
  const seg = { id: "vs-test", videoId: "abc", channelId: "ch", startSec: 10, title: "T", summary: "S", subjects: ["glute_bridge"], sourceId: "src-test", review: { state: "draft" as const } };
  const d = fixture();
  d.videoSegments.push(seg);
  expect(validate(d)).toEqual([]);
  d.videoSegments[0]!.endSec = 10;
  expect(validate(d).join()).toContain("endSec must be after startSec");
  d.videoSegments[0]!.endSec = 20;
  expect(validate(d)).toEqual([]);
});
