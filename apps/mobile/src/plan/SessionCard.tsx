import { getExercise } from "@openphysio/catalog";
import type { PlanItem } from "@openphysio/core";
import { Pressable, Text, View } from "react-native";
import { describeItem, typeColors } from "../lib/plan";
import type { Planned } from "../lib/plandb";

const Line = ({ i }: { i: PlanItem }) => (
  <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
    <Text style={{ flex: 1 }}>
      {getExercise(i.exerciseId)?.name ?? i.exerciseId}: {describeItem(i)}
    </Text>
    {/* D-8: no clips yet, just the flag */}
    <Text style={{ fontSize: 11, color: "#6b7280", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 4, paddingHorizontal: 4 }}>Film it</Text>
  </View>
);

/** One planned session: warm-up first, then the exercises. */
export function SessionCard({ s, color = typeColors([s.type])(s.type), onStart }: { s: Planned; color?: string; onStart?: () => void }) {
  return (
    <View style={{ borderLeftWidth: 6, borderColor: color, backgroundColor: "#f9fafb", borderRadius: 8, padding: 12, marginBottom: 12 }}>
      <Text style={{ fontSize: 16, fontWeight: "700" }}>{s.title}</Text>
      <Text style={{ color, fontWeight: "600", marginBottom: 6 }}>
        {s.type} · {s.status}
      </Text>
      {s.warmup.length > 0 && <Text style={{ fontWeight: "600", marginTop: 4 }}>Warm-up</Text>}
      {s.warmup.map((i, n) => (
        <Line key={`w${n}`} i={i} />
      ))}
      <Text style={{ fontWeight: "600", marginTop: 8 }}>Main</Text>
      {s.items.map((i, n) => (
        <Line key={`m${n}`} i={i} />
      ))}
      {s.items
        .map((i) => i.notes)
        .filter(Boolean)
        .map((n, k) => (
          <Text key={k} style={{ marginTop: 6, fontStyle: "italic" }}>
            {n}
          </Text>
        ))}
      {onStart && s.status === "planned" && (
        <Pressable onPress={onStart} style={{ marginTop: 12, padding: 14, borderRadius: 8, backgroundColor: color, alignItems: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>Start session</Text>
        </Pressable>
      )}
    </View>
  );
}
