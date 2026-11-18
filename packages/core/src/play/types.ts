import type { PainKind } from "../types/index.ts";

export const PLAY_EVENTS = [
  "plannedSessionCompleted",
  "setLogged",
  "painCheckAnswered",
  "weeklyCheckIn",
  "unplannedSessionLogged",
] as const;
export type PlayEvent = (typeof PLAY_EVENTS)[number];

/** Rule values live in data (packages/catalog/src/play.json). */
export type PlayRules = {
  points: Record<PlayEvent, number>;
  dailyCap: number;
  /** threshold: share of a week's planned sessions that must be done for the week to count. */
  streak: { threshold: number };
  /** 0 = Sunday, 1 = Monday ... 6 = Saturday. */
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;
};

type Live = { deletedAt?: number | null };
type PlanLine = { exerciseId: string; sets: number };

export type PlayInput = {
  /** date is a local YYYY-MM-DD string. */
  planned: readonly ({ id: string; date: string; items: readonly PlanLine[]; warmup?: readonly PlanLine[] } & Live)[];
  workouts: readonly ({
    id: string;
    startedAt: number;
    endedAt: number | null;
    plannedSessionId?: string | null;
    durationS?: number | null;
  } & Live)[];
  /** updatedAt is the time the set was logged. */
  sets: readonly ({ workoutId: string; exerciseId: string; setIndex: number; updatedAt: number } & Live)[];
  pain: readonly ({ id: string; workoutId?: string | null; score: number; kind: PainKind; at: number } & Live)[];
  /** Local YYYY-MM-DD dates the user did the weekly check-in. */
  checkIns: readonly string[];
  rules: PlayRules;
  /** ms to local YYYY-MM-DD. Default: the device's local time. */
  toDate?: (ms: number) => string;
};

export type LedgerEntry = { id: string; date: string; event: PlayEvent; points: number; refId: string };

export type StreakResult = {
  current: number;
  best: number;
  thisWeek: { weekStart: string; done: number; planned: number; points: number };
};
