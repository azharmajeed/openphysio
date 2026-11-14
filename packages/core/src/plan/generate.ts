import { newRow } from "../db/row.ts";
import { filterForInjuries, spikeGuard, SPIKE_WINDOW_MS } from "../safety/index.ts";
import type { NutritionGoal } from "../nutrition/index.ts";
import type { BodyArea, NewPlannedSession, Profile, WorkoutType } from "../types/index.ts";

/** Structural subset of the catalogue Exercise (core must not import @openphysio/catalog). */
export interface PlanExercise {
  id: string;
  sessionTypes: readonly string[];
  /** Any-of; "bodyweight" is always available; "pool" needs pool access. */
  equipment: readonly string[];
  avoidIf: readonly BodyArea[];
  primaryMuscles: readonly string[];
  unit: "reps" | "seconds" | "meters" | "minutes";
  rx: { sets: readonly [number, number]; amount: readonly [number, number] };
  footContactsPerRep?: number;
  /** Easier variant; used to start people with no history lower. */
  regressionId?: string;
  /** 1 | 2 | 3. With no history for a pattern, level n is held back until week n. */
  level: number;
  /** Template role (easy, quality, long, technique, endurance, ...); demands pick by role. */
  role?: string;
  /** How hard a template should feel, shown on the item. */
  intensity?: string;
}

/** How a demand turns exercises into a session. */
export type DemandKind = "strength" | "light" | "plyo" | "run" | "cardio";

/** Structural subset of the catalogue Goal demand. */
export interface PlanDemand {
  id: string;
  title: string;
  sessionType: string;
  kind: DemandKind;
  /** Sessions per week [min, max]. */
  perWeek: readonly [number, number];
  impact: "low" | "moderate" | "high";
  role?: string;
  /** strength / light: one exercise per entry, in order. */
  muscles?: readonly string[];
  /** Exercises per session for cardio (default 1). */
  items?: number;
  /** run: share of the long-run minutes (default 1). */
  volume?: number;
  /** Placed last, on the day with the most free capacity. */
  /** Higher survives when the week is too full (default 0). */
  priority?: number;
  long?: boolean;
  /** strength: use the gym when the profile has one. */
  prefersGym?: boolean;
  /** Only when profile.sports is empty or includes it. */
  sport?: string;
  workoutType?: WorkoutType;
  /** Stand-ins, tried in order when no exercise survives injuries and equipment. */
  alternatives?: readonly (Partial<Omit<PlanDemand, "alternatives">> & {
    sessionType: string;
    kind: DemandKind;
  })[];
}

/** Something the plan could not give the user, never dropped silently. */
export interface PlanWarning {
  demandId: string;
  title: string;
  reason: string;
}

export interface PlanBlockResult {
  sessions: PlannedSessionRow[];
  warnings: PlanWarning[];
}

export interface PlanGoal {
  id: string;
  label: string;
  demands: readonly PlanDemand[];
  /** Optional nutrition choices; see resolveNutrition. */
  nutrition?: NutritionGoal;
}

export type PlanBlock = string;

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
  profile: Pick<Profile, "goals" | "sports" | "equipment" | "poolDays"> & {
    /** Weekdays (Date.getDay numbers) available for training; default all 7. */
    trainingDays?: number[];
  };
  injuries: Parameters<typeof filterForInjuries>[1];
  exercises: readonly PlanExercise[];
  /** Goal definitions; the profile's goal ids select from these. */
  goals: readonly PlanGoal[];
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
const DELOAD_WEEK = 3;
const BLOCK_DAYS = 28;
const LIGHT_DOSE = 0.3;
const MAX_SESSIONS_PER_DAY = 2;
/** Plan-wide rules. Grade C coaching convention (load and recovery, src-ioc-load-2016): keep a rest day each week. */
export const PLAN_CONFIG = { minRestDaysPerWeek: 1, restSourceId: "src-ioc-load-2016" } as const;
const DAY_MS = 86_400_000;
const DAYS = [0, 1, 2, 3, 4, 5, 6];

const minToM = (min: number) => (min * 1000) / RUN_PACE_MIN_PER_KM;
const mToMin = (m: number) => Math.floor((m * RUN_PACE_MIN_PER_KM) / 1000 + 1e-9);
const lerp = (r: readonly [number, number], t: number) => Math.round(r[0] + (r[1] - r[0]) * t);
const needsPool = (e: PlanExercise) => e.equipment.every((q) => q === "pool");

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

/** A demand that survived injuries and equipment, placed on a weekday. `from` = title it replaced. */
type Slot = { d: PlanDemand; n: number; from?: string };

export function generateBlock(input: GenerateBlockInput): PlanBlockResult {
  const { profile, injuries, history, startDate, seed } = input;
  const { allowed } = filterForInjuries(input.exercises, injuries);
  const exById = new Map(input.exercises.map((e) => [e.id, e]));
  const poolDays = [...new Set(profile.poolDays)].sort((a, b) => a - b);
  const have = new Set(["bodyweight", ...profile.equipment]);
  if (poolDays.length) have.add("pool");
  const hasGym = have.has("gym");
  const homeEquip = new Set([...have].filter((e) => e !== "gym"));
  const trainDays = profile.trainingDays?.length ? [...new Set(profile.trainingDays)] : DAYS;

  const start = Date.parse(`${startDate}T12:00:00Z`);
  const runs = history.runs.map((r) => ({ at: r.at, value: r.distanceM }));
  const plyo = history.plyoContacts.map((p) => ({ at: p.at, value: p.contacts }));
  const sets: Record<string, { at: number; value: number }[]> = {};
  for (const [m, l] of Object.entries(history.hardSetsByMuscle))
    sets[m] = l.map((h) => ({ at: h.at, value: h.sets }));

  const recent = (l: { at: number }[]) =>
    l.some((h) => h.at <= start && start - h.at <= SPIKE_WINDOW_MS);
  const noPlyoHistory = !recent(history.plyoContacts);
  const noRunHistory = !recent(history.runs);
  const noSetsHistory = (m: string) => !recent(history.hardSetsByMuscle[m] ?? []);

  // ---- merge the demands of the profile's goals (same id = same session: bigger count, union of muscles, higher priority) ----
  const merged = new Map<string, PlanDemand>();
  for (const g of input.goals.filter((x) => profile.goals.includes(x.id)))
    for (const d of g.demands) {
      if (d.sport && profile.sports.length && !profile.sports.includes(d.sport)) continue;
      const m = merged.get(d.id);
      merged.set(
        d.id,
        m
          ? {
              ...m,
              perWeek: [Math.max(m.perWeek[0], d.perWeek[0]), Math.max(m.perWeek[1], d.perWeek[1])],
              prefersGym: m.prefersGym || d.prefersGym,
              priority: Math.max(m.priority ?? 0, d.priority ?? 0),
              muscles: m.muscles && [
                ...m.muscles,
                ...(d.muscles ?? []).filter((x) => !m.muscles!.includes(x)),
              ],
            }
          : d,
      );
    }

  const isStrength = (d: PlanDemand) => d.kind === "strength" || d.kind === "light";
  const equipFor = (d: PlanDemand) =>
    isStrength(d) && !(d.prefersGym && hasGym) ? homeEquip : have;
  /** Allowed exercises for a demand; on a known weekday, pool-only ones need a pool day. */
  const cands = (d: PlanDemand, dow?: number) =>
    allowed.filter(
      (e) =>
        e.sessionTypes.includes(d.sessionType) &&
        (!d.role || e.role === d.role) &&
        e.equipment.some((q) => equipFor(d).has(q)) &&
        (d.kind !== "plyo" || e.footContactsPerRep) &&
        (!d.muscles || d.muscles.some((m) => e.primaryMuscles.includes(m))) &&
        (dow === undefined || !poolDays.length || poolDays.includes(dow) || !needsPool(e)),
    );
  /** With no history for a pattern, level n waits until week n. */
  const staged = (c: PlanExercise[], fresh: boolean, w: number) =>
    c.filter((e) => !fresh || e.level - 1 <= w);

  // ---- layout: one weekly pattern, greedy, repeated across the block ----
  const cyc = (a: number, b: number) => Math.min((a - b + 7) % 7, (b - a + 7) % 7);
  /** Keys that make two sessions "the same type": the session type, and one pool visit. */
  const keysOf = (d: PlanDemand) => {
    const c = cands(d);
    return [d.sessionType, ...(c.length && c.every(needsPool) ? ["@pool"] : [])];
  };

  const warnings: PlanWarning[] = [];
  const resolved = [...merged.values()].flatMap((d) => {
    const opts: PlanDemand[] = [
      d,
      ...(d.alternatives ?? []).map((a) => ({ ...d, ...a, alternatives: undefined })),
    ];
    const i = opts.findIndex((o) => cands(o).length > 0);
    if (i < 0)
      warnings.push({
        demandId: d.id,
        title: d.title,
        reason: `No ${d.title.toLowerCase()} option fits your injuries or equipment, and no alternative does either`,
      });
    else if (i > 0)
      warnings.push({
        demandId: d.id,
        title: d.title,
        reason: `No ${d.title.toLowerCase()} option fits your injuries or equipment; ${opts[i]!.title!.toLowerCase()} stands in`,
      });
    return i < 0 ? [] : [{ d: opts[i]!, count: d.perWeek, from: i > 0 ? d.title : undefined }];
  });
  const rank = (d: PlanDemand) =>
    d.long ? 3 : cands(d).every(needsPool) ? 0 : d.impact === "high" ? 1 : 2;
  // Highest priority first, so overflow past the daily cap drops the lowest priority.
  resolved.sort(
    (a, b) =>
      (b.d.priority ?? 0) - (a.d.priority ?? 0) ||
      rank(a.d) - rank(b.d) ||
      a.d.id.localeCompare(b.d.id),
  );

  /** Lay one week on the given weekdays. Returns the week and how much priority-weighted minimum it met. */
  function layout(avail: number[], rand: () => number) {
    const week: Slot[][] = DAYS.map(() => []);
    const high = (day: number) => week[day]!.some((x) => x.d.impact === "high");
    function place(d: PlanDemand, n: number, from?: string): boolean {
      const keys = keysOf(d);
      const poolOnly = cands(d).every(needsPool);
      const pool = poolDays.length && poolOnly ? poolDays : DAYS;
      const same = DAYS.filter((x) =>
        week[x]!.some((s) => keysOf(s.d).some((k) => keys.includes(k))),
      );
      const ok = avail.filter(
        (day) =>
          pool.includes(day) &&
          week[day]!.length < MAX_SESSIONS_PER_DAY &&
          !same.includes(day) &&
          // high-impact sessions never share a day or sit on neighbouring days (the week wraps)
          !(d.impact === "high" && DAYS.some((o) => cyc(o, day) <= 1 && high(o))),
      );
      if (!ok.length) return false;
      const score = (day: number) =>
        week[day]!.length * 2 -
        (d.long || !same.length ? 0 : Math.min(3, ...same.map((x) => cyc(day, x)))) +
        rand() * 0.9;
      const best = ok.map((day) => ({ day, s: score(day) })).sort((a, b) => a.s - b.s)[0]!;
      week[best.day]!.push({ d, n, from });
      return true;
    }
    // Pass 1 places every demand's minimum, pass 2 tops up toward the maximum.
    const placed = new Map<string, number>();
    for (const target of [0, 1])
      for (const r of resolved) {
        let n = placed.get(r.d.id) ?? 0;
        while (n < r.count[target]! && place(r.d, n, r.from)) n++;
        placed.set(r.d.id, n);
      }
    const met = resolved.reduce(
      (t, r) => t + Math.min(placed.get(r.d.id) ?? 0, r.count[0]) * ((r.d.priority ?? 0) + 1),
      0,
    );
    return { week, placed, met };
  }

  // Keep at least minRestDaysPerWeek days empty (trainingDays may leave more); try each choice of rest days, keep the best week.
  const forced = Math.max(0, PLAN_CONFIG.minRestDaysPerWeek - (7 - trainDays.length));
  const restSets = (from: number[], k: number): number[][] =>
    k === 0
      ? [[]]
      : from.flatMap((x, i) => restSets(from.slice(i + 1), k - 1).map((r) => [x, ...r]));
  const tries = restSets(trainDays, Math.min(forced, trainDays.length - 1)).map((rest) => {
    const r = layout(
      trainDays.filter((x) => !rest.includes(x)),
      rng(seed ^ hash("layout")),
    );
    return { ...r, tie: rng(seed ^ hash(rest.join()))() };
  });
  const { week, placed } = tries.sort((a, b) => b.met - a.met || a.tie - b.tie)[0]!;
  for (const r of resolved) {
    const n = placed.get(r.d.id) ?? 0;
    if (n < r.count[0])
      warnings.push({
        demandId: r.d.id,
        title: r.d.title,
        reason: `Only ${n} of ${r.count[0]} ${r.d.title.toLowerCase()} session(s) fit per week (days, rest days, pool days and the daily limit)`,
      });
  }

  // ---- builders ----
  /** Seeded order per key, stable across weeks, so week w takes entry w: choices rotate. */
  function pickFor(
    list: PlanExercise[],
    key: string,
    w: number,
    used: Set<string>,
  ): PlanExercise | undefined {
    const r = rng(seed ^ hash(key));
    const order = list.filter((e) => !used.has(e.id)).sort((a, b) => a.id.localeCompare(b.id));
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
    dose: number,
    deload: boolean,
    restSec: number,
    notes = "",
  ): PlanItem {
    let s = lerp(e.rx.sets, dose);
    if (deload) s = Math.max(1, Math.round(s * DELOAD));
    return {
      exerciseId: e.id,
      block,
      sets: s,
      amount: lerp(e.rx.amount, dose),
      unit: e.unit,
      restSec,
      notes,
      muscles: [...e.primaryMuscles],
    };
  }

  function strength(
    d: PlanDemand,
    dow: number,
    n: number,
    w: number,
    dose: number,
    deload: boolean,
  ) {
    const list = cands(d, dow);
    const used = new Set<string>();
    const out: PlanItem[] = [];
    for (const m of d.muscles ?? []) {
      const fresh = noSetsHistory(m);
      let e = pickFor(
        staged(
          list.filter((c) => c.primaryMuscles.includes(m)),
          fresh,
          w,
        ),
        `${d.id}${n}${m}`,
        w,
        used,
      );
      // week 1, no history for this muscle: start from the regression variant when it is available
      const easier =
        e?.regressionId && fresh && w === 0
          ? list.find((c) => c.id === e!.regressionId && !used.has(c.id))
          : undefined;
      if (easier) {
        used.add(easier.id);
        e = easier;
      }
      if (e) out.push(item(e, d.sessionType, dose, deload, e.rx.amount[1] <= 8 ? 120 : 75));
    }
    return out;
  }

  /** Trim sets so each muscle's session total stays under the spike guard, then record it as history. */
  function guardSets(items: PlanItem[], at: number) {
    const total = (m: string) =>
      items.reduce((n, i) => n + (i.muscles.includes(m) ? i.sets : 0), 0);
    for (const m of new Set(items.flatMap((i) => i.muscles))) {
      const g = spikeGuard({
        metric: "hard_sets",
        planned: total(m),
        history: sets[m] ?? [],
        now: at,
        starter: STARTER.hardSetsPerMuscle,
      });
      while (total(m) > g.value) {
        const top = items
          .filter((i) => i.muscles.includes(m) && i.sets > 0)
          .sort((a, b) => b.sets - a.sets)[0]!;
        top.sets--;
      }
    }
    for (const m of new Set(items.flatMap((i) => i.muscles)))
      (sets[m] ??= []).push({ at, value: total(m) });
    return items.filter((i) => i.sets > 0);
  }

  function runItem(
    d: PlanDemand,
    dow: number,
    w: number,
    desiredMin: number,
    at: number,
  ): PlanItem | undefined {
    const e = pickFor(staged(cands(d, dow), noRunHistory, w), d.id, w, new Set());
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
      block: d.sessionType,
      sets: 1,
      amount: min,
      unit: "minutes",
      restSec: 0,
      notes: g.reason,
      muscles: [...e.primaryMuscles],
      distanceM,
      ...(e.intensity ? { intensity: e.intensity } : {}),
    };
  }

  function plyoItems(d: PlanDemand, dow: number, w: number, slot: number, at: number): PlanItem[] {
    const deload = w === DELOAD_WEEK;
    const desired = Math.floor(PLYO_START_CONTACTS * 1.1 ** Math.min(w, 2) * (deload ? DELOAD : 1));
    const g = spikeGuard({
      metric: "foot_contacts",
      planned: desired,
      history: plyo,
      now: at,
      starter: STARTER.footContacts,
    });
    const target = Math.floor(g.value);
    const list = staged(cands(d, dow), noPlyoHistory, w);
    const used = new Set<string>();
    const picks = [0, 1, 2]
      .map((i) => pickFor(list, `${d.id}${slot}`, w + i, used))
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
      ...item(x.e, d.sessionType, 0, false, 90, "Land softly, stop if form breaks"),
      sets: x.s,
      amount: x.r,
      footContacts: fc(x),
    }));
    const total = out.reduce((n, i) => n + (i.footContacts ?? 0), 0);
    if (total > 0) plyo.push({ at, value: total });
    return out;
  }

  function cardioItems(
    d: PlanDemand,
    dow: number,
    w: number,
    dose: number,
    deload: boolean,
    poolTaken: boolean,
  ) {
    // one pool visit a day: a mixed-equipment stand-in falls back to dry options when the pool is used
    const list = staged(
      cands(d, dow).filter((e) => !poolTaken || !needsPool(e)),
      true,
      w,
    );
    const used = new Set<string>();
    return Array.from({ length: d.items ?? 1 }, (_, i) => pickFor(list, d.id, w + i, used))
      .filter((e): e is PlanExercise => !!e)
      .map((e) => item(e, d.sessionType, dose, deload, 30));
  }

  const warmup = (key: string, equip: Set<string>, w: number): PlanItem[] => {
    const list = allowed.filter(
      (e) => e.sessionTypes.includes("warmup") && e.equipment.some((q) => equip.has(q)),
    );
    const used = new Set<string>();
    return [0, 1, 2, 3]
      .map((i) => pickFor(list, `warmup${key}`, w + i, used))
      .filter((e): e is PlanExercise => !!e)
      .map((e) => item(e, "warmup", 0, false, 20, "Prevention warm-up"));
  };

  // Long run grows 10% a week from the biggest recent run; deload week is 65% of week 3.
  const recentMax = Math.max(
    0,
    ...runs.filter((r) => r.at <= start && start - r.at <= SPIKE_WINDOW_MS).map((r) => r.value),
  );
  const anchorM = recentMax > 0 ? recentMax : STARTER.runDistanceM;
  const longMin = (w: number) =>
    mToMin(anchorM * 1.1 ** Math.min(w, 2) * (w === DELOAD_WEEK ? DELOAD : 1));

  // Runs are guarded against history as of the start of their week: a short midweek run must not lower the long-run cap.
  let weekRuns = runs.slice();
  const rows: PlannedSessionRow[] = [];
  const stamp = input.now ?? Date.now();

  for (let day = 0; day < BLOCK_DAYS; day++) {
    const w = Math.floor(day / 7);
    if (day % 7 === 0) weekRuns = runs.slice();
    const deload = w === DELOAD_WEEK;
    const dose = deload ? 0.8 : [0.2, 0.5, 0.8][w]!;
    const ms = start + day * DAY_MS;
    const date = new Date(ms).toISOString().slice(0, 10);
    const dow = new Date(ms).getUTCDay();
    const wk = deload ? " (deload)" : "";

    let poolToday = false;
    // pool-only sessions first, so a stand-in that could go either way never takes their pool visit
    const todays = [...week[dow]!].sort(
      (a, b) => +keysOf(b.d).includes("@pool") - +keysOf(a.d).includes("@pool"),
    );
    for (const { d, n, from } of todays) {
      let items: PlanItem[];
      let type: WorkoutType;
      if (isStrength(d)) {
        items = strength(d, dow, n, w, d.kind === "light" ? LIGHT_DOSE : dose, deload);
        if (d.kind === "strength") items = guardSets(items, ms);
        type = d.workoutType ?? (d.prefersGym && hasGym ? "gym" : "home");
      } else if (d.kind === "plyo") {
        items = plyoItems(d, dow, w, n, ms);
        type = d.workoutType ?? "plyo";
      } else if (d.kind === "run") {
        const it = runItem(d, dow, w, Math.round(longMin(w) * (d.volume ?? 1)), ms);
        items = it ? [it] : [];
        type = d.workoutType ?? "run";
      } else {
        items = cardioItems(d, dow, w, dose, deload, poolToday);
        const inPool = items.length > 0 && items.every((i) => needsPool(exById.get(i.exerciseId)!));
        poolToday ||= inPool;
        type = inPool ? "swim" : (d.workoutType ?? "home");
      }
      if (!items.length) {
        if (!warnings.some((x) => x.demandId === d.id && x.reason.startsWith("Could not")))
          warnings.push({
            demandId: d.id,
            title: d.title,
            reason: `Could not build ${d.title.toLowerCase()} on some days: nothing safe and within your load limits fits`,
          });
        continue;
      }
      if (from) {
        const why = `No ${from.toLowerCase()} option fits your injuries or equipment; ${d.title.toLowerCase()} stands in`;
        items[0]!.notes = items[0]!.notes ? `${why}. ${items[0]!.notes}` : why;
      }
      rows.push({
        ...newRow(stamp),
        date,
        type,
        title: `${d.title}${from ? ` (instead of ${from.toLowerCase()})` : ""}${wk}`,
        warmup: warmup(d.id, type === "gym" ? have : homeEquip, w),
        items,
        status: "planned",
      });
    }
  }
  return { sessions: rows, warnings };
}
