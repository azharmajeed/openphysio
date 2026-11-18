import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { fixture } from "./fixture.test-data.ts";
import { applyReview, KINDS, loadFiles } from "./review.ts";
import { buildReviewPage } from "./review-page.ts";
import type { Decision } from "./review.ts";

// Temp copy of the fixture, one file per record type. Never the real data.
let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "k6a-"));
  const d = fixture() as unknown as Record<string, unknown[]>;
  for (const [folder, key] of Object.entries(KINDS)) {
    mkdirSync(join(dir, folder));
    writeFileSync(join(dir, folder, "t.json"), JSON.stringify(d[key], null, 2) + "\n");
  }
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const opts = () => ({ dataDir: dir, today: "2026-12-01" });
const claim = (state: Decision["state"], notes?: string): Decision => ({ file: "claims/t.json", id: "claim-test", state, notes });
const read = (f: string) => readFileSync(join(dir, f), "utf8");

test("sets state, reviewer, date, notes; formatting stable", () => {
  const r = applyReview([claim("source-checked", "ok")], { ...opts(), reviewer: "Sam" });
  expect(r).toMatchObject({ applied: 1, refused: [], problems: [] });
  const text = read("claims/t.json");
  expect(text.endsWith("]\n")).toBe(true);
  expect(JSON.parse(text)[0].review).toEqual({ state: "source-checked", reviewer: "Sam", date: "2026-12-01", notes: "ok" });
  expect(text).toBe(JSON.stringify(JSON.parse(text), null, 2) + "\n");
});

test("default reviewer is Azhar; exercise-muscle links use exercise/muscle as id", () => {
  applyReview([{ file: "exercise-muscles/t.json", id: "glute_bridge/gluteus-maximus", state: "rejected", notes: "wrong" }], opts());
  expect(JSON.parse(read("exercise-muscles/t.json"))[0].review.reviewer).toBe("Azhar");
});

test("refuses clinician-reviewed without --clinician, allows with it", () => {
  const before = read("claims/t.json");
  const r = applyReview([claim("clinician-reviewed")], opts());
  expect(r.refused[0]).toContain("--clinician");
  expect(read("claims/t.json")).toBe(before);
  expect(applyReview([claim("clinician-reviewed")], { ...opts(), clinician: true }).applied).toBe(1);
});

test("refuses unknown ids, files and states, and writes nothing", () => {
  const before = read("claims/t.json");
  const r = applyReview(
    [claim("source-checked"), { ...claim("rejected"), id: "nope" }, { ...claim("rejected"), file: "claims/x.json" }, claim("maybe" as never)],
    opts(),
  );
  expect(r.refused).toHaveLength(3);
  expect(read("claims/t.json")).toBe(before);
});

test("idempotent, even on a later day", () => {
  applyReview([claim("source-checked", "ok")], opts());
  const once = read("claims/t.json");
  const again = applyReview([claim("source-checked", "ok")], { ...opts(), today: "2027-01-01" });
  expect(again.applied).toBe(0);
  expect(read("claims/t.json")).toBe(once);
});

test("draft clears reviewer and date; empty notes removed", () => {
  applyReview([claim("source-checked", "ok")], opts());
  applyReview([claim("draft", "")], opts());
  expect(JSON.parse(read("claims/t.json"))[0].review).toEqual({ state: "draft" });
});

test("reports validation problems after applying", () => {
  const c = JSON.parse(read("claims/t.json"));
  c[0].grade = "D";
  writeFileSync(join(dir, "claims/t.json"), JSON.stringify(c));
  expect(applyReview([claim("rejected", "bad grade")], opts()).problems.join()).toContain("grade must be");
});

test("review page: records, source links, raw JSON, no network", () => {
  const html = buildReviewPage(loadFiles(dir));
  expect(html).toContain("claim-test");
  expect(html).toContain("https://example.org/test");
  expect(html).toContain("Raw JSON");
  expect(html).toContain("Download decisions");
  expect(html).not.toMatch(/fetch\(|XMLHttpRequest|<script src|<link /);
});
