// One import per data file. Parallel K tasks each add their own file and one line here.
import type { KnowledgeData } from "./types.ts";
import sourcesGeneral from "../data/sources/general.json" with { type: "json" };
import musclesHipTrunk from "../data/muscles/hip-trunk.json" with { type: "json" };
import muscleGroupsAll from "../data/muscle-groups/all.json" with { type: "json" };
import exerciseMusclesLowerBody from "../data/exercise-muscles/lower-body.json" with { type: "json" };
import cuesLowerBody from "../data/cues/lower-body.json" with { type: "json" };
import faultsLowerBody from "../data/faults/lower-body.json" with { type: "json" };
import claimsHipTrunk from "../data/claims/hip-trunk.json" with { type: "json" };
import videoSegmentsAll from "../data/video-segments/all.json" with { type: "json" };

export const all = {
  sources: [...sourcesGeneral],
  muscles: [...musclesHipTrunk],
  muscleGroups: [...muscleGroupsAll],
  exerciseMuscles: [...exerciseMusclesLowerBody],
  cues: [...cuesLowerBody],
  faults: [...faultsLowerBody],
  claims: [...claimsHipTrunk],
  videoSegments: [...videoSegmentsAll],
} as KnowledgeData;
