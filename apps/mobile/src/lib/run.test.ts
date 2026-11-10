import { describe, expect, it } from "vitest";
import { fmtDistance, fmtDur, fmtPace, swimNotes } from "./run";

describe("run formatting", () => {
  it("formats durations", () => {
    expect(fmtDur(65)).toBe("1:05");
    expect(fmtDur(3725)).toBe("1:02:05");
  });
  it("formats pace, unknown as dashes", () => {
    expect(fmtPace(333.3)).toBe("5:33");
    expect(fmtPace(null)).toBe("-:--");
  });
  it("formats distance by type", () => {
    expect(fmtDistance("swim", 750)).toBe("750 m");
    expect(fmtDistance("run", 5230)).toBe("5.23 km");
  });
  it("joins stroke and notes", () => {
    expect(swimNotes("freestyle", " easy ")).toBe("freestyle · easy");
    expect(swimNotes(null, "")).toBeNull();
  });
});
