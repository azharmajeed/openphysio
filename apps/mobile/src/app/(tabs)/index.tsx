import { Link, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text } from "react-native";
import { BandCard } from "../../health/BandCard";
import { ymd } from "../../lib/plan";
import { allPlanned, type Planned } from "../../lib/plandb";
import { SessionCard } from "../../plan/SessionCard";

export default function Today() {
  const router = useRouter();
  const [all, setAll] = useState<Planned[] | null>(null);
  useFocusEffect(
    useCallback(() => {
      void allPlanned().then(setAll);
    }, []),
  );
  if (!all) return null;
  const today = all.filter((s) => s.date === ymd(new Date()));

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <BandCard />
      <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>Today</Text>
      {today.map((s) => (
        <SessionCard key={s.id} s={s} onStart={() => router.push(`/session/${s.id}`)} />
      ))}
      {today.length === 0 && (
        <Text>
          {all.length === 0 ? "No plan yet. " : "Nothing planned today: rest day. "}
          <Link href="/plan" style={{ color: "#2563eb" }}>
            {all.length === 0 ? "Generate your 4-week plan" : "See the plan"}
          </Link>
        </Text>
      )}
    </ScrollView>
  );
}
