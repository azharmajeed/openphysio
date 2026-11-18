// One import per data file. Files are registered up front so parallel K tasks only edit their own JSON.
// Owners (v0.2): K2a lower-limb, hip-trunk, lower; K2b upper-limb, neck-shoulder, upper; K3a exercise-muscles;
// K3b/K3c/K3d technique-lower/-upper/-trunk with cues and faults lower-body/upper-body/trunk; K5 video-segments.
import type { KnowledgeData } from "./types.ts";
import sourcesGeneral from "../data/sources/general.json" with { type: "json" };
import sourcesAnatomyLower from "../data/sources/anatomy-lower.json" with { type: "json" };
import sourcesAnatomyUpper from "../data/sources/anatomy-upper.json" with { type: "json" };
import sourcesTechniqueLower from "../data/sources/technique-lower.json" with { type: "json" };
import sourcesTechniqueUpper from "../data/sources/technique-upper.json" with { type: "json" };
import sourcesTechniqueTrunk from "../data/sources/technique-trunk.json" with { type: "json" };
import musclesHipTrunk from "../data/muscles/hip-trunk.json" with { type: "json" };
import musclesLowerLimb from "../data/muscles/lower-limb.json" with { type: "json" };
import musclesUpperLimb from "../data/muscles/upper-limb.json" with { type: "json" };
import musclesNeckShoulder from "../data/muscles/neck-shoulder.json" with { type: "json" };
import muscleGroupsAll from "../data/muscle-groups/all.json" with { type: "json" };
import muscleGroupsLower from "../data/muscle-groups/lower.json" with { type: "json" };
import muscleGroupsUpper from "../data/muscle-groups/upper.json" with { type: "json" };
import exerciseMusclesLowerBody from "../data/exercise-muscles/lower-body.json" with { type: "json" };
import cuesLowerBody from "../data/cues/lower-body.json" with { type: "json" };
import cuesUpperBody from "../data/cues/upper-body.json" with { type: "json" };
import cuesTrunk from "../data/cues/trunk.json" with { type: "json" };
import faultsLowerBody from "../data/faults/lower-body.json" with { type: "json" };
import faultsUpperBody from "../data/faults/upper-body.json" with { type: "json" };
import faultsTrunk from "../data/faults/trunk.json" with { type: "json" };
import claimsHipTrunk from "../data/claims/hip-trunk.json" with { type: "json" };
import claimsLowerLimb from "../data/claims/lower-limb.json" with { type: "json" };
import claimsUpperLimb from "../data/claims/upper-limb.json" with { type: "json" };
import videoSegmentsAll from "../data/video-segments/all.json" with { type: "json" };

export const all = {
  sources: [...sourcesGeneral, ...sourcesAnatomyLower, ...sourcesAnatomyUpper, ...sourcesTechniqueLower, ...sourcesTechniqueUpper, ...sourcesTechniqueTrunk],
  muscles: [...musclesHipTrunk, ...musclesLowerLimb, ...musclesUpperLimb, ...musclesNeckShoulder],
  muscleGroups: [...muscleGroupsAll, ...muscleGroupsLower, ...muscleGroupsUpper],
  exerciseMuscles: [...exerciseMusclesLowerBody],
  cues: [...cuesLowerBody, ...cuesUpperBody, ...cuesTrunk],
  faults: [...faultsLowerBody, ...faultsUpperBody, ...faultsTrunk],
  claims: [...claimsHipTrunk, ...claimsLowerLimb, ...claimsUpperLimb],
  videoSegments: [...videoSegmentsAll],
} as KnowledgeData;
