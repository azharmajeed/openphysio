import { expect, test } from "vitest";
import { itemLabel, pendingIds, scanParts, tzOffsetMin, type Scan } from "./scan.ts";

test("multipart fields carry file, kind, text and offset", () => {
  const file = { uri: "file:///a.jpg", name: "a.jpg", type: "image/jpeg" };
  expect(scanParts({ file, kind: "log", text: "x", tzOffsetMin: 330 })).toEqual([
    ["file", file],
    ["kind", "log"],
    ["text", "x"],
    ["tzOffsetMin", "330"],
  ]);
});

test("offset is minutes east of UTC", () => {
  expect(tzOffsetMin({ getTimezoneOffset: () => -330 } as Date)).toBe(330);
  expect(tzOffsetMin({ getTimezoneOffset: () => 0 } as Date)).toBe(0);
});

test("labels", () => {
  const inj = itemLabel({ itemId: "1", kind: "injury", bodyArea: "knee", side: "left", description: "ACL", startedOn: "2025-01-02", decision: null });
  expect(inj.title).toBe("Injury: Left Knee");
  expect(inj.lines).toEqual(["ACL", "Since 2025-01-02"]);
  const s = itemLabel({
    itemId: "2",
    kind: "session",
    date: "2025-03-01",
    type: "lower_strength",
    exercises: [{ name: "Squat", sets: [{ reps: 5, loadKg: 60 }, {}] }, { name: "Plank", sets: [] }],
    decision: null,
  });
  expect(s.title).toBe("Session: Lower strength on 2025-03-01");
  expect(s.lines).toEqual(["Squat: 5 reps x 60 kg, set", "Plank: no sets"]);
});

test("pending ids skip decided items", () => {
  const scan = { extracted: { items: [{ itemId: "a", decision: null }, { itemId: "b", decision: "approved" }] } } as unknown as Scan;
  expect(pendingIds(scan)).toEqual(["a"]);
});
