/* global document, localStorage, location, history, window */
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

export function buildModel({
  readmes,
  contracts,
  prds,
  verifications,
  prs,
  docs = [],
  contractMd = {},
  meta = {},
}) {
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
    contractMd,
    gaps,
    totals: {
      tasks: count(tasks, (t) => t.status),
      build: count(acs, (a) => a.build),
      verification: count(acs, (a) => a.verification),
    },
  };
}

// ---------- markdown and sections (pure; also injected into the page, so keep them self-contained) ----------

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

/** Small markdown renderer: headings, paragraphs, lists, tables, code, bold, italics, links. All source HTML is escaped. */
export function md(src) {
  const L = String(src ?? "")
    .replace(/\r/g, "")
    .split("\n");
  const link = (t, u) => {
    if (/^https?:\/\//i.test(u)) return `<a href="${u}" target="_blank" rel="noopener">${t}</a>`;
    if (u.startsWith("#")) return `<a href="${u}">${t}</a>`;
    const d = u.match(/(?:^|\/)((?:PRD|TP|D)-\d+)[^/]*\.md(?:#.*)?$/); // other documents open in the drawer
    return d ? `<a href="#doc-${d[1]}">${t}</a>` : t;
  };
  const inline = (s) => {
    const c = [];
    s = esc(s.replace(/`([^`]+)`/g, (_, x) => `${c.push(`<code>${esc(x)}</code>`) - 1}`));
    return s
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => link(t, u))
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/(^|[^\w*])\*(?!\s)([^*]+?)\*(?![\w*])/g, "$1<i>$2</i>")
      .replace(/(^|\W)_(?!\s)([^_]+?)_(?!\w)/g, "$1<i>$2</i>")
      .replace(/(\d+)/g, (_, i) => c[i]);
  };
  const cells = (l) =>
    l
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((x) => x.trim());
  const item = /^\s*(?:[-*+]|\d+[.)])\s+(.*)/;
  const hr = /^(-{3,}|\*{3,})\s*$/;
  const special = (l) => /^(#{1,6}\s|```|\s*\|)/.test(l) || hr.test(l) || item.test(l);
  const out = [];
  for (let i = 0; i < L.length;) {
    const l = L[i];
    let m;
    if (!l.trim()) i++;
    else if (/^```/.test(l)) {
      const code = [];
      for (i++; i < L.length && !/^```/.test(L[i]); i++) code.push(L[i]);
      i++;
      out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
    } else if ((m = l.match(/^(#{1,6})\s+(.*)/))) {
      out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
      i++;
    } else if (hr.test(l)) {
      out.push("<hr>");
      i++;
    } else if (/^\s*\|/.test(l) && /^\s*\|?\s*:?-{3,}/.test(L[i + 1] ?? "")) {
      const head = cells(l);
      const rows = [];
      for (i += 2; i < L.length && /^\s*\|/.test(L[i]); i++) rows.push(cells(L[i]));
      const tr = (r, t) => `<tr>${r.map((x) => `<${t}>${inline(x)}</${t}>`).join("")}</tr>`;
      out.push(
        `<div class="tw"><table><thead>${tr(head, "th")}</thead><tbody>${rows.map((r) => tr(r, "td")).join("")}</tbody></table></div>`,
      );
    } else if (item.test(l)) {
      const tag = /^\s*\d/.test(l) ? "ol" : "ul";
      const li = [];
      while (i < L.length && L[i].trim() && !/^(#{1,6}\s|```)/.test(L[i])) {
        const n = L[i].match(item);
        if (n) li.push(n[1]);
        else li[li.length - 1] += ` ${L[i].trim()}`;
        i++;
      }
      out.push(`<${tag}>${li.map((x) => `<li>${inline(x)}</li>`).join("")}</${tag}>`);
    } else {
      const p = [l.trim()];
      for (i++; i < L.length && L[i].trim() && !special(L[i]); i++) p.push(L[i].trim());
      out.push(`<p>${inline(p.join(" "))}</p>`);
    }
  }
  return out.join("\n");
}

/** Split markdown at every heading: [{ level, heading, md }] (md includes the heading line). */
export function splitSections(text) {
  const out = [];
  let cur = null;
  let fence = false;
  for (const line of String(text).split(/\r?\n/)) {
    if (/^```/.test(line)) fence = !fence;
    const h = !fence && line.match(/^(#{1,6})\s+(.*)/);
    if (h) out.push((cur = { level: h[1].length, heading: h[2].trim(), md: line }));
    else if (cur) cur.md += `\n${line}`;
  }
  return out;
}

/** Sections of `docs` ([{ name, md }]) whose text mentions task `id` as a whole word. */
export function findSections(id, docs) {
  const word = new RegExp(
    `(?<![A-Za-z0-9])${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9])`,
  );
  return docs.flatMap((d) =>
    splitSections(d.md)
      .filter((s) => word.test(s.md))
      .map((s) => ({ doc: d.name, ...s })),
  );
}

// ---------- rendering ----------

const chip = (s) => `<span class="chip ${tone(s)} s-${slug(s)}">${esc(s)}</span>`;
const prLink = (n) => (n ? `<a class="pr" href="${REPO_URL}/pull/${n}">#${n}</a>` : "");
const attrs = (o) =>
  Object.entries(o)
    .map(([k, v]) => ` data-${k}="${esc([].concat(v).join("|"))}"`)
    .join("");
const clk = (id) => ` data-open="${esc(id)}" role="button" tabindex="0" aria-expanded="false"`;
const taskChip = (t) =>
  `<a class="mini" href="#task-${esc(t.id)}" title="${esc(t.title)}">${esc(t.id)} ${chip(t.status)}</a>`;
const counts = (o) =>
  Object.entries(o)
    .map(([k, v]) => `<span class="stat">${chip(k)}<b>${v}</b></span>`)
    .join("");
const tally = (items) => {
  const o = {};
  for (const x of items) o[x] = (o[x] ?? 0) + 1;
  return Object.entries(o);
};
/** A collapsible section; `f` groups hold filterable `.it` items and show their visible count. */
const grp = (k, tag, label, n, body, cls = "", f = true) =>
  `<details class="grp ${cls}" data-k="${esc(k)}"${f ? " data-f" : ""} open><summary><${tag}>${label} <small><span class="n">${n}</span></small></${tag}></summary>${body}</details>`;
const none = (items, f) =>
  items.length ? `<ul class="plain">${items.map(f).join("")}</ul>` : `<p class="sub">None.</p>`;
const safeJson = (o) => JSON.stringify(o).replace(/</g, "\\u003c");

/** Runs in the browser: filters, collapsing, drawer. */
function client(D) {
  const $ = (s, r = document) => [...r.querySelectorAll(s)];
  const KEY = "openphysio-status";
  const G = ["ms", "lane", "st", "build", "ver"];
  let S = { f: {}, q: "", open: {} };
  try {
    S = { ...S, ...JSON.parse(localStorage.getItem(KEY)) };
    S.f = S.f && typeof S.f === "object" ? S.f : {};
    S.open = S.open && typeof S.open === "object" ? S.open : {};
  } catch {
    /* no storage: the page still works */
  }
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(S));
    } catch {
      /* no storage */
    }
  };
  const f = (g) => (Array.isArray(S.f[g]) ? S.f[g] : (S.f[g] = []));
  const q = document.getElementById("q");

  const apply = () => {
    const text = String(S.q).trim().toLowerCase();
    const on = text || G.some((g) => f(g).length);
    for (const b of $(".pill")) {
      const a = f(b.dataset.g).includes(b.dataset.v);
      b.classList.toggle("on", a);
      b.setAttribute("aria-pressed", a);
    }
    for (const e of $(".it")) {
      const ok =
        e.dataset.q.includes(text) &&
        G.every(
          (g) => !f(g).length || (e.dataset[g] ?? "").split("|").some((x) => f(g).includes(x)),
        );
      e.classList.toggle("hide", !ok);
    }
    for (const d of $(".grp[data-f]")) {
      const n = $(".it:not(.hide)", d).length;
      d.querySelector(".n").textContent = n;
      d.classList.toggle("hide", Boolean(on) && !n);
    }
  };
  q.value = S.q;
  q.addEventListener("input", () => {
    S.q = q.value;
    save();
    apply();
  });
  document.addEventListener("click", (e) => {
    const p = e.target.closest(".pill");
    if (p) {
      const a = f(p.dataset.g);
      const i = a.indexOf(p.dataset.v);
      if (i < 0) a.push(p.dataset.v);
      else a.splice(i, 1);
      save();
      apply();
    } else if (e.target.closest("#clear")) {
      S.f = {};
      S.q = q.value = "";
      save();
      apply();
    } else if (e.target.closest("#expand") || e.target.closest("#collapse")) {
      const open = Boolean(e.target.closest("#expand"));
      for (const d of $("details.grp")) d.open = open;
    }
  });
  for (const d of $("details.grp")) if (S.open[d.dataset.k] === false) d.open = false;
  document.addEventListener(
    "toggle",
    (e) => {
      if (e.target.dataset?.k) {
        S.open[e.target.dataset.k] = e.target.open;
        save();
      }
    },
    true,
  );
  apply();

  // ----- drawer -----
  const dr = document.getElementById("dr");
  const bd = document.getElementById("bd");
  const dt = document.getElementById("dt");
  const dc = document.getElementById("dc");
  const chipH = (s) => `<span class="chip ${tone(s)} s-${slug(s)}">${esc(s)}</span>`;
  const acHash = (k) => `ac-${k.replace("/", "-")}`;
  const taskLink = (id) =>
    D.tasks[id]
      ? `<a class="mini" href="#task-${esc(id)}">${esc(id)} ${chipH(D.tasks[id].status)}</a>`
      : esc(id);
  const docLink = (name) => `<a href="#doc-${esc(name)}">${esc(name)}</a>`;
  const view = {
    task(id) {
      const t = D.tasks[id];
      if (!t) return null;
      const tech = Object.entries(D.docs)
        .filter(([, d]) => d.kind === "tech")
        .map(([name, d]) => ({ name, md: d.md }));
      const secs = findSections(id, tech);
      const acs = t.acs.map((k) => D.acs[k]).filter(Boolean);
      return {
        title: `${id}: ${t.title}`,
        html: `<p class="meta">${chipH(t.status)} ${
          t.pr ? `<a class="pr" href="${D.repo}/pull/${t.pr}">PR #${t.pr}</a>` : ""
        } <span class="sub">${esc(t.milestone)} · ${esc(t.lane)}${t.wave ? ` · wave ${esc(t.wave)}` : ""}</span></p>
<dl><dt>Needs</dt><dd>${t.needs?.length ? t.needs.map(taskLink).join(" ") : "nothing"}</dd>
<dt>Size</dt><dd>${esc(t.size || "-")}</dd><dt>Done when</dt><dd>${esc(t.doneWhen || "-")}</dd></dl>
<h3>Contract</h3>${D.contracts[id] ? `<div class="md">${md(D.contracts[id])}</div>` : `<p class="sub">No contract yet.</p>`}
<h3>Acceptance criteria</h3>${
          acs.length
            ? `<ul class="alist">${acs
                .map(
                  (a) =>
                    `<li><a href="#${acHash(a.key)}"><b>${esc(a.key)}</b></a> ${esc(a.text)}</li>`,
                )
                .join("")}</ul>`
            : `<p class="sub">No acceptance criteria covered.</p>`
        }
<h3>Plan sections mentioning ${esc(id)}</h3>${
          secs.length
            ? secs
                .map(
                  (s) =>
                    `<p class="sub">From ${docLink(s.doc)}</p><div class="md sec">${md(s.md)}</div>`,
                )
                .join("")
            : `<p class="sub">No plan section mentions ${esc(id)}.</p>`
        }`,
      };
    },
    ac(h) {
      const a = Object.values(D.acs).find((x) => acHash(x.key) === `ac-${h}`);
      if (!a) return null;
      const prd = D.docs[a.prd];
      const ctx = prd
        ? splitSections(prd.md).filter((s) => /problem|desired outcome|exclusion/i.test(s.heading))
        : [];
      return {
        title: a.key,
        html: `<p class="meta">${chipH(a.build)} ${chipH(a.verification)}</p>
<p class="lead">${esc(a.text)}</p>
<h3>Covering tasks</h3><p>${a.tasks.length ? a.tasks.map(taskLink).join(" ") : `<span class="sub">No task covers this AC.</span>`}</p>
<h3>Verification</h3><dl><dt>Status</dt><dd>${chipH(a.verification)}</dd>
<dt>Where</dt><dd>${esc(a.where || "-")}</dd><dt>Date</dt><dd>${esc(a.date || "-")}</dd>
<dt>Evidence</dt><dd>${esc(a.evidence || "-")}</dd><dt>Note</dt><dd>${esc(a.note || "-")}</dd></dl>
<h3>${prd ? `${docLink(a.prd)}: ${esc(prd.title)}` : esc(a.prd)}</h3>${
          prd ? `<p class="meta">${prd.status ? chipH(prd.status.slice(0, 40)) : ""}</p>` : ""
        }${ctx.map((s) => `<div class="md sec">${md(s.md)}</div>`).join("")}`,
      };
    },
    doc(name) {
      const d = D.docs[name];
      return (
        d && {
          title: d.title.startsWith(name) ? d.title : `${name}: ${d.title}`,
          html: `<p class="meta">${d.status ? chipH(d.status.slice(0, 40)) : ""} <a class="sub" href="${esc(d.href)}">source file</a></p><div class="md">${md(d.md)}</div>`,
        }
      );
    },
  };
  let last = null;
  const sync = () => {
    const hash = decodeURIComponent(location.hash.slice(1));
    const m = hash.match(/^(task|ac|doc)-(.+)$/);
    const v = m && view[m[1]](m[2]);
    for (const e of $("[data-open]"))
      e.setAttribute("aria-expanded", String(Boolean(v) && e.dataset.open === hash));
    const wasOpen = dr.classList.contains("open");
    if (v) {
      if (!wasOpen) last = document.activeElement;
      dt.textContent = v.title;
      dc.innerHTML = v.html;
      dc.scrollTop = 0;
    } else if (wasOpen && last?.isConnected) last.focus();
    dr.classList.toggle("open", Boolean(v));
    if (v && !wasOpen) document.getElementById("dx").focus();
    bd.classList.toggle("open", Boolean(v));
    document.body.classList.toggle("lock", Boolean(v));
  };
  const close = () => {
    history.replaceState(null, "", location.pathname + location.search);
    sync();
  };
  window.addEventListener("hashchange", sync);
  bd.addEventListener("click", close);
  document.getElementById("dx").addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dr.classList.contains("open")) close();
    else if ((e.key === "Enter" || e.key === " ") && e.target.matches?.("[data-open]")) {
      e.preventDefault();
      location.hash = e.target.dataset.open;
    }
  });
  document.addEventListener("click", (e) => {
    const c = e.target.closest("[data-open]");
    if (c && !e.target.closest("a")) location.hash = c.dataset.open;
  });
  sync();
}

const CSS = `
:root{--bg:#f6f7f9;--card:#fff;--fg:#1c2330;--sub:#667085;--line:#e3e6ec;--acc:#4338ca;--accfg:#fff;--ok:#157f4b;--okb:#dcf5e7;--info:#4338ca;--infob:#e5e7ff;--warn:#9a5b00;--warnb:#fdeccb;--bad:#b42318;--badb:#fde2e0;--ready:#0e7490;--readyb:#d3f2f8;--mute:#475467;--muteb:#eaecf0;--code:#f0f2f6}
@media(prefers-color-scheme:dark){:root{--bg:#0f1319;--card:#171c25;--fg:#e6e9ef;--sub:#98a2b3;--line:#2a313d;--acc:#a5b4fc;--accfg:#0f1319;--ok:#6ee7a8;--okb:#12382a;--info:#a5b4fc;--infob:#25285a;--warn:#fcd34d;--warnb:#3d2d09;--bad:#fda29b;--badb:#4a1b17;--ready:#67e8f9;--readyb:#0c3540;--mute:#cbd5e1;--muteb:#2a313d;--code:#222936}}
*{box-sizing:border-box}body{margin:0;padding:24px 16px 64px;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}body.lock{overflow:hidden}
main{max-width:1280px;margin:auto}h1{margin:0;font-size:28px;letter-spacing:-.02em}h2{margin:0;font-size:20px;letter-spacing:-.01em}h3{margin:0;font-size:16px}h3 small,h2 small{color:var(--sub);font-weight:400;margin-left:6px}
a{color:var(--info)}.sub{color:var(--sub);font-size:13px}.plain{list-style:none;margin:0;padding:0;display:grid;gap:8px}
header .sub{margin-top:4px}.stats{display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:16px}.stat{display:inline-flex;gap:6px;align-items:center}
.bar{position:sticky;top:0;z-index:10;margin:16px -16px 0;padding:10px 16px;display:grid;gap:8px;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.row .sp{flex:1}
#q{flex:1 1 220px;max-width:360px;padding:7px 14px;border-radius:99px;border:1px solid var(--line);background:var(--card);color:var(--fg);font:inherit}
.fg{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.fl{width:76px;flex:none;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--sub)}
.pill,.btn{font:inherit;font-size:13px;line-height:1.3;padding:3px 12px;border-radius:99px;border:1px solid var(--line);background:var(--card);color:var(--fg);cursor:pointer;white-space:nowrap;transition:background .15s,color .15s,border-color .15s}
.pill b{margin-left:4px;font-weight:600;opacity:.65}.pill:hover,.btn:hover{border-color:var(--acc)}
.pill.on{background:var(--acc);border-color:var(--acc);color:var(--accfg)}.pill.on b{opacity:.85}
.pill:focus-visible,.btn:focus-visible,#q:focus-visible,summary:focus-visible,.clk:focus-visible,#dx:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
.card,.task,.ac,.col,.wrow{background:var(--card);border:1px solid var(--line);border-radius:12px}.task,.ac{padding:10px 12px}
.clk{cursor:pointer;transition:border-color .15s,box-shadow .15s,transform .15s}.clk:hover{border-color:var(--acc);box-shadow:0 2px 10px rgb(0 0 0/.08);transform:translateY(-1px)}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}.streams{align-items:start}.col{padding:4px 12px 12px;background:transparent;border:0}
summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;padding:6px 0;border-radius:6px}summary::-webkit-details-marker{display:none}
summary::before{content:"";flex:none;width:7px;height:7px;border-right:2px solid var(--sub);border-bottom:2px solid var(--sub);transform:rotate(-45deg);transition:transform .15s}
details[open]>summary::before{transform:rotate(45deg)}.grp.sec{margin-top:32px}.grp.ms{margin-top:12px}.grp>.grid,.grp>.plain,.grp>.wrow,.grp>.docs,.grp>.sub{margin-top:6px}
.top{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:2px}.wave{margin-left:auto;color:var(--sub);font-size:12px}.pr{font-size:13px}
.chip{display:inline-block;padding:1px 9px;border-radius:99px;font-size:12px;font-weight:600;white-space:nowrap}
.ok{color:var(--ok);background:var(--okb)}.info{color:var(--info);background:var(--infob)}.warn{color:var(--warn);background:var(--warnb)}.bad{color:var(--bad);background:var(--badb)}.ready{color:var(--ready);background:var(--readyb)}.mute{color:var(--mute);background:var(--muteb)}
.s-planned{background:transparent;outline:1px dashed var(--sub)}.s-cancelled{text-decoration:line-through}
.acs{grid-template-columns:repeat(auto-fill,minmax(340px,1fr))}.unmapped{border-color:var(--bad);box-shadow:0 0 0 2px var(--badb)}
.tasks,.wrow div{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.mini{display:inline-flex;gap:4px;align-items:center;font-size:12px;border:1px solid var(--line);border-radius:8px;padding:1px 6px;color:var(--fg);text-decoration:none}.mini:hover{border-color:var(--acc)}
.wrow{display:grid;grid-template-columns:130px 1fr;gap:8px;padding:8px 12px;margin-bottom:8px;align-items:start}.wrow div{margin:0}
.gaps{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));margin-top:6px}.gaps .card{padding:6px 16px 14px}
.hide{display:none!important}ul.docs{padding-left:18px}
#bd{position:fixed;inset:0;z-index:20;background:rgb(0 0 0/.45);opacity:0;visibility:hidden;transition:opacity .28s,visibility 0s linear .28s}#bd.open{opacity:1;visibility:visible;transition:opacity .28s,visibility 0s}
#dr{position:fixed;top:0;right:0;bottom:0;z-index:30;width:min(760px,100%);display:flex;flex-direction:column;background:var(--card);border-left:1px solid var(--line);box-shadow:-12px 0 32px rgb(0 0 0/.18);transform:translateX(100%);visibility:hidden;transition:transform .3s cubic-bezier(.2,.8,.2,1),visibility 0s linear .3s}
#dr.open{transform:none;visibility:visible;transition:transform .3s cubic-bezier(.2,.8,.2,1),visibility 0s}
#dr header{display:flex;gap:12px;align-items:flex-start;padding:16px 20px;border-bottom:1px solid var(--line)}#dr header h2{flex:1;font-size:18px;line-height:1.3}
#dx{flex:none;width:34px;height:34px;border-radius:99px;border:1px solid var(--line);background:var(--bg);color:var(--fg);font-size:20px;line-height:1;cursor:pointer}#dx:hover{border-color:var(--acc)}
#dc{flex:1;overflow:auto;padding:8px 20px 48px;overscroll-behavior:contain}#dc h3{margin:24px 0 8px;font-size:15px;padding-top:12px;border-top:1px solid var(--line)}.meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}.lead{font-size:17px;line-height:1.5;max-width:68ch}
dl{display:grid;grid-template-columns:90px 1fr;gap:6px 12px;margin:8px 0}dt{color:var(--sub);font-size:13px}dd{margin:0;max-width:68ch}.alist{padding-left:18px;max-width:68ch}.alist li{margin:6px 0}
.md{max-width:68ch;line-height:1.65}.md h1{font-size:22px;margin:20px 0 8px}.md h2{font-size:18px;margin:20px 0 8px}.md h3,#dc .md h3{font-size:15px;margin:16px 0 6px;padding:0;border:0}.md h4,.md h5,.md h6{font-size:14px;margin:14px 0 4px}
.md p{margin:8px 0}.md ul,.md ol{padding-left:22px;margin:8px 0}.md li{margin:3px 0}.md hr{border:0;border-top:1px solid var(--line);margin:16px 0}
.md code{background:var(--code);padding:1px 5px;border-radius:5px;font:.88em ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.md pre{background:var(--code);padding:12px 14px;border-radius:10px;overflow:auto;max-width:100%}.md pre code{background:none;padding:0}
.md .tw{overflow-x:auto;margin:12px 0;max-width:100%;border:1px solid var(--line);border-radius:10px}.md table{border-collapse:collapse;width:100%;font-size:13.5px;line-height:1.45}
.md th,.md td{padding:7px 12px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}.md th{background:var(--code);font-weight:600;white-space:nowrap}.md tbody tr:last-child td{border-bottom:0}.md tbody tr:nth-child(even){background:color-mix(in srgb,var(--code) 45%,transparent)}
.md.sec{padding:2px 14px 6px;border-left:3px solid var(--line);margin:6px 0 14px}
@media(max-width:700px){.bar{position:static;margin-inline:0;padding-inline:0}.fg{flex-wrap:nowrap;overflow-x:auto;padding-bottom:2px}.fl{width:auto}.wrow{grid-template-columns:1fr}
#dr{width:100%;border:0;transform:translateY(100%)}#dr.open{transform:none}#dc,#dr header{padding-inline:16px}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important;scroll-behavior:auto!important}}
`;

export function renderHtml(m) {
  const contracts = m.contractMd ?? {};
  const acsOf = (t) => m.acs.filter((a) => a.tasks.some((x) => x.id === t.id));
  const taskAttrs = (t) => {
    const a = acsOf(t);
    return attrs({
      ms: t.milestone,
      lane: t.lane,
      st: t.status,
      build: a.map((x) => x.build),
      ver: a.map((x) => x.verification),
    });
  };
  const acAttrs = (a) =>
    attrs({
      ms: a.tasks.map((t) => t.milestone),
      lane: a.tasks.map((t) => t.lane),
      st: a.tasks.map((t) => t.status),
      build: a.build,
      ver: a.verification,
    });
  const q = (s) => ` data-q="${esc(s.toLowerCase())}"`;
  const taskRow = (
    t,
    body,
  ) => `<li class="task it clk"${q(`${t.id} ${t.title}`)}${taskAttrs(t)}${clk(`task-${t.id}`)}>
  ${
    body ??
    `<div class="top"><b>${esc(t.id)}</b>${chip(t.status)}${prLink(t.pr)}${t.wave !== undefined ? `<span class="wave">wave ${esc(t.wave.split(" ")[0])}</span>` : ""}</div>
  <div>${esc(t.title)}</div>
  <div class="sub">${t.needs?.length ? `needs ${esc(t.needs.join(", "))}` : "no dependencies"}${t.acs.length ? ` · ${esc(t.acs.map((a) => a.replace(`${t.prd}/`, "")).join(", "))}` : ""}</div>`
  }</li>`;
  const gapTask = (t, extra = "") => taskRow(t, `<b>${esc(t.id)}</b> ${esc(t.title)} ${extra}`);

  const streams = [...new Set(m.tasks.map((t) => t.milestone))]
    .map((ms) => {
      const inMs = m.tasks.filter((t) => t.milestone === ms);
      const cols = [...new Set(inMs.map((t) => t.lane))]
        .map((l) => {
          const ts = inMs.filter((t) => t.lane === l);
          return grp(
            `col-${ms}-${l}`,
            "h3",
            esc(l),
            ts.length,
            `<ul class="plain">${ts.map((t) => taskRow(t)).join("")}</ul>`,
            "col",
          );
        })
        .join("");
      return grp(
        `ms-${ms}`,
        "h3",
        esc(ms),
        inMs.length,
        `<div class="grid streams">${cols}</div>`,
        "ms",
      );
    })
    .join("");
  const waves = m.waves
    .map(
      (w) =>
        `<div class="wrow"><b>${esc(w.milestone)} · wave ${esc(w.wave)}</b><div>${w.tasks
          .map((id) => m.tasks.find((t) => t.id === id) ?? { id, title: "", status: "Planned" })
          .map(taskChip)
          .join("")}</div></div>`,
    )
    .join("");
  const trace = Object.entries(m.prds)
    .map(([id, prd]) => {
      const mine = m.acs.filter((a) => a.prd === id);
      const rows = mine
        .map(
          (
            a,
          ) => `<div class="ac it clk${a.build === "Unmapped" ? " unmapped" : ""}"${q(`${a.key} ${a.text}`)}${acAttrs(a)}${clk(`ac-${a.key.replace("/", "-")}`)}>
  <div class="top"><b>${esc(a.id)}</b>${chip(a.build)}${chip(a.verification)}</div>
  <div>${esc(a.text)}</div>
  <div class="tasks">${a.tasks.length ? a.tasks.map(taskChip).join("") : '<span class="sub">no tasks</span>'}</div>
  ${a.evidence || a.note ? `<div class="sub">${esc([a.where, a.date].filter(Boolean).join(" · "))} ${esc(a.evidence)} ${esc(a.note)}</div>` : ""}</div>`,
        )
        .join("");
      return grp(
        `prd-${id}`,
        "h3",
        `${esc(id)} <small>${esc(prd.title)} · ${esc(prd.status)}</small>`,
        mine.length,
        `<div class="grid acs">${rows}</div>`,
      );
    })
    .join("");
  const g = m.gaps;
  const acGap = (a) =>
    `<li class="it clk"${q(`${a.key} ${a.text}`)}${acAttrs(a)}${clk(`ac-${a.key.replace("/", "-")}`)}><b>${esc(a.key)}</b> ${esc(a.text.slice(0, 90))}</li>`;
  const gapList = (k, title, items, f, note = "") =>
    grp(`gap-${k}`, "h3", title, items.length, `${note}${none(items, f)}`, "card");
  const gapsHtml = `<div class="gaps">
${gapList("unmapped", "ACs with no task", g.unmapped, acGap)}
${gapList("noac", "Tasks with no AC", g.noAc, (t) => gapTask(t, chip(t.status)), '<p class="sub">Fine for foundation or tooling.</p>')}
${gapList("planned", "Planned, no contract yet", g.planned, (t) => gapTask(t))}
${gapList("unchecked", "Done but ACs not checked", g.unchecked, (x) => gapTask(x.task, esc(x.acs.map((a) => a.id).join(", "))))}</div>`;
  const docItem = (d) =>
    `<li><a href="#doc-${esc(d.name)}">${esc(d.name)}</a> <span class="sub">${esc(d.title)}</span> ${d.status ? chip(d.status.slice(0, 40)) : ""} <a class="sub" href="${esc(d.href)}">source</a></li>`;

  const pills = (g, label, entries) =>
    `<div class="fg" role="group" aria-label="${label}"><span class="fl">${label}</span>${entries
      .map(
        ([v, n]) =>
          `<button type="button" class="pill" data-g="${g}" data-v="${esc(v)}" aria-pressed="false">${esc(v)}<b>${n}</b></button>`,
      )
      .join("")}</div>`;
  const byState = ([a], [b]) =>
    STATES.concat("Planned").indexOf(a) - STATES.concat("Planned").indexOf(b);
  const bar = `<div class="bar" role="search">
<div class="row"><input id="q" type="search" placeholder="Filter tasks and ACs" aria-label="Filter tasks and ACs">
<button type="button" class="btn" id="clear">Clear filters</button><span class="sp"></span>
<button type="button" class="btn" id="expand">Expand all</button><button type="button" class="btn" id="collapse">Collapse all</button></div>
${pills("ms", "Milestone", tally(m.tasks.map((t) => t.milestone)))}
${pills("lane", "Lane", tally(m.tasks.map((t) => t.lane)))}
${pills("st", "Task status", Object.entries(m.totals.tasks).sort(byState))}
${pills("build", "AC build", Object.entries(m.totals.build))}
${pills("ver", "AC verified", Object.entries(m.totals.verification))}</div>`;

  const data = {
    repo: REPO_URL,
    contracts,
    tasks: Object.fromEntries(
      m.tasks.map((t) => [
        t.id,
        {
          title: t.title,
          status: t.status,
          lane: t.lane,
          milestone: t.milestone,
          wave: t.wave,
          pr: t.pr,
          needs: t.needs,
          size: t.size,
          doneWhen: t.doneWhen,
          acs: t.acs,
        },
      ]),
    ),
    acs: Object.fromEntries(
      m.acs.map((a) => [
        a.key,
        {
          key: a.key,
          prd: a.prd,
          text: a.text,
          build: a.build,
          verification: a.verification,
          where: a.where,
          date: a.date,
          evidence: a.evidence,
          note: a.note,
          tasks: a.tasks.map((t) => t.id),
        },
      ]),
    ),
    docs: Object.fromEntries(
      m.docs.map((d) => [
        d.name,
        { kind: d.kind, title: d.title, status: d.status, href: d.href, md: d.md ?? "" },
      ]),
    ),
  };
  const { meta } = m;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>OpenPhysio status</title>
<style>${CSS}</style></head><body><main>
<header><h1>OpenPhysio status</h1>
<div class="sub">Generated ${esc(meta.date)} · branch ${esc(meta.branch)} · commit ${esc(meta.commit)}</div>
<div class="stats"><span class="sub">Tasks</span>${counts(m.totals.tasks)}</div>
<div class="stats"><span class="sub">ACs built</span>${counts(m.totals.build)}</div>
<div class="stats"><span class="sub">ACs verified</span>${counts(m.totals.verification)}</div></header>
${bar}
${grp("work", "h2", "Work streams", m.tasks.length, streams, "sec")}
${grp("waves", "h2", "Parallel waves", m.waves.length, waves, "sec", false)}
${grp("trace", "h2", "Traceability", m.acs.length, trace, "sec")}
${grp("gaps", "h2", "Gaps", g.unmapped.length + g.noAc.length + g.planned.length + g.unchecked.length, gapsHtml, "sec")}
${grp("docs", "h2", "Documents", m.docs.length, `<ul class="docs">${m.docs.map(docItem).join("")}</ul>`, "sec", false)}
</main>
<div id="bd"></div>
<aside id="dr" role="dialog" aria-modal="true" aria-labelledby="dt"><header><h2 id="dt"></h2><button type="button" id="dx" aria-label="Close">&times;</button></header><div id="dc"></div></aside>
<script type="application/json" id="data">${safeJson(data)}</script>
<script>
const esc=${esc},slug=${slug},tone=${tone},md=${md},splitSections=${splitSections},findSections=${findSections};
(${client})(JSON.parse(document.getElementById("data").textContent));
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
  const docs = [
    ["prd", "prd"],
    ["tech", "tech"],
    ["decisions", "decision"],
  ].flatMap(([dir, kind]) =>
    files(join(docsDir, dir), /^(PRD|TP|D)-\d+.*\.md$/)
      .filter((f) => !/verification/.test(f))
      .map((f) => {
        const md = read(f);
        return {
          name: basename(f).match(/^(PRD|TP|D)-\d+/)[0],
          kind,
          href: relative(docsDir, f).replaceAll("\\", "/"),
          md,
          ...parseDoc(md),
        };
      }),
  );
  const contractMd = Object.fromEntries(
    files(tasksDir, /^[A-Za-z]+\d+[A-Za-z]*\.md$/).map((f) => [basename(f, ".md"), read(f)]),
  );
  const model = buildModel({
    readmes,
    contracts,
    prds,
    verifications,
    prs: parsePrs(git("log", "--format=%s").split("\n")),
    docs,
    contractMd,
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
