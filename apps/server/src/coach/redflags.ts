// Pure red-flag check, run before any model call. Patterns, negation words and the stop reply live in
// packages/catalog/knowledge/red-flags.json (next to red-flags.md). General guidance, not a diagnosis.
import { loadRedFlags } from "@openphysio/catalog/knowledge";

const data = loadRedFlags();

export const RED_FLAG_REPLY = data.reply;
/** Symptom labels, for the coach prompt. */
export const RED_FLAG_LABELS = data.symptoms.map((s) => s.label);

const RULES = data.symptoms.map((s) => ({
  re: new RegExp(s.pattern),
  also: s.requires ? new RegExp(s.requires) : undefined,
}));

const NEGATION = new RegExp("\\b(?:" + data.negation.join("|") + ")\\b");

/** True when a negation word sits in the same clause, up to 4 words before the match. */
function negated(text: string, index: number): boolean {
  const clause =
    text
      .slice(0, index)
      .split(/[.,;:!?]|\bbut\b|\bhowever\b/)
      .pop() ?? "";
  return NEGATION.test(clause.trim().split(/\s+/).slice(-4).join(" "));
}

export function detectRedFlag(input: string): boolean {
  const text = input.toLowerCase().replace(/[‘’]/g, "'");
  return RULES.some(({ re, also }) => {
    for (const m of text.matchAll(new RegExp(re.source, "g"))) {
      if (negated(text, m.index)) continue;
      if (!also || also.test(text)) return true;
    }
    return false;
  });
}
