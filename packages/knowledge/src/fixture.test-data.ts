// A fixed, minimal data set for tests of validate() and publish(), so the tests don't depend on
// the real content K tasks add. One source cited by one claim, muscle, link, cue and fault.
import type { KnowledgeData } from "./types.ts";

const draft = { state: "draft" as const };

export const fixture = (): KnowledgeData =>
  structuredClone({
    sources: [
      {
        id: "src-test",
        type: "textbook",
        citation: "Test source.",
        url: "https://example.org/test",
        year: 2024,
        licence: "CC BY 4.0",
        review: draft,
      },
    ],
    muscles: [
      {
        id: "gluteus-maximus",
        name: "Gluteus maximus",
        aliases: [],
        region: "hip-trunk",
        bodyMapArea: "gluteal",
        actions: ["hip extension"],
        dailyLifeRole: "Drives you up from a chair.",
        claims: ["claim-test"],
        review: draft,
      },
    ],
    muscleGroups: [],
    exerciseMuscles: [{ exerciseId: "glute_bridge", muscleId: "gluteus-maximus", role: "primary", sourceId: "src-test", review: draft }],
    cues: [
      {
        id: "cue-test",
        exerciseId: "glute_bridge",
        text: "Ribs down, squeeze your glutes at the top",
        phase: "top",
        sourceId: "src-test",
        review: draft,
      },
    ],
    faults: [
      {
        id: "fault-test",
        exerciseId: "glute_bridge",
        description: "Lower back arches at the top.",
        whyItMatters: "The work moves to the lower back.",
        cueId: "cue-test",
        severity: "low",
        sourceId: "src-test",
        review: draft,
      },
    ],
    claims: [
      {
        id: "claim-test",
        text: "The gluteus maximus extends the hip.",
        sourceId: "src-test",
        grade: "C",
        subjects: ["gluteus-maximus"],
        review: draft,
      },
    ],
    videoSegments: [],
  } as KnowledgeData);
