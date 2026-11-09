import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getSource, type Grade, type Source } from "./evidence/index.ts";

export type Note = { id: string; topic: string; sourceIds: string[]; grade: Grade; body: string };
export type Hit = {
  id: string;
  topic: string;
  snippet: string;
  grade: Grade;
  sourceIds: string[];
  sources: Source[];
  score: number;
};

export const knowledgeDir = new URL("../knowledge/", import.meta.url);

export function parseNote(id: string, text: string): Note {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
  if (!m) throw new Error(`note ${id}: missing frontmatter`);
  const fm: Record<string, string> = {};
  for (const line of m[1]!.split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const grade = fm.grade as Grade;
  if (!fm.topic || !["A", "B", "C"].includes(grade)) throw new Error(`note ${id}: bad frontmatter`);
  const sourceIds = (fm.sourceIds ?? "[]")
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { id, topic: fm.topic, sourceIds, grade, body: m[2]!.trim() };
}

export function loadNotes(dir: URL | string = knowledgeDir): Note[] {
  const d = typeof dir === "string" ? dir : fileURLToPath(dir);
  return readdirSync(d)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => parseNote(f.slice(0, -3), readFileSync(join(d, f), "utf8")));
}

const tokens = (s: string) => s.toLowerCase().match(/[a-z0-9]+/g) ?? [];

/** BM25 over topic (counted 3x) plus body. ponytail: no stemming; add if recall is poor. */
export function searchNotes(notes: Note[], q: string, limit = 5): Hit[] {
  const terms = [...new Set(tokens(q))];
  if (!terms.length) return [];
  const docs = notes.map((n) => {
    const t = [...tokens(n.topic), ...tokens(n.topic), ...tokens(n.topic), ...tokens(n.body)];
    const tf = new Map<string, number>();
    for (const w of t) tf.set(w, (tf.get(w) ?? 0) + 1);
    return { n, tf, len: t.length };
  });
  const avg = docs.reduce((a, d) => a + d.len, 0) / (docs.length || 1);
  const k1 = 1.5;
  const b = 0.75;
  return docs
    .map((d) => {
      let score = 0;
      for (const w of terms) {
        const f = d.tf.get(w);
        if (!f) continue;
        const df = docs.filter((x) => x.tf.has(w)).length;
        const idf = Math.log(1 + (docs.length - df + 0.5) / (df + 0.5));
        score += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / avg));
      }
      return { n: d.n, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, c) => c.score - a.score)
    .slice(0, limit)
    .map(({ n, score }) => ({
      id: n.id,
      topic: n.topic,
      snippet: n.body.length > 220 ? `${n.body.slice(0, 220).replace(/\s+\S*$/, "")}...` : n.body,
      grade: n.grade,
      sourceIds: n.sourceIds,
      sources: n.sourceIds.map((id) => getSource(id)).filter((s): s is Source => !!s),
      score: Math.round(score * 1000) / 1000,
    }));
}

export type RedFlagData = {
  reply: string;
  negation: string[];
  symptoms: { label: string; pattern: string; requires?: string }[];
};

/** Red-flag symptom patterns, negation words and stop reply (knowledge/red-flags.json). */
export function loadRedFlags(dir: URL | string = knowledgeDir): RedFlagData {
  const d = typeof dir === "string" ? dir : fileURLToPath(dir);
  return JSON.parse(readFileSync(join(d, "red-flags.json"), "utf8")) as RedFlagData;
}
