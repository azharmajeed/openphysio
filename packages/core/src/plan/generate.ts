import { newRow } from "../db/row.ts";
import { filterForInjuries, spikeGuard, SPIKE_WINDOW_MS } from "../safety/index.ts";
import type { BodyArea, NewPlannedSession, Profile } from "../types/index.ts";

/** Structural subset of the catalogue Exercise (core must not import @openphysio/catalog). */
export interface PlanExercise {
  id: string;
  sessionTypes: readonly string[];
  /** Any-of; "bodyweight" is always available. */
  equipment: readonly string[];
  avoidIf: readonly BodyArea[];
  primaryMuscles: readonly string[];
  unit: "reps" | "seconds" | "meters" | "minutes";
  rx: { sets: readonly [number, number]; amount: readonly [number, number] };
  footContactsPerRep?: number;
}

export type PlanBlock =
  | "warmup"
  | "lower_strength"
  | "upper_strength"
  | "back_core"
  | "plyo"
  | "mobility_knee"
  | "run"
  | "swim";

/** One prescribed exercise. Stored as JSON in planned_session.items / .warmup. */
export type PlanItem = {
  exerciseId: string;
  block: PlanBlock;
  sets: number;
  /** Per set, in `unit`. Runs: total minutes (sets = 1). */
  amount: number;
  unit: PlanExercise["unit"];
  restSec: number;
  notes: string;
  muscles: string[];
  /** Plyo: sets x reps x contacts per rep. */
  footContacts?: number;
  /** Runs: estimated distance at RUN_PACE_MIN_PER_KM. */
  distanceM?: number;
  /** Runs: how hard it should feel. */
  intensity?: string;
};

export type PlannedSessionRow = Omit<NewPlannedSession, "warmup" | "items"> & {
  id: string;
  updatedAt: number;
  deletedAt: number | null;
  warmup: PlanItem[];
  items: PlanItem[];
};

/** Built by the app from workouts / set_logs. `at` in ms. A hardSets entry is one session's sets for one muscle. */
export interface PlanHistory {
  runs: { at: number; distanceM: number }[];
  plyoContacts: { at: number; contacts: number }[];
  hardSetsByMuscle: Record<string, { at: number; sets: number }[]>;
}

export interface GenerateBlockInput {
  profile: Pick<Profile, "equipment" | "poolDays">;
  injuries: Parameters<typeof filterForInjuries>[1];
  exercises: readonly PlanExercise[];
  history: PlanHistory;
  /** YYYY-MM-DD; day 0 of the 28-day block. */
  startDate: string;
  seed: number;
  /** updatedAt for the new rows (default Date.now()). */
  now?: number;
}

/** Conservative pace used to turn run minutes into distance for the spike guard. */
export const RUN_PACE_MIN_PER_KM = 6.5;
/** Starter caps when there is no history in the last 30 days. */
export const STARTER = { runDistanceM: 6000, footContacts: 80, hardSetsPerMuscle: 6 } as const;
const PLYO_START_CONTACTS = 70;
const DELOAD = 0.65;
const POOL_FALLBACK = [2, 0]; // Tue, Sun. Day numbers follow Date.getDay(): 0 = Sunday.
const DAY_MS = 86_400_000;

const minToM = (min: number) => (min * 1000) / RUN_PACE_MIN_PER_KM;
const mToMin = (m: number) => Math.floor((m * RUN_PACE_MIN_PER_KM) / 1000 + 1e-9);
const lerp = (r: readonly [number, number], t: number) => Math.round(r[0] + (r[1] - r[0]) * t);

function rng(seed: number) {
  // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s: string) =>
  [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);

const INTENSITY: Record<string, string> = {
  run_easy: "Easy: you can talk in full sentences",
  run_recovery: "Very easy recovery jog",
  run_long: "Easy and steady, conversational pace",
  run_tempo: "Comfortably hard: short sentences only, after an easy warm-up and before a cool-down",
  run_intervals: "After an easy warm-up: 3 min hard / 2 min easy repeats, then cool down",
  run_fartlek: "Easy with surges of 1 min hard whenever you like",
  run_hills: "Easy jog with short uphill efforts, walk back down",
  run_strides: "Easy jog with 6 relaxed 20 s strides",
};

type Session = {
  type: PlannedSessionRow["type"];
  title: string;
  items: PlanItem[];
  warmupFor: string;
};

export function generateBlock(input: GenerateBlockInput): PlannedSessionRow[] {
  const { profile, injuries, history, startDate, seed } = input;
  const { allowed } = filterForInjuries(input.exercises, injuries);
  const byId = new Map(allowed.map((e) => [e.id, e]));
  const have = new Set(["bodyweight", ...profile.equipment]);
  const hasGym = have.has("gym");
  const homeEquip = new Set([...have].filter((e) => e !== "gym"));

  const start = Date.parse(`${startDate}T12:00:00Z`);
  const runs = history.runs.map((r) => ({ at: r.at, value: r.distanceM }));
  const plyo = history.plyoContacts.map((p) => ({ at: p.at, value: p.contacts }));
  const sets: Record<string, { at: number; value: number }[]> = {};
  for (const [m, l] of Object.entries(history.hardSetsByMuscle))
    sets[m] = l.map((h) => ({ at: h.at, value: h.sets }));

  const poolDays = [...new Set(profile.poolDays)].sort((a, b) => a - b);
  const swimDays = (poolDays.length ? poolDays : POOL_FALLBACK).slice(0, 2);

  const first = (...ids: string[]) => ids.map((i) => byId.get(i)).find(Boolean);

  const pool = (block: PlanBlock, equip: Set<string>) =>
    allowed.filter((e) => e.sessionTypes.includes(block) && e.equipment.some((q) => equip.has(q)));

  /** Seeded order per key, stable across weeks, so week w takes entry w: choices rotate. */
  function pickFor(
    cands: PlanExercise[],
    key: string,
    w: number,
    used: Set<string>,
  ): PlanExercise | undefined {
    const r = rng(seed ^ hash(key));
    const order = cands.filter((e) => !used.has(e.id)).sort((a, b) => a.id.localeCompare(b.id));
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    const e = order[w % (order.length || 1)];
    if (e) used.add(e.id);
    return e;
  }

  function item(
    e: PlanExercise,
    block: PlanBlock,
    level: number,
    deload: boolean,
    restSec: number,
    notes = "",
  ): PlanItem {
    let s = lerp(e.rx.sets, level);
    if (deload) s = Math.max(1, Math.round(s * DELOAD));
    return {
      exerciseId: e.id,
      block,
      sets: s,
      amount: lerp(e.rx.amount, level),
      unit: e.unit,
      restSec,
      notes,
      muscles: [...e.primaryMuscles],
    };
  }

  function strength(
    block: PlanBlock,
    muscles: string[],
    equip: Set<string>,
    w: number,
    slot: string,
    level: number,
    deload: boolean,
  ) {
    const cands = pool(block, equip);
    const used = new Set<string>();
    const out: PlanItem[] = [];
    for (const m of muscles) {
      const e = pickFor(
        cands.filter((c) => c.primaryMuscles.includes(m)),
        `${block}${slot}${m}`,
        w,
        used,
      );
      if (e) out.push(item(e, block, level, deload, e.rx.amount[1] <= 8 ? 120 : 75));
    }
    return out;
  }

  /** Trim sets so each muscle's session total stays under the spike guard, then record it as history. */
  function guardSets(items: PlanItem[], at: number) {
    const hard = items.filter((i) =>
      ["lower_strength", "upper_strength", "back_core"].includes(i.block),
    );
    const total = (m: string) => hard.reduce((n, i) => n + (i.muscles.includes(m) ? i.sets : 0), 0);
    for (const m of new Set(hard.flatMap((i) => i.muscles))) {
      const g = spikeGuard({
        metric: "hard_sets",
        planned: total(m),
        history: sets[m] ?? [],
        now: at,
        starter: STARTER.hardSetsPerMuscle,
      });
      while (total(m) > g.value) {
        const top = hard
          .filter((i) => i.muscles.includes(m) && i.sets > 0)
          .sort((a, b) => b.sets - a.sets)[0]!;
        top.sets--;
      }
    }
    for (const m of new Set(hard.flatMap((i) => i.muscles)))
      (sets[m] ??= []).push({ at, value: total(m) });
    return items.filter((i) => i.sets > 0);
  }

  function runItem(id: string | undefined, desiredMin: number, at: number): PlanItem | undefined {
    const e = id ? byId.get(id) : undefined;
    if (!e) return undefined;
    const g = spikeGuard({
      metric: "run_distance_m",
      planned: minToM(desiredMin),
      history: weekRuns,
      now: at,
      starter: STARTER.runDistanceM,
    });
    const min = g.capped ? mToMin(g.value) : desiredMin;
    if (min < 5) return undefined;
    const distanceM = minToM(min);
    runs.push({ at, value: distanceM });
    return {
      exerciseId: e.id,
      block: "run",
      sets: 1,
      amount: min,
      unit: "minutes",
      restSec: 0,
      notes: g.reason,
      muscles: [...e.primaryMuscles],
      distanceM,
      intensity: INTENSITY[e.id] ?? "Easy",
    };
  }

  function plyoItems(w: number, slot: number, at: number): PlanItem[] {
    const deload = w === 3;
    const desired = Math.floor(PLYO_START_CONTACTS * 1.1 ** Math.min(w, 2) * (deload ? DELOAD : 1));
    const g = spikeGuard({
      metric: "foot_contacts",
      planned: desired,
      history: plyo,
      now: at,
      starter: STARTER.footContacts,
    });
    const target = Math.floor(g.value);
    const cands = pool("plyo", have).filter((e) => e.footContactsPerRep);
    const used = new Set<string>();
    const picks = [0, 1, 2]
      .map((i) => pickFor(cands, `plyo${slot}`, w + i, used))
      .filter((e): e is PlanExercise => !!e);
    const rows = picks.map((e) => ({ e, s: e.rx.sets[0], r: e.rx.amount[0] }));
    const fc = (x: { e: PlanExercise; s: number; r: number }) =>
      x.s * x.r * x.e.footContactsPerRep!;
    const sum = () => rows.reduce((n, x) => n + fc(x), 0);
    // drop what does not fit at minimum dose, then shrink to 1 set, then top up reps toward target
    while (rows.length && sum() > target) {
      const x = rows[rows.length - 1]!;
      if (x.s > 1) x.s = 1;
      else if (rows.length > 1) rows.pop();
      else {
        x.r = Math.floor(target / x.e.footContactsPerRep!);
        if (x.r < 1) rows.pop();
        break;
      }
    }
    for (let grew = true; grew;) {
      grew = false;
      for (const x of rows)
        if (x.r < x.e.rx.amount[1] && sum() + x.s * x.e.footContactsPerRep! <= target) {
          x.r++;
          grew = true;
        }
    }
    const out = rows.map((x) => ({
      ...item(x.e, "plyo", 0, false, 90, "Land softly, stop if form breaks"),
      sets: x.s,
      amount: x.r,
      footContacts: fc(x),
    }));
    const total = out.reduce((n, i) => n + (i.footContacts ?? 0), 0);
    if (total > 0) plyo.push({ at, value: total });
    return out;
  }

  const warmup = (key: string, equip: Set<string>, w: number): PlanItem[] => {
    const cands = pool("warmup", equip);
    const used = new Set<string>();
    return [0, 1, 2, 3]
      .map((i) => pickFor(cands, `warmup${key}`, w + i, used))
      .filter((e): e is PlanExercise => !!e)
      .map((e) => item(e, "warmup", 0, false, 20, "Prevention warm-up"));
  };

  // Long run grows 10% a week from the biggest recent run; deload week is 65% of week 3.
  const recentMax = Math.max(
    0,
    ...runs.filter((r) => r.at <= start && start - r.at <= SPIKE_WINDOW_MS).map((r) => r.value),
  );
  const anchorM = recentMax > 0 ? recentMax : STARTER.runDistanceM;
  const longMin = (w: number) => mToMin(anchorM * 1.1 ** Math.min(w, 2) * (w === 3 ? DELOAD : 1));

  // Runs are guarded against history as of the start of their week: a short Wed run must not lower the Sat cap.
  let weekRuns = runs.slice();
  const rows: PlannedSessionRow[] = [];
  const stamp = input.now ?? Date.now();

  for (let d = 0; d < 28; d++) {
    const w = Math.floor(d / 7);
    if (d % 7 === 0) weekRuns = runs.slice();
    const deload = w === 3;
    const level = deload ? 0.8 : [0.2, 0.5, 0.8][w]!;
    const ms = start + d * DAY_MS;
    const date = new Date(ms).toISOString().slice(0, 10);
    const dow = new Date(ms).getUTCDay();
    const day: Session[] = [];
    const wk = deload ? " (deload)" : "";

    if (dow === 1) {
      const items = strength(
        "lower_strength",
        ["quads", "hamstrings", "glutes", "calves", "quads"],
        homeEquip,
        w,
        "mon",
        level,
        deload,
      );
      day.push({ type: "home", title: `Lower strength, home${wk}`, items, warmupFor: "lower" });
    }
    if (dow === 2) {
      const items = strength(
        "back_core",
        ["upper_back", "lower_back", "abdominals", "glutes"],
        homeEquip,
        w,
        "tue",
        level,
        deload,
      );
      day.push({ type: "home", title: `Back and core${wk}`, items, warmupFor: "back" });
    }
    if (dow === 3) {
      const quality =
        deload || w === 1
          ? ["run_tempo", "run_fartlek"]
          : ["run_intervals", "run_tempo", "run_fartlek"];
      const it = runItem(first(...quality)?.id, Math.round(longMin(w) * 0.65), ms);
      if (it)
        day.push({
          type: "run",
          title: `Run: ${it.exerciseId.replace("run_", "")}${wk}`,
          items: [it],
          warmupFor: "run",
        });
    }
    if (dow === 4) {
      const equip = hasGym ? have : homeEquip;
      const items = [
        ...strength(
          "upper_strength",
          ["chest", "shoulders", "lats", "triceps", "biceps"],
          equip,
          w,
          "thu",
          level,
          deload,
        ),
        ...strength(
          "back_core",
          ["upper_back", "abdominals", "lower_back"],
          equip,
          w,
          "thu",
          level,
          deload,
        ),
      ];
      day.push({
        type: hasGym ? "gym" : "home",
        title: `Upper strength and back${hasGym ? ", gym" : ", home"}${wk}`,
        items,
        warmupFor: "upper",
      });
    }
    if (dow === 5) {
      const items = strength(
        "mobility_knee",
        ["tibialis", "quads", "calves", "abductors", "quads"],
        homeEquip,
        w,
        "fri",
        0.3,
        deload,
      );
      day.push({
        type: "mobility",
        title: `Knee, tibialis and mobility${wk}`,
        items,
        warmupFor: "mobility",
      });
    }
    if (dow === 6) {
      const it = runItem(first("run_long", "run_easy")?.id, longMin(w), ms);
      if (it) day.push({ type: "run", title: `Long run${wk}`, items: [it], warmupFor: "run" });
    }
    if (dow === 0) {
      const it = runItem(first("run_easy", "run_recovery")?.id, Math.round(longMin(w) * 0.55), ms);
      if (it) day.push({ type: "run", title: `Easy run${wk}`, items: [it], warmupFor: "run" });
    }
    if (dow === 1 || dow === 4) {
      // plyo sessions are 3 days apart (Mon, Thu)
      const items = plyoItems(w, dow === 1 ? 0 : 1, ms);
      if (items.length)
        day.push({ type: "plyo", title: `Plyometrics${wk}`, items, warmupFor: "plyo" });
    }
    const swimIdx = swimDays.indexOf(dow);
    if (swimIdx >= 0) {
      const technique = swimIdx === 0 && w < 2;
      const ids = technique
        ? ["swim_drills", "swim_kick", "swim_easy"]
        : deload
          ? ["swim_easy", "swim_mixed"]
          : w === 2
            ? ["swim_intervals", "swim_mixed", "swim_easy"]
            : ["swim_mixed", "swim_endurance", "swim_easy"];
      const main = first(...ids);
      if (main) {
        const items = [item(main, "swim", level, deload, technique ? 20 : 30)];
        const kick = technique ? first("swim_kick") : undefined;
        if (kick && kick.id !== main.id) items.push(item(kick, "swim", level, deload, 20));
        day.push({
          type: "swim",
          title: `Swim: ${main.id.replace("swim_", "")}${wk}`,
          items,
          warmupFor: "swim",
        });
      }
    }

    for (const s of day) {
      const equip = s.type === "gym" ? have : homeEquip;
      const items =
        s.type === "plyo" || s.type === "run" || s.type === "swim"
          ? s.items
          : guardSets(s.items, ms);
      if (!items.length) continue;
      rows.push({
        ...newRow(stamp),
        date,
        type: s.type,
        title: s.title,
        warmup: warmup(s.warmupFor, equip, w),
        items,
        status: "planned",
      });
    }
  }
  return rows;
}
