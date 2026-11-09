import type { PlanDemand, PlanGoal } from "@openphysio/core";

// Goal definitions are data: the plan engine reads them, nothing else knows a goal by name.
// Adding a goal = adding an entry here. Demands with the same id across goals are one shared session:
// the larger count wins (not the sum), muscles are united, the higher priority wins.
// priority: higher survives when the week is too full (see PlanWarning).
export type Goal = PlanGoal;
export type Demand = PlanDemand;

/** Low-impact stand-in for a run when every run option is filtered out (injury or equipment). */
const cardio = {
  sessionType: "conditioning",
  kind: "cardio",
  impact: "low",
  title: "Low-impact cardio",
  workoutType: "gym",
} as const;

const LOWER = ["quads", "hamstrings", "glutes", "calves", "quads"];
const UPPER = ["chest", "shoulders", "lats", "triceps", "biceps"];
const BACK = ["upper_back", "lower_back", "abdominals", "glutes"];

export const goals: Goal[] = [
  {
    id: "run_faster_longer",
    label: "Run faster and longer",
    demands: [
      {
        id: "run_quality",
        title: "Quality run",
        sessionType: "run",
        kind: "run",
        perWeek: [1, 1],
        priority: 3,
        impact: "high",
        role: "quality",
        volume: 0.65,
        sport: "running",
        alternatives: [cardio],
      },
      {
        id: "run_long",
        title: "Long run",
        sessionType: "run",
        kind: "run",
        perWeek: [1, 1],
        priority: 3,
        impact: "high",
        role: "long",
        long: true,
        sport: "running",
        alternatives: [cardio],
      },
      {
        id: "run_easy",
        title: "Easy run",
        sessionType: "run",
        kind: "run",
        perWeek: [1, 1],
        priority: 3,
        impact: "moderate",
        role: "easy",
        volume: 0.55,
        sport: "running",
        alternatives: [cardio],
      },
      {
        id: "mobility",
        title: "Mobility and prehab",
        sessionType: "mobility",
        kind: "light",
        perWeek: [1, 1],
        priority: 1,
        impact: "low",
        muscles: ["tibialis", "quads", "calves", "abductors", "quads"],
        workoutType: "mobility",
      },
    ],
  },
  {
    id: "swim_more",
    label: "Swim more",
    demands: [
      {
        id: "swim_technique",
        title: "Swim: technique",
        sessionType: "swim",
        kind: "cardio",
        perWeek: [1, 1],
        priority: 3,
        impact: "low",
        role: "technique",
        items: 2,
        sport: "swimming",
        workoutType: "swim",
      },
      {
        id: "swim_endurance",
        title: "Swim: endurance",
        sessionType: "swim",
        kind: "cardio",
        perWeek: [1, 1],
        priority: 3,
        impact: "low",
        role: "endurance",
        sport: "swimming",
        workoutType: "swim",
        alternatives: [{ ...cardio, role: "easy" }],
      },
    ],
  },
  {
    id: "jump_higher",
    label: "Jump higher",
    demands: [
      {
        id: "plyo",
        title: "Plyometrics",
        sessionType: "plyo",
        kind: "plyo",
        perWeek: [2, 2],
        priority: 3,
        impact: "moderate",
        alternatives: [
          {
            sessionType: "lower_strength",
            kind: "strength",
            impact: "low",
            title: "Lower-body strength",
            muscles: ["glutes", "hamstrings", "calves"],
          },
        ],
      },
      {
        id: "lower_strength",
        title: "Lower strength",
        sessionType: "lower_strength",
        kind: "strength",
        perWeek: [1, 1],
        priority: 2,
        impact: "low",
        muscles: LOWER,
      },
    ],
  },
  {
    id: "stronger_back",
    label: "Stronger back for long sitting, and fitter",
    demands: [
      {
        id: "back_core",
        title: "Back and core",
        sessionType: "back_core",
        kind: "strength",
        perWeek: [2, 2],
        priority: 3,
        impact: "low",
        muscles: BACK,
      },
      {
        id: "upper_strength",
        title: "Upper strength",
        sessionType: "upper_strength",
        kind: "strength",
        perWeek: [1, 1],
        priority: 2,
        impact: "low",
        muscles: ["upper_back", "lats", "shoulders", "chest", "triceps"],
        prefersGym: true,
      },
    ],
  },
  {
    id: "gain_weight",
    label: "Gain healthy weight",
    demands: [
      {
        id: "lower_strength",
        title: "Lower strength",
        sessionType: "lower_strength",
        kind: "strength",
        perWeek: [1, 2],
        priority: 1,
        impact: "low",
        muscles: LOWER,
        prefersGym: true,
      },
      {
        id: "upper_strength",
        title: "Upper strength",
        sessionType: "upper_strength",
        kind: "strength",
        perWeek: [1, 2],
        priority: 1,
        impact: "low",
        muscles: UPPER,
        prefersGym: true,
      },
      {
        id: "back_core",
        title: "Back and core",
        sessionType: "back_core",
        kind: "strength",
        perWeek: [1, 1],
        priority: 1,
        impact: "low",
        muscles: BACK,
        prefersGym: true,
      },
    ],
  },
];
