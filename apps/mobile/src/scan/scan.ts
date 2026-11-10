import { humanizeId } from "../lib/intake";

export type ScanKind = "medical" | "log";
export const SCAN_KINDS: { id: ScanKind; label: string }[] = [
  { id: "medical", label: "Medical report" },
  { id: "log", label: "Training log" },
];

type Decision = "approved" | "rejected" | null;
export type ScanItem =
  | { itemId: string; kind: "injury"; bodyArea: string; side: string; description: string; startedOn: string; decision: Decision }
  | {
      itemId: string;
      kind: "session";
      date: string;
      type: string;
      exercises: { name: string; sets: { reps?: number | null; loadKg?: number | null; durationS?: number | null }[] }[];
      decision: Decision;
    };
export type Scan = {
  id: string;
  kind: ScanKind;
  status: "pending" | "approved" | "rejected";
  extracted: { items: ScanItem[]; unreadable: boolean; dropped: number };
};

export type Upload = { uri: string; name: string; type: string };

/** Multipart fields in the order the server reads them; `tzOffsetMin` is minutes east of UTC. */
export function scanParts(p: { file: Upload; kind: ScanKind; text: string; tzOffsetMin: number }) {
  return [
    ["file", p.file],
    ["kind", p.kind],
    ["text", p.text],
    ["tzOffsetMin", String(p.tzOffsetMin)],
  ] as const;
}

export const tzOffsetMin = (d = new Date()) => -d.getTimezoneOffset() || 0;

const setLabel = (s: { reps?: number | null; loadKg?: number | null; durationS?: number | null }) =>
  [s.reps != null && `${s.reps} reps`, s.loadKg != null && `${s.loadKg} kg`, s.durationS != null && `${s.durationS} s`]
    .filter(Boolean)
    .join(" x ") || "set";

/** Card text for one extracted item (read-only). */
export function itemLabel(i: ScanItem): { title: string; lines: string[] } {
  if (i.kind === "injury")
    return {
      title: `Injury: ${[i.side && i.side !== "na" ? humanizeId(i.side) : "", humanizeId(i.bodyArea)].filter(Boolean).join(" ")}`,
      lines: [i.description, i.startedOn && `Since ${i.startedOn}`].filter(Boolean),
    };
  return {
    title: `Session: ${humanizeId(i.type)} on ${i.date}`,
    lines: i.exercises.map((e) => `${e.name}: ${e.sets.length ? e.sets.map(setLabel).join(", ") : "no sets"}`),
  };
}

export const pendingIds = (s: Scan) => s.extracted.items.filter((i) => i.decision === null).map((i) => i.itemId);
