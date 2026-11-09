// Pure red-flag check, run before any model call. Keyword list follows
// packages/catalog/knowledge/red-flags.md. General guidance, not a diagnosis.

export const RED_FLAG_REPLY =
  "Please stop training and get this checked by a doctor or physiotherapist before doing anything else. " +
  "What you describe can be a red flag, and I can't assess it safely in a chat. " +
  "If it is severe or getting worse (chest pain, fainting, trouble breathing, a limb going numb), seek urgent medical help now.";

type Rule = { re: RegExp; also?: RegExp };

const RULES: Rule[] = [
  { re: /\bchest (?:pain|pains|pressure|tightness|discomfort)\b/ },
  { re: /\b(?:faint(?:ed|ing|s)?|pass(?:ed|ing)? out|black(?:ed|ing)? out|collaps(?:e|ed|ing))\b/ },
  {
    re: /\b(?:severe|sudden|extreme) (?:shortness of breath|breathlessness)\b|\b(?:can't|cannot|struggling to) breathe\b/,
  },
  { re: /\bsudden(?:ly)? (?:severe |terrible |worst )?headache\b|\bworst headache\b/ },
  {
    re: /\b(?:numb(?:ness)?|tingling|pins and needles)\b/,
    also: /\b(?:spread(?:s|ing)?|down|both|legs?|arms?|limb|foot|feet|hands?|face|groin|saddle|getting worse|worsening)\b/,
  },
  {
    re: /\b(?:loss of|lost|losing) (?:bladder|bowel)|\b(?:can't|cannot) (?:control|hold) (?:my )?(?:bladder|bowel)/,
  },
  {
    re: /\bnight pain\b|\bpain (?:at|during|through|all) (?:the )?night\b|\bpain at rest\b|\b(?:wakes?|woke|waking|keeps?|kept) me (?:up|awake)[^.!?]{0,40}\bpain\b|\bpain[^.!?]{0,40}\b(?:wakes?|woke|waking) me\b/,
  },
  {
    re: /\b(?:sudden(?:ly)?|rapid(?:ly)?|quick(?:ly)?|overnight|immediately)\b[^.!?]{0,30}\b(?:swell\w*|swollen)\b|\b(?:swell\w*|swollen)\b[^.!?]{0,30}\b(?:suddenly|overnight|out of nowhere|rapidly|very quickly)\b/,
  },
  {
    re: /\b(?:can't|cannot|can not|unable to|couldn't|not able to) (?:bear|put|take|stand on|walk on)\b[^.!?]{0,15}\b(?:weight|it|leg|foot)\b|\bunable to walk\b|\b(?:can't|cannot) walk\b/,
  },
  {
    re: /\b(?:fever|feverish|high temperature)\b/,
    also: /\b(?:joint|knee|ankle|hip|shoulder|elbow|wrist|pain|hurts?|ache)\b/,
  },
];

const NEGATION =
  /\b(?:no|not|never|without|nor|denies|deny|don't|doesn't|didn't|haven't|hasn't|hadn't|zero|free of)\b/;

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
