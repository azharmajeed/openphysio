// Builds the self-contained review page (K6a): static HTML, inline CSS and JS, no network calls.
import { validate } from "./validate.ts";
import { recordId, toData } from "./review.ts";
import type { DataFile, Rec } from "./review.ts";

type Any = Record<string, unknown> & Rec;
const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const list = (v: unknown) => ((v as string[] | undefined) ?? []).join(", ");

const CHECK: Record<string, string> = {
  sources: "Is this a real, reputable source? Does the link open, and does the licence allow us to cite it?",
  muscles: "Do the name, actions and everyday role match the cited claims?",
  muscleGroups: "Are these the right muscles for this group?",
  exerciseMuscles: "Does the source support this muscle doing this job in this exercise?",
  cues: "Does the source support this cue? Is it short, clear and safe to say out loud?",
  faults: "Is this a real fault for this exercise, and is the linked cue the right fix?",
  claims: "Does the source support this statement in our own words? Is the grade right?",
  videoSegments: "Does this part of the video show what the summary says?",
};

/** Plain-words fields per record type: [label, value]. Empty values are skipped. */
function fields(kind: string, r: Any): [string, unknown][] {
  switch (kind) {
    case "sources":
      return [["Citation", r.citation], ["Type", r.type], ["Year", r.year]];
    case "muscles":
      return [
        ["Name", r.name], ["Also called", list(r.aliases)], ["Region", r.region],
        ["Body-map area", r.bodyMapArea], ["Actions", list(r.actions)],
        ["In daily life", r.dailyLifeRole], ["Starts at", r.origin], ["Ends at", r.insertion],
      ];
    case "muscleGroups":
      return [["Name", r.name], ["Muscles", list(r.muscleIds)]];
    case "exerciseMuscles":
      return [["Exercise", r.exerciseId], ["Muscle", r.muscleId], ["Role", r.role]];
    case "cues":
      return [["Cue", `"${r.text}"`], ["Exercise", r.exerciseId], ["Phase", r.phase]];
    case "faults":
      return [["Fault", r.description], ["Why it matters", r.whyItMatters], ["Exercise", r.exerciseId], ["Severity", r.severity]];
    case "claims":
      return [["Claim", r.text], ["Grade", `${r.grade} (A guideline, B review or trial, C convention)`], ["About", list(r.subjects)]];
    default:
      return [["Title", r.title], ["Summary", r.summary], ["Video", r.videoId], ["From", r.endSec === undefined ? `${r.startSec}s to the end` : `${r.startSec}s to ${r.endSec}s`]];
  }
}

const link = (url: string, text = url) =>
  /^https?:\/\//.test(url) ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>` : esc(text);

function sourceHtml(s: Any): string {
  const links = [
    s.url && link(s.url as string),
    s.doi && link(`https://doi.org/${s.doi}`, `DOI ${s.doi}`),
    s.pmid && link(`https://pubmed.ncbi.nlm.nih.gov/${s.pmid}/`, `PubMed ${s.pmid}`),
  ].filter(Boolean);
  const st = s.review.state;
  return `<div class="src"><b>Source ${esc(s.id)}</b>: ${esc(s.citation)} (${esc(s.year)}). Licence: ${esc(s.licence)}.
${links.join(" &middot; ")} <span class="pill ${esc(st)}">source is ${esc(st)}</span></div>`;
}

export function buildReviewPage(files: DataFile[]): string {
  const problems = validate(toData(files));
  const byId = new Map<string, Any>();
  for (const f of files) for (const r of f.records) byId.set(recordId(r), r as Any);
  // validate() messages start with the record id and a colon
  const problemsFor = (id: string) => problems.filter((p) => p.startsWith(`${id}:`));
  const loose = problems.filter((p) => ![...byId.keys()].some((id) => p.startsWith(`${id}:`)));

  const card = (f: DataFile, r: Any) => {
    const id = recordId(r);
    const rows = fields(f.kind, r)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`)
      .join("");
    const refs: string[] = [];
    const src = f.kind === "sources" ? undefined : byId.get(r.sourceId as string);
    if (r.cueId) {
      const c = byId.get(r.cueId as string);
      refs.push(`<div class="ref"><b>Fixed by cue ${esc(r.cueId)}</b>: ${c ? esc(`"${c.text}"`) : "missing"}</div>`);
    }
    for (const cid of (r.claims as string[] | undefined) ?? []) {
      const c = byId.get(cid);
      refs.push(`<div class="ref"><b>Claim ${esc(cid)}</b>: ${c ? esc(c.text) : "missing"}</div>`);
    }
    if (f.kind === "exerciseMuscles")
      refs.push(`<div class="ref"><b>Muscle</b>: ${esc(byId.get(r.muscleId as string)?.name ?? r.muscleId)}</div>`);
    const probs = problemsFor(id);
    const { state, notes = "", reviewer, date } = r.review;
    return `<article class="card" data-file="${esc(f.file)}" data-id="${esc(id)}" data-state="${esc(state)}">
<header><h3>${esc(id)}</h3><span class="pill ${esc(state)}">${esc(state)}</span>${reviewer ? `<span class="sub">by ${esc(reviewer)}, ${esc(date ?? "")}</span>` : ""}</header>
<dl>${rows}</dl>
${src ? sourceHtml(src) : r.sourceId ? `<div class="src bad">Source ${esc(r.sourceId)} not found</div>` : ""}
${refs.join("")}
${probs.length ? `<ul class="probs">${probs.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}
<p class="check"><b>What to check:</b> ${esc(CHECK[f.kind])}</p>
<div class="acts">
<button class="btn" data-s="source-checked">source-checked</button>
<button class="btn" data-s="rejected">rejected</button>
<button class="btn" data-s="draft">leave as draft</button>
<span class="choice sub"></span></div>
<textarea placeholder="Notes (why rejected, what to fix)" rows="2">${esc(notes)}</textarea>
<details><summary class="sub">Raw JSON</summary><pre>${esc(JSON.stringify(r, null, 2))}</pre></details>
</article>`;
  };

  const sections = files
    .map((f) => `<section><h2>${esc(f.file)} <small>${f.records.length}</small></h2>${f.records.map((r) => card(f, r as Any)).join("\n")}</section>`)
    .join("\n");
  const opts = (xs: string[]) => xs.map((x) => `<option>${esc(x)}</option>`).join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>OpenPhysio knowledge review</title><style>${CSS}</style></head><body><main>
<h1>Knowledge review</h1>
<p class="sub">For each entry: open the source link, check it supports the entry, then choose. Choices are kept in this browser. When done, click Download decisions.</p>
${loose.length ? `<ul class="probs"><li>${loose.map(esc).join("</li><li>")}</li></ul>` : ""}
<div class="bar">
<select id="ff"><option value="">All files</option>${opts(files.map((f) => f.file))}</select>
<select id="fs"><option value="">All states</option>${opts(["draft", "source-checked", "clinician-reviewed", "rejected"])}</select>
<label><input type="checkbox" id="fn"> Needs a decision</label>
<span id="count" class="sub"></span>
<button class="btn" id="dl">Download decisions</button>
</div>
${sections}
</main><script>${JS}</script></body></html>`;
}

const CSS = `:root{--bg:#f6f7f9;--card:#fff;--fg:#1c2330;--sub:#667085;--line:#e3e6ec;--acc:#4338ca;--ok:#157f4b;--bad:#b42318;--code:#f0f2f6}
@media(prefers-color-scheme:dark){:root{--bg:#0f1319;--card:#171c25;--fg:#e6e9ef;--sub:#98a2b3;--line:#2a313d;--acc:#a5b4fc;--ok:#6ee7a8;--bad:#fda29b;--code:#222936}}
*{box-sizing:border-box}body{margin:0;padding:24px 16px 64px;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,"Segoe UI",sans-serif}
main{max-width:860px;margin:auto}h1{margin:0 0 4px}h2{margin:28px 0 8px;font-size:18px}h3{margin:0;font-size:16px}a{color:var(--acc)}.sub{color:var(--sub);font-size:13px}
.bar{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:10px 0;background:var(--bg);border-bottom:1px solid var(--line)}
select,textarea,.btn{font:inherit;color:var(--fg);background:var(--card);border:1px solid var(--line);border-radius:8px;padding:5px 10px}textarea{width:100%;margin-top:8px}
.btn{cursor:pointer}.btn:hover{border-color:var(--acc)}.btn.on{background:var(--acc);border-color:var(--acc);color:var(--bg)}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 16px;margin:10px 0}.card.hide{display:none}
.card header{display:flex;gap:10px;align-items:center;flex-wrap:wrap}dl{display:grid;grid-template-columns:110px 1fr;gap:4px 12px;margin:10px 0}dt{color:var(--sub);font-size:13px}dd{margin:0}
.pill{font-size:12px;padding:1px 10px;border-radius:99px;border:1px solid var(--line)}.pill.source-checked,.pill.clinician-reviewed{color:var(--ok)}.pill.rejected{color:var(--bad)}
.src,.ref{font-size:14px;background:var(--code);border-radius:8px;padding:6px 10px;margin:6px 0}.bad,.probs{color:var(--bad)}.probs{font-size:14px}
.check{margin:8px 0;font-size:14px}.acts{display:flex;flex-wrap:wrap;gap:8px;align-items:center}pre{background:var(--code);padding:10px;border-radius:8px;overflow:auto;font-size:12px}`;

const JS = `
const KEY="openphysio-review-choices";
let ch={};try{ch=JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(ch))}catch(e){}};
const cards=[...document.querySelectorAll(".card")];
const k=c=>c.dataset.file+"|"+c.dataset.id;
const $=id=>document.getElementById(id);
function paint(c){const x=ch[k(c)];
 c.querySelectorAll(".btn[data-s]").forEach(b=>b.classList.toggle("on",!!x&&x.state===b.dataset.s));
 c.querySelector(".choice").textContent=x?"Your choice: "+x.state:"No choice yet";}
function filter(){let n=0;for(const c of cards){
 const show=(!$("ff").value||c.dataset.file===$("ff").value)&&(!$("fs").value||c.dataset.state===$("fs").value)
  &&(!$("fn").checked||(c.dataset.state==="draft"&&!ch[k(c)]));
 c.classList.toggle("hide",!show);if(show)n++;}
 $("count").textContent=n+" shown, "+Object.keys(ch).length+" decided";}
for(const c of cards){const ta=c.querySelector("textarea");
 if(ch[k(c)])ta.value=ch[k(c)].notes;
 c.querySelectorAll(".btn[data-s]").forEach(b=>b.onclick=()=>{ch[k(c)]={state:b.dataset.s,notes:ta.value};save();paint(c);filter();});
 ta.oninput=()=>{if(ch[k(c)]){ch[k(c)].notes=ta.value;save();}};paint(c);}
for(const id of["ff","fs","fn"])$(id).onchange=filter;
$("dl").onclick=()=>{const out=cards.filter(c=>ch[k(c)]).map(c=>({file:c.dataset.file,id:c.dataset.id,state:ch[k(c)].state,notes:ch[k(c)].notes}));
 const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)+"\\n"],{type:"application/json"}));
 a.download="review-decisions.json";a.click();};
filter();`;
