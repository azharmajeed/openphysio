import { getSource } from "@openphysio/catalog";
import { loadNotes, searchNotes } from "@openphysio/catalog/knowledge";
import {
  coachNote,
  healthDaily,
  injury,
  newRow,
  painEntry,
  plannedSession,
  profile,
  setLog,
  workout,
} from "@openphysio/core";
import { and, between, inArray, isNull } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { AiProvider, Block, Message, ToolDef } from "../ai/index.ts";
import { RED_FLAG_REPLY, detectRedFlag } from "./redflags.ts";

export const MAX_TURNS = 5;

export type Citation = { id: string; title: string; url: string; grade: string };
export type CoachReply = { text: string; citations: Citation[]; redFlag: boolean };

const none = { type: "object", properties: {} };
const range = {
  type: "object",
  properties: {
    from: { type: "string", description: "YYYY-MM-DD, default 14 days ago" },
    to: { type: "string", description: "YYYY-MM-DD, default today" },
  },
};
export const TOOLS: ToolDef[] = [
  { name: "get_profile", description: "The user's profile, goals, equipment.", input_schema: none },
  { name: "get_injuries", description: "All injuries (active and recovered).", input_schema: none },
  { name: "get_plan", description: "Planned sessions in a date range.", input_schema: range },
  {
    name: "get_logs",
    description: "Workouts with sets and pain entries in a date range.",
    input_schema: range,
  },
  {
    name: "get_recovery",
    description: "Daily steps, resting HR, sleep in a date range.",
    input_schema: range,
  },
  {
    name: "search_knowledge",
    description: "Search the evidence-backed knowledge base. Results include source ids to cite.",
    input_schema: { type: "object", properties: { q: { type: "string" } }, required: ["q"] },
  },
];

const day = (d: Date) => d.toISOString().slice(0, 10);
const str = (v: unknown) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;

const SYSTEM = `You are OpenPhysio's coach: a physio-informed training assistant for one user. You give general guidance, not diagnoses.
Rules:
- Injuries come first. The injury list below is always in force: never suggest loading or exercises that stress an injured area; prefer easier variants.
- Use the tools to read the user's data before answering; do not guess at their plan, logs or recovery.
- Back health claims with the knowledge base: call search_knowledge, then cite the source id in square brackets, like [src-id]. Cite only ids returned by tools. If there is no source, say it is general coaching advice.
- If the user describes anything alarming (chest pain, fainting, spreading numbness, night pain, sudden swelling, cannot bear weight, fever with joint pain), tell them to stop and see a professional.
- Never use Strava data. Be brief and practical.`;

export function systemPrompt(injuries: unknown[]): string {
  return `${SYSTEM}\n\nCurrent injuries (JSON):\n${JSON.stringify(injuries)}`;
}

export function coachTools(db: BetterSQLite3Database, notes = loadNotes()) {
  const live = (t: { deletedAt: Parameters<typeof isNull>[0] }) => isNull(t.deletedAt);
  const dates = (i: Record<string, unknown>) => {
    const now = new Date();
    return [
      str(i.from) ?? day(new Date(now.getTime() - 14 * 864e5)),
      str(i.to) ?? day(now),
    ] as const;
  };
  const readInjuries = () => db.select().from(injury).where(live(injury)).all();
  const handlers: Record<string, (i: Record<string, unknown>) => unknown> = {
    get_profile: () => db.select().from(profile).where(live(profile)).all()[0] ?? null,
    get_injuries: readInjuries,
    get_plan: (i) => {
      const [from, to] = dates(i);
      return db
        .select()
        .from(plannedSession)
        .where(and(live(plannedSession), between(plannedSession.date, from, to)))
        .all();
    },
    get_logs: (i) => {
      const [from, to] = dates(i);
      const lo = Date.parse(`${from}T00:00:00Z`);
      const hi = Date.parse(`${to}T23:59:59Z`);
      const workouts = db
        .select()
        .from(workout)
        .where(and(live(workout), between(workout.startedAt, lo, hi)))
        .all();
      const ids = workouts.map((w) => w.id);
      return {
        workouts,
        sets: ids.length
          ? db
              .select()
              .from(setLog)
              .where(and(live(setLog), inArray(setLog.workoutId, ids)))
              .all()
          : [],
        pain: db
          .select()
          .from(painEntry)
          .where(and(live(painEntry), between(painEntry.at, lo, hi)))
          .all(),
      };
    },
    get_recovery: (i) => {
      const [from, to] = dates(i);
      return db
        .select()
        .from(healthDaily)
        .where(and(live(healthDaily), between(healthDaily.date, from, to)))
        .all();
    },
    search_knowledge: (i) =>
      searchNotes(notes, typeof i.q === "string" ? i.q : "", 5).map((h) => ({
        topic: h.topic,
        snippet: h.snippet,
        grade: h.grade,
        sources: h.sources.map((s) => ({ id: s.id, title: s.title, grade: s.grade })),
      })),
  };
  return {
    readInjuries,
    run: (name: string, input: Record<string, unknown>) => handlers[name]?.(input),
  };
}

export function resolveCitations(text: string): Citation[] {
  const ids = [...new Set([...text.matchAll(/\[([\w.-]+)\]/g)].map((m) => m[1]!))];
  return ids.flatMap((id) => {
    const s = getSource(id);
    return s ? [{ id: s.id, title: s.title, url: s.url, grade: s.grade }] : [];
  });
}

export async function coachChat(
  { db, ai }: { db: BetterSQLite3Database; ai: AiProvider },
  messages: Message[],
): Promise<CoachReply> {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const question = typeof lastUser?.content === "string" ? lastUser.content : "";
  const used: string[] = [];
  let reply: CoachReply;

  if (detectRedFlag(question)) {
    reply = { text: RED_FLAG_REPLY, citations: [], redFlag: true };
  } else {
    const tools = coachTools(db);
    const convo = [...messages];
    let text = "I could not finish that answer. Please try rephrasing.";
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const r = await ai.chat({
        system: systemPrompt(tools.readInjuries()),
        messages: convo,
        tools: TOOLS,
      });
      if (!r.toolCalls.length) {
        text = r.text;
        break;
      }
      convo.push({
        role: "assistant",
        content: [
          ...(r.text ? [{ type: "text", text: r.text } as Block] : []),
          ...r.toolCalls.map((c): Block => ({
            type: "tool_use",
            id: c.id,
            name: c.name,
            input: c.input,
          })),
        ],
      });
      convo.push({
        role: "user",
        content: r.toolCalls.map((c): Block => {
          used.push(c.name);
          const out = tools.run(c.name, c.input);
          return out === undefined
            ? {
                type: "tool_result",
                tool_use_id: c.id,
                content: `unknown tool ${c.name}`,
                is_error: true,
              }
            : { type: "tool_result", tool_use_id: c.id, content: JSON.stringify(out) };
        }),
      });
    }
    reply = { text, citations: resolveCitations(text), redFlag: false };
  }

  // ponytail: deterministic one-line memory, no model summary; upgrade when notes need to be richer.
  const parts = [
    `Asked: ${question.slice(0, 120)}`,
    reply.redFlag && "red flag, sent to a professional",
    used.length && `read: ${[...new Set(used)].join(", ")}`,
    reply.citations.length && `cited: ${reply.citations.map((c) => c.id).join(", ")}`,
  ];
  db.insert(coachNote)
    .values({ ...newRow(), at: Date.now(), body: parts.filter(Boolean).join(" | ") })
    .run();
  return reply;
}
