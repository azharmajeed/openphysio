// Generates docs/status.html from the repo's PRDs, task contracts, READMEs, decisions and git log.
// Usage: node scripts/status-page.mjs   (or: pnpm status)
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const REPO_URL = "https://github.com/azharmajeed/openphysio";
const DEFAULT_PRD = "PRD-001";
const STATES = ["Draft", "Ready", "Running", "Blocked", "In review", "Done", "Cancelled"];

// ---------- parsing (pure) ----------

const cells = (line) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

/** All markdown tables in `md` as { header: string[], rows: string[][] }. */
export function parseTables(md) {
  const tables = [];
  let cur = null;
  for (const line of md.split(/\r?\n/)) {
    if (!line.trim().startsWith("|")) {
      cur = null;
    } else if (!cur) {
      cur = { header: cells(line).map((h) => h.toLowerCase()), rows: [] };
      tables.push(cur);
    } else if (!/^\s*\|?\s*:?-{3,}/.test(line)) {
      cur.rows.push(cells(line));
    }
  }
  return tables;
}

const field = (md, key) => md.match(new RegExp(`^${key}:[ \\t]*(.*)$`, "mi"))?.[1].trim() ?? "";
// AC tokens, optionally qualified with a PRD: "AC-3" or "PRD-002/AC-3".
const acIds = (text) => [...new Set(text.match(/(?:PRD-\d+\/)?AC-\d+/g) ?? [])];
const qualify = (ac, prd) => (ac.includes("/") ? ac : `${prd}/${ac}`);
const title = (md) => md.match(/^#\s+(.*)$/m)?.[1].trim() ?? "";
const normStatus = (s) =>
  STATES.find((x) => s.toLowerCase().startsWith(x.toLowerCase())) ?? s.split(/[\s(]/)[0];

/** A task README: optional `PRD: PRD-n` line, task rows, Waves table. */
export function parseReadme(md) {
  const tasks = [];
  const waves = [];
  const prd = md.match(/^PRD:[ \t]*(PRD-\d+)/m)?.[1] ?? DEFAULT_PRD;
  for (const t of parseTables(md)) {
    if (t.header.includes("id") && t.header.includes("task")) {
      const col = (r, name) => r[t.header.indexOf(name)] ?? "";
      for (const r of t.rows) {
        tasks.push({
          id: col(r, "id"),
          title: col(r, "task"),
          lane: col(r, "lane"),
          needs: col(r, "needs").match(/[A-Za-z]+\d+[A-Za-z]*/g) ?? [],
          size: col(r, "size"),
          acs: acIds(col(r, "acs")),
          doneWhen: col(r, "done when"),
        });
      }
    } else if (t.header[0] === "wave") {
      for (const r of t.rows)
        waves.push({
          wave: r[0],
          tasks: (r[1] ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        });
    }
  }
  return { prd, tasks, waves };
}

/** A task contract (docs/tasks/<ID>.md). */
export function parseContract(id, md) {
  const covered = field(md, "Acceptance criteria covered");
  return {
    id,
    title: title(md).replace(/^[A-Za-z0-9]+:\s*/, ""),
    status: normStatus(field(md, "Status")) || "Draft",
    lane: field(md, "Lane"),
    prd: field(md, "Approved product specification ID/version").match(/PRD-\d+/)?.[0] ?? null, // null: fall back to the README row's PRD
    // "none …" and "foundation for …" mean no direct coverage; the rest is mentioned for context.
    acs: /^(none|foundation)/i.test(covered) ? [] : acIds(covered),
    hasCheckpoint: /^## Checkpoint/m.test(md),
  };
}

export function parsePrd(md) {
  return {
    title: title(md),
    status: field(md, "Status"),
    acs: [...md.matchAll(/^- (AC-\d+)\s+(.*)$/gm)].map((m) => ({ id: m[1], text: m[2] })),
  };
}

/** Verification table -> { "AC-1": { status, where, date, evidence, note } } */
export function parseVerification(md) {
  const out = {};
  const t = parseTables(md).find((x) => x.header[0] === "ac" && x.header.includes("status"));
  for (const r of t?.rows ?? []) {
    const [, status, where, date, evidence, note] = r;
    out[r[0]] = { status: status || "Not checked", where, date, evidence, note };
  }
  return out;
}

export const parseDoc = (md) => ({
  title: title(md),
  status: field(md, "Status") || field(md, "Answer and timestamp"),
});

/** Latest `<ID>: … (#n)` PR per task id, from git log subjects (newest first). */
export function parsePrs(subjects) {
  const prs = {};
  for (const s of subjects) {
    const m = s.match(/^([A-Za-z0-9]+): .*\(#(\d+)\)$/);
    if (m && !(m[1] in prs)) prs[m[1]] = Number(m[2]);
  }
  return prs;
}

// ---------- model (pure) ----------

export function buildBuildState(statuses) {
  const live = statuses.filter((s) => s !== "Cancelled");
  if (!live.length) return "Unmapped";
  const done = live.filter((s) => s === "Done").length;
  return done === live.length ? "Built" : done ? "In progress" : "Not started";
}

export function buildModel({ readmes, contracts, prds, verifications, prs, docs = [], meta = {} }) {
  const byId = new Map();
  const waves = [];
  for (const r of readmes) {
    waves.push(...r.waves.map((w) => ({ ...w, milestone: r.milestone })));
    for (const t of r.tasks)
      byId.set(t.id, {
        ...t,
        acs: t.acs.map((a) => qualify(a, r.prd)),
        prd: r.prd,
        milestone: r.milestone,
        status: "Planned",
        planned: true,
      });
  }
  for (const c of contracts) {
    const row = byId.get(c.id);
    const prd = c.prd ?? row?.prd ?? DEFAULT_PRD;
    byId.set(c.id, {
      needs: [],
      ...row,
      id: c.id,
      title: c.title || row?.title || c.id,
      lane: row?.lane || c.lane || "Other",
      status: c.status,
      prd,
      milestone: c.milestone ?? row?.milestone,
      acs: c.acs.map((a) => qualify(a, prd)),
      planned: false,
    });
  }
  const tasks = [...byId.values()].map((t) => ({ ...t, pr: prs[t.id] }));
  for (const t of tasks)
    t.wave = waves.find((w) => w.milestone === t.milestone && w.tasks.includes(t.id))?.wave;

  const acs = [];
  for (const [prdId, prd] of Object.entries(prds)) {
    for (const ac of prd.acs) {
      const covering = tasks.filter((t) => t.acs.includes(`${prdId}/${ac.id}`));
      const v = verifications[prdId]?.[ac.id];
      acs.push({
        key: `${prdId}/${ac.id}`,
        prd: prdId,
        id: ac.id,
        text: ac.text,
        tasks: covering,
        build: buildBuildState(covering.map((t) => t.status)),
        verification: v?.status || "Not checked",
        evidence: v?.evidence ?? "",
        note: v?.note ?? "",
        where: v?.where ?? "",
        date: v?.date ?? "",
      });
    }
  }

  const count = (items, f) => items.reduce((m, x) => ((m[f(x)] = (m[f(x)] ?? 0) + 1), m), {});
  const gaps = {
    unmapped: acs.filter((a) => a.build === "Unmapped"),
    noAc: tasks.filter((t) => !t.acs.length),
    planned: tasks.filter((t) => t.planned),
    unchecked: tasks
      .filter((t) => t.status === "Done")
      .map((t) => ({
        task: t,
        acs: acs.filter((a) => a.tasks.includes(t) && a.verification === "Not checked"),
      }))
      .filter((x) => x.acs.length),
  };
  return {
    meta,
    tasks,
    waves,
    acs,
    prds,
    docs,
    gaps,
    totals: {
      tasks: count(tasks, (t) => t.status),
      build: count(acs, (a) => a.build),
      verification: count(acs, (a) => a.verification),
    },
  };
}

// ---------- rendering ----------

const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z]+/g, "-")
    .replace(/^-|-$/g, "");
const tone = (s) => {
  if (/^(done|built|accepted|verified)/i.test(s)) return "ok";
  if (/^(in review)/i.test(s)) return "info";
  if (/^(running|in progress|partly)/i.test(s)) return "warn";
  if (/^(blocked|unmapped)/i.test(s)) return "bad";
  if (/^ready/i.test(s)) return "ready";
  return "mute";
};
const chip = (s) => `<span class="chip ${tone(s)} s-${slug(s)}">${esc(s)}</span>`;
const prLink = (n) => (n ? `<a class="pr" href="${REPO_URL}/pull/${n}">#${n}</a>` : "");
const taskRow = (t) => `<li class="task" data-q="${esc(`${t.id} ${t.title}`.toLowerCase())}">
  <div class="top"><b>${esc(t.id)}</b>${chip(t.status)}${prLink(t.pr)}${t.wave !== undefined ? `<span class="wave">wave ${esc(t.wave.split(" ")[0])}</span>` : ""}</div>
  <div>${esc(t.title)}</div>
  <div class="sub">${t.needs?.length ? `needs ${esc(t.needs.join(", "))}` : "no dependencies"}${t.acs.length ? ` · ${esc(t.acs.map((a) => a.replace(`${t.prd}/`, "")).join(", "))}` : ""}</div></li>`;
const taskChip = (t) =>
  `<span class="mini" title="${esc(t.title)}">${esc(t.id)} ${chip(t.status)}</span>`;
const counts = (o) =>
  Object.entries(o)
    .map(([k, v]) => `<span class="stat">${chip(k)}<b>${v}</b></span>`)
    .join("");
const none = (items, f) =>
  items.length ? `<ul class="plain">${items.map(f).join("")}</ul>` : `<p class="sub">None.</p>`;

export function renderHtml(m) {
  const streams = [...new Set(m.tasks.map((t) => t.milestone))]
    .map((ms) => {
      const inMs = m.tasks.filter((t) => t.milestone === ms);
      const cols = [...new Set(inMs.map((t) => t.lane))]
        .map((l) => {
          const ts = inMs.filter((t) => t.lane === l);
          return `<section class="col"><h3>${esc(l)} <small>${ts.length}</small></h3><ul class="plain">${ts.map(taskRow).join("")}</ul></section>`;
        })
        .join("");
      return `<h3 class="ms">${esc(ms)} <small>${inMs.length} tasks</small></h3><div class="grid streams">${cols}</div>`;
    })
    .join("");
  const waves = m.waves
    .map(
      (w) =>
        `<div class="wrow"><b>${esc(w.milestone)} · wave ${esc(w.wave)}</b><div>${w.tasks
          .map((id) => m.tasks.find((t) => t.id === id))
          .map((t, i) => (t ? taskChip(t) : `<span class="mini">${esc(w.tasks[i])}</span>`))
          .join("")}</div></div>`,
    )
    .join("");
  const trace = Object.entries(m.prds)
    .map(([id, prd]) => {
      const rows = m.acs
        .filter((a) => a.prd === id)
        .map(
          (
            a,
          ) => `<div class="ac${a.build === "Unmapped" ? " unmapped" : ""}" data-q="${esc(`${a.key} ${a.text}`.toLowerCase())}">
  <div class="top"><b>${esc(a.id)}</b>${chip(a.build)}${chip(a.verification)}</div>
  <div>${esc(a.text)}</div>
  <div class="tasks">${a.tasks.length ? a.tasks.map(taskChip).join("") : '<span class="sub">no tasks</span>'}</div>
  ${a.evidence || a.note ? `<div class="sub">${esc([a.where, a.date].filter(Boolean).join(" · "))} ${esc(a.evidence)} ${esc(a.note)}</div>` : ""}</div>`,
        )
        .join("");
      return `<h3>${esc(id)} <small>${esc(prd.title)} · ${esc(prd.status)}</small></h3><div class="grid acs">${rows}</div>`;
    })
    .join("");
  const g = m.gaps;
  const docs = m.docs
    .map(
      (d) =>
        `<li><a href="${esc(d.href)}">${esc(d.name)}</a> <span class="sub">${esc(d.title)}</span> ${d.status ? chip(d.status.slice(0, 40)) : ""}</li>`,
    )
    .join("");
  const { meta } = m;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>OpenPhysio status</title>
<style>
:root{--bg:#f6f7f9;--card:#fff;--fg:#1c2330;--sub:#667085;--line:#e3e6ec;--ok:#157f4b;--okb:#dcf5e7;--info:#4338ca;--infob:#e5e7ff;--warn:#9a5b00;--warnb:#fdeccb;--bad:#b42318;--badb:#fde2e0;--ready:#0e7490;--readyb:#d3f2f8;--mute:#475467;--muteb:#eaecf0}
@media(prefers-color-scheme:dark){:root{--bg:#0f1319;--card:#171c25;--fg:#e6e9ef;--sub:#98a2b3;--line:#2a313d;--ok:#6ee7a8;--okb:#12382a;--info:#a5b4fc;--infob:#25285a;--warn:#fcd34d;--warnb:#3d2d09;--bad:#fda29b;--badb:#4a1b17;--ready:#67e8f9;--readyb:#0c3540;--mute:#cbd5e1;--muteb:#2a313d}}
*{box-sizing:border-box}body{margin:0;padding:24px 16px 64px;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:1280px;margin:auto}h1{margin:0;font-size:28px;letter-spacing:-.02em}h2{margin:40px 0 12px;font-size:20px;letter-spacing:-.01em}h3{margin:20px 0 10px;font-size:16px}h3 small{color:var(--sub);font-weight:400;margin-left:6px}
a{color:var(--info)}.sub{color:var(--sub);font-size:13px}.plain{list-style:none;margin:0;padding:0;display:grid;gap:8px}
header .sub{margin-top:4px}.stats{display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:16px}.stat{display:inline-flex;gap:6px;align-items:center}
.card,.task,.ac,.col,.wrow{background:var(--card);border:1px solid var(--line);border-radius:12px}.task,.ac{padding:10px 12px}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}.streams{align-items:start}.col{padding:4px 12px 12px;background:transparent;border:0}
.col h3{position:sticky;top:0;background:var(--bg);padding:8px 0;margin:0 0 4px}
.top{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:2px}.wave{margin-left:auto;color:var(--sub);font-size:12px}.pr{font-size:13px}
.chip{display:inline-block;padding:1px 9px;border-radius:99px;font-size:12px;font-weight:600;white-space:nowrap}
.ok{color:var(--ok);background:var(--okb)}.info{color:var(--info);background:var(--infob)}.warn{color:var(--warn);background:var(--warnb)}.bad{color:var(--bad);background:var(--badb)}.ready{color:var(--ready);background:var(--readyb)}.mute{color:var(--mute);background:var(--muteb)}
.s-planned{background:transparent;outline:1px dashed var(--sub)}.s-cancelled{text-decoration:line-through}
.acs{grid-template-columns:repeat(auto-fill,minmax(340px,1fr))}.unmapped{border-color:var(--bad);box-shadow:0 0 0 2px var(--badb)}
.tasks,.wrow div{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.mini{display:inline-flex;gap:4px;align-items:center;font-size:12px;border:1px solid var(--line);border-radius:8px;padding:1px 6px}
.ms{margin-top:28px;font-size:18px}.wrow{display:grid;grid-template-columns:130px 1fr;gap:8px;padding:8px 12px;margin-bottom:8px;align-items:start}.wrow div{margin:0}
.gaps{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}.gaps .card{padding:4px 16px 14px}.gaps h3{margin-top:12px}
#q{width:100%;max-width:360px;padding:8px 12px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--fg);font:inherit;margin-top:16px}
.hide{display:none}ul.docs{padding-left:18px}@media(max-width:520px){.wrow{grid-template-columns:1fr}}
</style></head><body><main>
<header><h1>OpenPhysio status</h1>
<div class="sub">Generated ${esc(meta.date)} · branch ${esc(meta.branch)} · commit ${esc(meta.commit)}</div>
<div class="stats"><span class="sub">Tasks</span>${counts(m.totals.tasks)}</div>
<div class="stats"><span class="sub">ACs built</span>${counts(m.totals.build)}</div>
<div class="stats"><span class="sub">ACs verified</span>${counts(m.totals.verification)}</div>
<input id="q" type="search" placeholder="Filter tasks and ACs" aria-label="Filter tasks and ACs"></header>
<h2>Work streams</h2>${streams}
<h2>Parallel waves</h2>${waves}
<h2>Traceability</h2>${trace}
<h2>Gaps</h2><div class="gaps">
<div class="card"><h3>ACs with no task (${g.unmapped.length})</h3>${none(g.unmapped, (a) => `<li><b>${esc(a.key)}</b> ${esc(a.text.slice(0, 90))}</li>`)}</div>
<div class="card"><h3>Tasks with no AC (${g.noAc.length})</h3><p class="sub">Fine for foundation or tooling.</p>${none(g.noAc, (t) => `<li><b>${esc(t.id)}</b> ${esc(t.title)} ${chip(t.status)}</li>`)}</div>
<div class="card"><h3>Planned, no contract yet (${g.planned.length})</h3>${none(g.planned, (t) => `<li><b>${esc(t.id)}</b> ${esc(t.title)}</li>`)}</div>
<div class="card"><h3>Done but ACs not checked (${g.unchecked.length})</h3>${none(g.unchecked, (x) => `<li><b>${esc(x.task.id)}</b> ${esc(x.acs.map((a) => a.id).join(", "))}</li>`)}</div></div>
<h2>Documents</h2><ul class="docs">${docs}</ul>
</main><script>
const q=document.getElementById("q");q.addEventListener("input",()=>{const v=q.value.toLowerCase();
document.querySelectorAll("[data-q]").forEach(e=>e.classList.toggle("hide",!e.dataset.q.includes(v)))});
</script></body></html>
`;
}

// ---------- main ----------

const read = (p) => readFileSync(p, "utf8");
const git = (...args) => {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
};
const files = (dir, re) =>
  readdirSync(dir, { recursive: true })
    .map(String)
    .filter((f) => re.test(basename(f)))
    .map((f) => join(dir, f));

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const docsDir = join(root, "docs");
  const tasksDir = join(docsDir, "tasks");
  // milestone = folder under docs/tasks: the root is v0.1, v0.2/ is v0.2
  const milestone = (f) => relative(tasksDir, dirname(f)).split(/[\\/]/)[0] || "v0.1";
  const readmes = files(tasksDir, /^README\.md$/).map((f) => ({
    ...parseReadme(read(f)),
    milestone: milestone(f),
  }));
  const contracts = files(tasksDir, /^[A-Za-z]+\d+[A-Za-z]*\.md$/).map((f) => ({
    ...parseContract(basename(f, ".md"), read(f)),
    milestone: milestone(f),
  }));
  const prds = {};
  const verifications = {};
  for (const f of files(join(docsDir, "prd"), /^PRD-\d+\.md$/)) {
    const id = basename(f, ".md");
    prds[id] = parsePrd(read(f));
    try {
      verifications[id] = parseVerification(read(join(docsDir, "prd", `${id}-verification.md`)));
    } catch {
      verifications[id] = {};
    }
  }
  const docs = ["prd", "tech", "decisions"]
    .flatMap((d) => files(join(docsDir, d), /^(PRD|TP|D)-\d+\.md$/))
    .map((f) => ({
      name: basename(f, ".md"),
      href: relative(docsDir, f).replaceAll("\\", "/"),
      ...parseDoc(read(f)),
    }));
  const model = buildModel({
    readmes,
    contracts,
    prds,
    verifications,
    prs: parsePrs(git("log", "--format=%s").split("\n")),
    docs,
    meta: {
      date: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
      branch: git("rev-parse", "--abbrev-ref", "HEAD") || "unknown",
      commit: git("rev-parse", "--short", "HEAD") || "unknown",
    },
  });
  writeFileSync(join(docsDir, "status.html"), renderHtml(model));
  const g = model.gaps;
  process.stdout.write(
    [
      `tasks: ${JSON.stringify(model.totals.tasks)}`,
      `ACs built: ${JSON.stringify(model.totals.build)}`,
      `ACs verified: ${JSON.stringify(model.totals.verification)}`,
      `gaps: ${g.unmapped.length} unmapped ACs, ${g.noAc.length} tasks without AC, ${g.planned.length} planned without contract, ${g.unchecked.length} done tasks with unchecked ACs`,
      "wrote docs/status.html",
      "",
    ].join("\n"),
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
