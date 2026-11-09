import { DECIMAL_WORDS, HUNDRED_WORDS, KEYWORDS, LOAD_UNITS, NUMBER_WORDS } from "./units.ts";

export interface ParsedSet {
  reps?: number;
  loadKg?: number;
  rpe?: number;
  /** "same again": caller repeats its last set. */
  same?: boolean;
}

const MAX_REPS = 200;
const MAX_LOAD_KG = 500;

type Tok = string | number;

/** Words and digits -> tokens, with spoken numbers ("twenty five", "two point five") folded into numbers. */
function tokenize(text: string): Tok[] {
  const words = text.toLowerCase().replace(/[^a-z0-9.\s]/g, " ").split(/\s+/).filter(Boolean);
  const out: Tok[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    if (/^\d+(\.\d+)?$/.test(w)) out.push(Number(w));
    else if (w in NUMBER_WORDS) {
      let n = NUMBER_WORDS[w]!;
      const next = words[i + 1];
      if (n >= 20 && n % 10 === 0 && next && next in NUMBER_WORDS && NUMBER_WORDS[next]! < 10) {
        n += NUMBER_WORDS[next]!;
        i++;
      } else if (n < 10 && next && HUNDRED_WORDS.includes(next)) {
        n *= 100;
        i++;
      }
      // "two point five": digits after the decimal word
      if (words[i + 1] && DECIMAL_WORDS.includes(words[i + 1]!)) {
        let frac = "";
        let j = i + 2;
        while (j < words.length && words[j]! in NUMBER_WORDS && NUMBER_WORDS[words[j]!]! < 10) frac += NUMBER_WORDS[words[j++]!];
        if (frac) {
          n = Number(`${n}.${frac}`);
          i = j - 1;
        }
      }
      out.push(n);
    } else out.push(w);
  }
  return out;
}

const is = (list: readonly string[], t: Tok | undefined) => typeof t === "string" && list.includes(t);

/**
 * Parse a spoken set. Keywords bind numbers ("8 reps", "20 kilos", "rpe 7"); leftover numbers fill
 * reps then load in order ("twelve at fifteen"). Out-of-range values are dropped, never guessed.
 */
export function parseSet(text: string): ParsedSet {
  const toks = tokenize(text);
  const r: ParsedSet = {};
  const free: number[] = [];
  toks.forEach((t, i) => {
    if (typeof t !== "number") return;
    const next = toks[i + 1];
    const prev = toks[i - 1];
    if (typeof next === "string" && next in LOAD_UNITS) r.loadKg ??= t * LOAD_UNITS[next]!;
    else if (is(KEYWORDS.reps, next)) r.reps ??= t;
    else if (is(KEYWORDS.rpe, prev) || is(KEYWORDS.rpe, next)) r.rpe ??= t;
    else free.push(t);
  });
  for (const n of free) {
    if (r.reps === undefined) r.reps = n;
    else if (r.loadKg === undefined) r.loadKg = n; // unit-less load: kg (the app default)
  }
  if (toks.some((t) => is(KEYWORDS.same, t))) r.same = true;
  if (r.reps !== undefined && !(Number.isInteger(r.reps) && r.reps > 0 && r.reps <= MAX_REPS)) delete r.reps;
  if (r.loadKg !== undefined) {
    r.loadKg = Math.round(r.loadKg * 100) / 100;
    if (!(r.loadKg >= 0 && r.loadKg <= MAX_LOAD_KG)) delete r.loadKg;
  }
  if (r.rpe !== undefined && !(r.rpe >= 1 && r.rpe <= 10)) delete r.rpe;
  return r;
}
