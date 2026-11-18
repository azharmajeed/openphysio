export const REVIEW_STATES = ["draft", "source-checked", "clinician-reviewed", "rejected"] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

/** Every record carries one. `source-checked`: the reviewer confirmed the source supports the entry (D-21). */
export type Review = {
  state: ReviewState;
  reviewer?: string;
  date?: string;
  notes?: string;
};

export const GRADES = ["A", "B", "C"] as const; // A guideline/consensus, B review/RCT, C convention
export type Grade = (typeof GRADES)[number];
export const SOURCE_TYPES = ["guideline", "review", "RCT", "textbook", "video"] as const;
export const REGIONS = ["lower-limb", "hip-trunk", "upper-limb", "neck-shoulder"] as const;
export const ROLES = ["primary", "secondary", "stabiliser"] as const;
export const PHASES = [
  "setup",
  "descent",
  "bottom",
  "ascent",
  "top",
  "breathing",
  "whole",
] as const;
export const SEVERITIES = ["low", "medium", "high"] as const;

export type Source = {
  id: string;
  type: (typeof SOURCE_TYPES)[number];
  citation: string;
  doi?: string;
  pmid?: string;
  url?: string;
  year: number;
  licence: string;
  review: Review;
};

export type Muscle = {
  id: string;
  name: string;
  aliases: string[];
  region: (typeof REGIONS)[number];
  /** A slug from data/body-map-areas.json. Omit for deep muscles with no slug. */
  bodyMapArea?: string;
  actions: string[];
  dailyLifeRole: string;
  origin?: string;
  insertion?: string;
  /** Claim ids. */
  claims: string[];
  review: Review;
};

export type MuscleGroup = {
  id: string;
  name: string;
  muscleIds: string[];
  bodyMapAreas: string[];
  review: Review;
};

export type ExerciseMuscle = {
  exerciseId: string;
  muscleId: string;
  role: (typeof ROLES)[number];
  sourceId: string;
  review: Review;
};

export type Cue = {
  id: string;
  exerciseId: string;
  /** At most 12 words. */
  text: string;
  phase: (typeof PHASES)[number];
  sourceId: string;
  review: Review;
};

export type Fault = {
  id: string;
  exerciseId: string;
  description: string;
  whyItMatters: string;
  cueId: string;
  /** Camera rule that detects it (FormRule arrives in v0.3, not validated yet). */
  formRuleId?: string;
  severity: (typeof SEVERITIES)[number];
  sourceId: string;
  review: Review;
};

export type Claim = {
  id: string;
  /** Our paraphrase, never source text. */
  text: string;
  sourceId: string;
  grade: Grade;
  /** Muscle, exercise or goal ids. */
  subjects: string[];
  review: Review;
};

export type VideoSegment = {
  id: string;
  videoId: string;
  channelId: string;
  startSec: number;
  endSec: number;
  title: string;
  /** Our words. */
  summary: string;
  subjects: string[];
  sourceId: string;
  review: Review;
};

export type KnowledgeData = {
  sources: Source[];
  muscles: Muscle[];
  muscleGroups: MuscleGroup[];
  exerciseMuscles: ExerciseMuscle[];
  cues: Cue[];
  faults: Fault[];
  claims: Claim[];
  videoSegments: VideoSegment[];
};
