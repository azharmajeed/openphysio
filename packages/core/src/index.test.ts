import { expect, test } from "vitest";
import { name } from "./index.ts";

test("exports package name", () => {
  expect(name).toBe("@openphysio/core");
});
