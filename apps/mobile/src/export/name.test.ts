import { describe, expect, it } from "vitest";
import { exportFilename, formatsFor } from "./name";

describe("export naming", () => {
  it("builds date + time + type filename", () => {
    const t = new Date(2026, 10, 9, 7, 5).getTime();
    expect(exportFilename("run", t, "gpx")).toBe("2026-11-09_0705_run.gpx");
    expect(exportFilename("swim", t, "tcx")).toBe("2026-11-09_0705_swim.tcx");
  });
  it("offers TCX only for swims", () => {
    expect(formatsFor("swim")).toEqual(["tcx"]);
    expect(formatsFor("run")).toEqual(["gpx", "tcx"]);
  });
});
