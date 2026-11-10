import { goals } from "@openphysio/catalog";
import { adjustFromTrend, dailyTargets, newRow, resolveNutrition, weightEntry, type WeightPoint } from "@openphysio/core";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { db } from "../db";
import { input } from "../ui";
import { ymd } from "../lib/plan";
import { Card } from "./Charts";

export type NutritionData = {
  profile: { birthYear: number | null; sex: "male" | "female" | "other" | null; heightCm: number | null; goals: string[] };
  weights: WeightPoint[];
  latestKg: number | null;
  sessionsPerWeek: number;
  bandActiveKcal: number | null;
};

const STATUS = {
  below_range: "Weight trend is below your goal range",
  above_range: "Weight trend is above your goal range",
  on_track: "Weight trend is inside your goal range",
} as const;

/** Today's kcal and protein targets, the 14-day trend adjustment with its grade, and a quick add-weight. */
export function NutritionCard({ d, onAdded }: { d: NutritionData; onAdded: () => void }) {
  const [kg, setKg] = useState("");
  const now = new Date();
  const n = resolveNutrition(goals, d.profile.goals);
  const ready = d.profile.birthYear && d.profile.sex && d.profile.heightCm && d.latestKg;
  const trend = adjustFromTrend(d.weights, now, n);
  const t = ready
    ? dailyTargets(
        { weightKg: d.latestKg!, heightCm: d.profile.heightCm!, birthYear: d.profile.birthYear!, sex: d.profile.sex!, sessionsPerWeek: d.sessionsPerWeek, bandActiveKcal: d.bandActiveKcal, trendDeltaKcal: trend.deltaKcal, nutrition: n },
        now,
      )
    : null;
  const add = async () => {
    const v = Number(kg.trim().replace(",", "."));
    if (!(v > 20 && v < 400)) return;
    await db.insert(weightEntry).values({ ...newRow(), date: ymd(now), kg: v });
    setKg("");
    onAdded();
  };
  return (
    <Card title="Nutrition" sub={t ? `Today: ${t.kcal} kcal, protein ${t.proteinG.min}-${t.proteinG.max} g` : undefined}>
      {!t && <Text>Add height, birth year, sex and a weight (Profile) to see targets.</Text>}
      {t && (
        <Text style={{ marginBottom: 4 }}>
          Maintenance {t.maintenanceKcal} kcal{d.bandActiveKcal ? `, includes band active ${d.bandActiveKcal} kcal` : ""}. About {t.perMealG} g protein per meal.
        </Text>
      )}
      <Text style={{ marginBottom: 4 }}>
        {trend.status === "not_enough_data"
          ? "Trend: log weight on 4+ days across 10+ days to get an adjustment."
          : `${STATUS[trend.status]} (${trend.kgPerWeek} kg/week), ${trend.deltaKcal > 0 ? "+" : ""}${trend.deltaKcal} kcal. ${trend.label}`}
      </Text>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 8 }}>
        <TextInput style={{ ...input, flex: 1, marginBottom: 0 }} value={kg} onChangeText={setKg} keyboardType="decimal-pad" placeholder="Weight today (kg)" />
        <Pressable onPress={() => void add()} style={{ padding: 10, borderRadius: 8, backgroundColor: "#2563eb" }}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>Add weight</Text>
        </Pressable>
      </View>
    </Card>
  );
}
