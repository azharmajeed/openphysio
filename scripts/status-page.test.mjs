import { describe, expect, it } from "vitest";
import {
  buildBuildState,
  buildModel,
  findSections,
  md,
  parseContract,
  parsePrd,
  parsePrs,
  parseReadme,
  parseVerification,
  renderHtml,
  splitSections,
} from "./status-page.mjs";

const prdMd = `# PRD-001: Test
Status: Approved (D-1)
- AC-1 First thing.
- AC-2 Second thing.
- AC-3 Third thing.
`;
const verMd = `# V
| AC | Status | Where | Date | Evidence | Note |
| --- | --- | --- | --- | --- | --- |
| AC-1 | Verified (emulator) | emulator | 2026-11-14 | f.md | ok |
| AC-2 | Not checked | | | | |
`;
const contractA = `# A1: Alpha task
Status: Done
Approved product specification ID/version: PRD-001 v0.1 (D-1)
Acceptance criteria covered: AC-1, AC-2 (partly)
## Checkpoint
`;
const contractB = `# B1: Beta task
Status: In review
Lane: Tooling
Acceptance criteria covered: foundation for AC-1 to AC-3
`;
const readmeMd = `| ID | Task | Lane | Needs | Size | ACs | Done when |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | Alpha | Core | — | S | AC-1 | x |
| P1 | Planned one | Mobile | A1, B1 | M | AC-2 | y |

| Wave | Tasks |
| --- | --- |
| 1 | A1, B1 |
| 2 | P1 |
`;

const model = () =>
  buildModel({
    readmes: [parseReadme(readmeMd)],
    contracts: [parseContract("A1", contractA), parseContract("B1", contractB)],
    prds: { "PRD-001": parsePrd(prdMd) },
    verifications: { "PRD-001": parseVerification(verMd) },
    prs: parsePrs(["A1: alpha (#7)", "A1: older (#2)", "chore: x (#1)"]),
  });

describe("parsing", () => {
  it("reads README rows and waves", () => {
    const r = parseReadme(readmeMd);
    expect(r.tasks.map((t) => t.id)).toEqual(["A1", "P1"]);
    expect(r.tasks[1]).toMatchObject({ lane: "Mobile", needs: ["A1", "B1"], acs: ["AC-2"] });
    expect(r.waves).toEqual([
      { wave: "1", tasks: ["A1", "B1"] },
      { wave: "2", tasks: ["P1"] },
    ]);
  });
  it("reads contracts", () => {
    expect(parseContract("A1", contractA)).toMatchObject({
      title: "Alpha task",
      status: "Done",
      prd: "PRD-001",
      acs: ["AC-1", "AC-2"],
    });
    expect(parseContract("B1", contractB)).toMatchObject({
      status: "In review",
      lane: "Tooling",
      acs: [],
    });
  });
  it("reads PRD, verification and PR numbers", () => {
    expect(parsePrd(prdMd).acs).toHaveLength(3);
    expect(parseVerification(verMd)["AC-1"].status).toBe("Verified (emulator)");
    expect(parsePrs(["A1: alpha (#7)", "A1: older (#2)"])).toEqual({ A1: 7 });
  });
});

describe("PRD and milestone rules", () => {
  const v2Readme = `# v0.2
PRD: PRD-002

| ID | Task | Lane | Needs | Size | ACs | Done when |
| --- | --- | --- | --- | --- | --- | --- |
| X1 | Cross | Core | — | S | AC-1, PRD-001/AC-3 | z |
`;
  const prd2 = "# PRD-002: Two\nStatus: Draft\n- AC-1 Two first.\n";
  const v2 = () =>
    buildModel({
      readmes: [
        { ...parseReadme(readmeMd), milestone: "v0.1" },
        { ...parseReadme(v2Readme), milestone: "v0.2" },
      ],
      contracts: [{ ...parseContract("A1", contractA), milestone: "v0.1" }],
      prds: { "PRD-001": parsePrd(prdMd), "PRD-002": parsePrd(prd2) },
      verifications: {},
      prs: {},
    });
  it("README PRD line sets the default, a qualified id overrides it", () => {
    expect(parseReadme(v2Readme).prd).toBe("PRD-002");
    expect(parseReadme(readmeMd).prd).toBe("PRD-001");
    const m = v2();
    expect(m.tasks.find((t) => t.id === "X1").acs).toEqual(["PRD-002/AC-1", "PRD-001/AC-3"]);
    const covered = (key) => m.acs.find((a) => a.key === key).tasks.map((t) => t.id);
    expect(covered("PRD-002/AC-1")).toEqual(["X1"]);
    expect(covered("PRD-001/AC-3")).toEqual(["X1"]);
    expect(covered("PRD-001/AC-1")).toEqual(["A1"]);
  });
  it("a contract's specification field wins over the README PRD", () => {
    const c = parseContract(
      "X1",
      "# X1: Cross\nStatus: Ready\nApproved product specification ID/version: PRD-001 v0.1\nAcceptance criteria covered: AC-2\n",
    );
    const m = buildModel({
      readmes: [{ ...parseReadme(v2Readme), milestone: "v0.2" }],
      contracts: [{ ...c, milestone: "v0.2" }],
      prds: { "PRD-001": parsePrd(prdMd) },
      verifications: {},
      prs: {},
    });
    expect(m.tasks[0]).toMatchObject({ prd: "PRD-001", acs: ["PRD-001/AC-2"], milestone: "v0.2" });
  });
  it("tasks carry their milestone and the page groups by it", () => {
    const m = v2();
    expect(m.tasks.map((t) => t.milestone)).toEqual(["v0.1", "v0.1", "v0.2"]);
    expect(renderHtml({ ...m, docs: [], meta: {} })).toContain(
      'v0.2 <small><span class="n">1</span>',
    );
  });
});

describe("model", () => {
  it("computes build states", () => {
    expect(buildBuildState(["Done", "Done"])).toBe("Built");
    expect(buildBuildState(["Done", "Ready"])).toBe("In progress");
    expect(buildBuildState(["Ready"])).toBe("Not started");
    expect(buildBuildState([])).toBe("Unmapped");
  });
  it("traces ACs and finds gaps", () => {
    const m = model();
    const by = Object.fromEntries(m.acs.map((a) => [a.id, a]));
    expect(by["AC-1"]).toMatchObject({ build: "Built", verification: "Verified (emulator)" });
    expect(by["AC-2"]).toMatchObject({ build: "In progress", verification: "Not checked" }); // A1 Done, P1 Planned
    expect(by["AC-3"].build).toBe("Unmapped");
    expect(m.gaps.unmapped.map((a) => a.id)).toEqual(["AC-3"]);
    expect(m.gaps.noAc.map((t) => t.id)).toEqual(["B1"]);
    expect(m.gaps.planned.map((t) => t.id)).toEqual(["P1"]);
    expect(m.gaps.unchecked.map((x) => x.task.id)).toEqual(["A1"]);
    expect(m.tasks.find((t) => t.id === "A1").pr).toBe(7);
  });
  it("renders a self-contained page", () => {
    const html = renderHtml({
      ...model(),
      docs: [],
      meta: { date: "d", branch: "b", commit: "c" },
    });
    expect(html).toContain("prefers-color-scheme:dark");
    expect(html).toContain("https://github.com/azharmajeed/openphysio/pull/7");
    expect(html).not.toMatch(/<(script|link)[^>]+src=/);
  });
});

describe("markdown renderer", () => {
  it("renders the supported syntax", () => {
    const html = md(
      [
        "# Title",
        "",
        "Some **bold**, *italic* and `code` with [a link](https://x.io/a).",
        "",
        "- one",
        "- two",
        "",
        "1. first",
        "2. second",
        "",
        "| A | B |",
        "| --- | --- |",
        "| 1 | 2 |",
        "",
        "```",
        "let a = 1 < 2;",
        "```",
      ].join("\n"),
    );
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<b>bold</b>");
    expect(html).toContain("<i>italic</i>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain('<a href="https://x.io/a"');
    expect(html).toContain("<ul><li>one</li><li>two</li></ul>");
    expect(html).toContain("<ol><li>first</li><li>second</li></ol>");
    expect(html).toContain("<th>A</th>");
    expect(html).toContain("<td>2</td>");
    expect(html).toContain("<pre><code>let a = 1 &lt; 2;</code></pre>");
  });
  it("escapes HTML and refuses script links", () => {
    const html = md(
      "<script>alert(1)</script> <img src=x onerror=y>\n\n[bad](javascript:alert(1)) `<b>`",
    );
    expect(html).not.toMatch(/<(script|img)/);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain('href="javascript');
    expect(html).toContain("<code>&lt;b&gt;</code>");
  });
  it("maps links to other documents onto the drawer", () => {
    expect(md("[d](../decisions/D-9.md)")).toContain('href="#doc-D-9"');
  });
});

describe("plan sections", () => {
  const tp = "# TP\nintro\n## Mobile\nF4 builds the shell.\n## Other\nF40 and XF4 are different.\n";
  it("splits at headings, ignoring code fences", () => {
    const withFence = `${tp}\`\`\`\n# not a heading\n\`\`\`\n`;
    expect(splitSections(withFence).map((s) => s.heading)).toEqual(["TP", "Mobile", "Other"]);
  });
  it("finds sections mentioning a task id as a whole word", () => {
    const hits = findSections("F4", [{ name: "TP-001", md: tp }]);
    expect(hits.map((h) => [h.doc, h.heading])).toEqual([["TP-001", "Mobile"]]);
    expect(findSections("F4", [{ name: "x", md: "## A\nF40 only" }])).toEqual([]);
  });
  it("embeds document text once, safely, and makes cards clickable", () => {
    const html = renderHtml({
      ...model(),
      docs: [
        { name: "TP-001", kind: "tech", title: "T", status: "", href: "x", md: "</script><b>QQ9" },
      ],
      contractMd: { A1: "# A1: Alpha" },
      meta: {},
    });
    expect(html.match(/<\/script>/g)).toHaveLength(2);
    expect(html.split("QQ9").length - 1).toBe(1);
    expect(html).toContain('data-open="task-A1"');
    expect(html).toContain('data-open="ac-PRD-001-AC-1"');
    expect(html).toContain('role="button" tabindex="0"');
  });
});
