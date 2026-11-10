import { getExercise, type Exercise } from "@openphysio/catalog";
import {
  filterForInjuries,
  injury,
  plannedSession,
  RUN_PACE_MIN_PER_KM,
  setLog,
  spikeGuard,
  STARTER,
  workout,
  type AdaptChange,
  type PlanItem,
  type PlannedSessionRow,
  type SpikeMetric,
} from "@openphysio/core";
import { and, eq, gte, inArray, isNull } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { ToolDef } from "../ai/index.ts";

/** A validated change, in C4's AdaptChange shape, plus the session as it would look so the phone can save it as is. */
export type Proposal = { change: AdaptChange; session: PlannedSessionRow };
export type Outcome = { ok: true; proposal: Proposal } | { ok: false; reason: string };

export const PROPOSE_TOOL: ToolDef = {
  name: "propose_plan_change",
  description:
    "Propose one change to a planned session. Nothing changes until the user taps Apply; the server refuses unsafe proposals and tells you why. kind swap: needs sessionId, exerciseId (planned one), toExerciseId. kind volume: sessionId, exerciseId, sets and/or amount. kind move: sessionId, toDate.",
  input_schema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["swap", "volume", "move"] },
      sessionId: { type: "string" },
      exerciseId: { type: "string" },
      toExerciseId: { type: "string" },
      sets: { type: "number" },
      amount: { type: "number" },
      toDate: { type: "string", description: "YYYY-MM-DD" },
      reason: { type: "string", description: "Plain words for the user" },
    },
    required: ["kind", "sessionId", "reason"],
  },
};

const DAY_MS = 86_400_000;
const words = (s: string) => s.replace(/[-_]/g, " ");
const refuse = (reason: string): Outcome => ({ ok: false, reason: `refused: ${reason}` });
type Hist = { at: number; value: number }[];

// ponytail: history rebuilt here (mobile's buildHistory can't be imported); hard set = rpe >= 7 or unlogged rpe, light-only exercises not discounted.
function history(db: BetterSQLite3Database, now: number) {
  const ws = db
    .select()
    .from(workout)
    .where(and(isNull(workout.deletedAt), gte(workout.startedAt, now - 30 * DAY_MS)))
    .all();
  const sets = ws.length
    ? db
        .select()
        .from(setLog)
        .where(and(isNull(setLog.deletedAt), inArray(setLog.workoutId, ws.map((w) => w.id))))
        .all()
    : [];
  const runs: Hist = ws.filter((w) => w.type === "run" && w.distanceM).map((w) => ({ at: w.startedAt, value: w.distanceM! }));
  const contacts: Hist = [];
  const hard: Record<string, Hist> = {};
  for (const w of ws) {
    const mine = sets.filter((s) => s.workoutId === w.id);
    const fc = mine.reduce((n, s) => n + (s.footContacts ?? 0), 0);
    if (fc) contacts.push({ at: w.startedAt, value: fc });
    const per: Record<string, number> = {};
    for (const s of mine) {
      if (s.rpe != null && s.rpe < 7) continue;
      for (const m of getExercise(s.exerciseId)?.primaryMuscles ?? []) per[m] = (per[m] ?? 0) + 1;
    }
    for (const [m, n] of Object.entries(per)) (hard[m] ??= []).push({ at: w.startedAt, value: n });
  }
  return { runs, contacts, hard };
}

/** Item for exercise `e` with the given dose, with the load numbers the spike guard needs. */
function build(old: PlanItem, e: Exercise, sets: number, amount: number): PlanItem {
  const out: PlanItem = { ...old, footContacts: undefined, distanceM: undefined, exerciseId: e.id, unit: e.unit, sets, amount, muscles: [...e.primaryMuscles] };
  if (e.footContactsPerRep) out.footContacts = e.footContactsPerRep * sets * amount;
  if (old.distanceM && e.unit === "minutes") out.distanceM = (amount * 1000) / RUN_PACE_MIN_PER_KM;
  return out;
}

/** First spike-guard failure for the new item (only metrics that rise vs the old item), as a user-facing sentence. */
function spike(db: BetterSQLite3Database, now: number, items: PlanItem[], old: PlanItem, nu: PlanItem): string | undefined {
  const h = history(db, now);
  const checks: { metric: SpikeMetric; label: string; planned: number; before: number; hist: Hist; starter: number }[] = [];
  if (nu.distanceM) checks.push({ metric: "run_distance_m", label: "run distance", planned: nu.distanceM, before: old.distanceM ?? 0, hist: h.runs, starter: STARTER.runDistanceM });
  if (nu.footContacts) checks.push({ metric: "foot_contacts", label: "foot contacts", planned: nu.footContacts, before: old.footContacts ?? 0, hist: h.contacts, starter: STARTER.footContacts });
  for (const m of nu.muscles) {
    const total = items.reduce((n, x) => n + (x.muscles.includes(m) ? x.sets : 0), 0);
    const before = total - nu.sets + (old.muscles.includes(m) ? old.sets : 0);
    checks.push({ metric: "hard_sets", label: `${words(m)} sets`, planned: total, before, hist: h.hard[m] ?? [], starter: STARTER.hardSetsPerMuscle });
  }
  for (const c of checks) {
    if (c.planned <= c.before) continue;
    const r = spikeGuard({ metric: c.metric, planned: c.planned, history: c.hist, now, starter: c.starter });
    if (!r.capped) continue;
    const max = Math.max(0, ...c.hist.map((x) => x.value));
    return max > 0
      ? `exceeds your 30-day max by ${Math.round((c.planned / max - 1) * 100)}% (${c.label}; the limit is 10% above it)`
      : `${c.label} above the starter limit of ${c.starter} when there is no training in the last 30 days`;
  }
}

export function validateProposal(db: BetterSQLite3Database, input: Record<string, unknown>, now = Date.now()): Outcome {
  const s = db
    .select()
    .from(plannedSession)
    .where(and(eq(plannedSession.id, String(input.sessionId)), isNull(plannedSession.deletedAt)))
    .all()[0] as PlannedSessionRow | undefined;
  if (!s) return refuse("that session is not in your plan");
  if (s.status !== "planned") return refuse(`that session is already ${s.status}`);
  const reason = typeof input.reason === "string" ? input.reason : "";
  const mk = (change: Omit<AdaptChange, "sessionId" | "reason">, session: PlannedSessionRow): Outcome => ({
    ok: true,
    proposal: { change: { sessionId: s.id, reason, ...change }, session: { ...session, updatedAt: now } },
  });

  if (input.kind === "move") {
    const to = typeof input.toDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.toDate) ? input.toDate : "";
    if (!to) return refuse("toDate must be YYYY-MM-DD");
    if (to < new Date(now).toISOString().slice(0, 10)) return refuse("that date is in the past");
    if (to === s.date) return refuse("the session is already on that date");
    return mk({ kind: "move", from: s.date, to }, { ...s, date: to });
  }

  const idx = s.items.findIndex((i) => i.exerciseId === input.exerciseId);
  if (idx < 0) return refuse(`${input.exerciseId} is not in that session`);
  const old = s.items[idx]!;
  let target: Exercise | undefined;
  let sets = old.sets;
  let amount = old.amount;
  if (input.kind === "swap") {
    target = getExercise(String(input.toExerciseId));
    if (!target) return refuse(`${input.toExerciseId} is not in the exercise catalogue`);
  } else if (input.kind === "volume") {
    target = getExercise(old.exerciseId);
    if (!target) return refuse(`${old.exerciseId} is not in the exercise catalogue`);
    const num = (v: unknown, d: number) => (v === undefined ? d : typeof v === "number" && Number.isFinite(v) && v >= 1 ? Math.round(v) : NaN);
    sets = num(input.sets, old.sets);
    amount = num(input.amount, old.amount);
    if (Number.isNaN(sets) || Number.isNaN(amount)) return refuse("sets and amount must be whole numbers of at least 1");
    if (sets === old.sets && amount === old.amount) return refuse("that is the current volume");
  } else return refuse("kind must be swap, volume or move");

  // Injuries always apply; a volume change on an injury-blocked exercise is only allowed downwards.
  const injuries = db.select().from(injury).where(isNull(injury.deletedAt)).all();
  const raising = input.kind === "swap" || sets > old.sets || amount > old.amount;
  const blocked = filterForInjuries([target], injuries).excluded[0];
  if (blocked && raising) return refuse(`${words(target.id)} is not safe with your injury (${blocked.reason})`);

  if (input.kind === "swap") amount = Math.min(Math.max(amount, target.rx.amount[0]), target.rx.amount[1]);
  const nu = build(old, target, sets, amount);
  const items = s.items.map((i, k) => (k === idx ? nu : i));
  const why = spike(db, now, items, old, nu);
  if (why) return refuse(why);

  const dose = (i: PlanItem) => (i.distanceM || i.sets === 1 ? `${i.amount} ${i.unit}` : `${i.sets} x ${i.amount} ${i.unit}`);
  return mk(
    input.kind === "swap"
      ? { kind: "swap", exerciseId: old.exerciseId, from: words(old.exerciseId), to: words(nu.exerciseId) }
      : { kind: "volume", exerciseId: old.exerciseId, from: dose(old), to: dose(nu) },
    { ...s, items },
  );
}
