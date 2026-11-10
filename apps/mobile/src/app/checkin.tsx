import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { AdaptResult } from "@openphysio/core";
import { applyNextWeek, markReviewed, proposeNextWeek } from "../lib/adaptdb";

const LABEL = { regress: "Easier", progress: "Step up", remove: "Removed", lower_intensity: "Lighter", keep: "Note", swap: "Swap", volume: "Volume", move: "Moved" } as const;

export default function CheckIn() {
  const router = useRouter();
  const [r, setR] = useState<AdaptResult | null>(null);
  useEffect(() => void proposeNextWeek().then(setR), []);
  if (!r) return null;
  const done = async (apply: boolean) => {
    if (apply) await applyNextWeek(r);
    else if (r.week) markReviewed(r.week.next.start);
    router.back();
  };
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>Next week, adjusted for this week</Text>
      {r.changes.length === 0 && <Text>Nothing to change. Next week stays as planned.</Text>}
      {r.changes.map((c, n) => (
        <View key={n} style={{ backgroundColor: c.flag ? "#fef2f2" : "#f9fafb", borderRadius: 8, padding: 12, marginBottom: 8 }}>
          <Text style={{ fontWeight: "700" }}>
            {LABEL[c.kind]}: {c.from}
            {c.kind !== "keep" && ` → ${c.to}`}
          </Text>
          <Text style={{ marginTop: 2 }}>{c.reason}</Text>
          {c.flag && <Text style={{ color: "#b91c1c", fontWeight: "600", marginTop: 2 }}>Please get this checked by a physio.</Text>}
          {c.grade && <Text style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>Evidence grade {c.grade}, {c.sourceIds?.join(", ")}</Text>}
        </View>
      ))}
      <Pressable onPress={() => void done(true)} style={{ backgroundColor: "#2563eb", borderRadius: 8, padding: 14, marginTop: 8 }}>
        <Text style={{ color: "white", textAlign: "center", fontWeight: "700" }}>Apply changes</Text>
      </Pressable>
      <Pressable onPress={() => void done(false)} style={{ padding: 14 }}>
        <Text style={{ textAlign: "center", color: "#2563eb" }}>Keep next week as planned</Text>
      </Pressable>
    </ScrollView>
  );
}
