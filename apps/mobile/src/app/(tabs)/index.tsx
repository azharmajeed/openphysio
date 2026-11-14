import { Link, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text } from "react-native";
import { BandCard } from "../../health/BandCard";
import { ADAPT_CONFIG, daysLeftInWeek, type AdaptResult } from "@openphysio/core";
import { proposeNextWeek, reviewedWeek } from "../../lib/adaptdb";
import { planColors, ymd } from "../../lib/plan";
import { allPlanned, type Planned } from "../../lib/plandb";
import { SessionCard } from "../../plan/SessionCard";

export default function Today() {
  const router = useRouter();
  const [all, setAll] = useState<Planned[] | null>(null);
  const [review, setReview] = useState(false);
  useFocusEffect(
    useCallback(() => {
      void allPlanned().then(setAll);
      void proposeNextWeek().then((r: AdaptResult) =>
        setReview(!!r.week && daysLeftInWeek(r.week, ymd(new Date())) <= ADAPT_CONFIG.checkinDays && r.changes.length > 0 && reviewedWeek() !== r.week.next.start),
      );
    }, []),
  );
  if (!all) return null;
  const colorOf = planColors(all);
  const today = all.filter((s) => s.date === ymd(new Date()));

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <BandCard />
      {review && (
        <Pressable onPress={() => router.push("/checkin")} style={{ backgroundColor: "#eff6ff", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <Text style={{ fontWeight: "700" }}>Review next week</Text>
          <Text>Your plan has suggested changes based on this week.</Text>
        </Pressable>
      )}
      <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>Today</Text>
      {today.map((s) => (
        <SessionCard key={s.id} s={s} color={colorOf(s.type)} onStart={() => router.push(`/session/${s.id}`)} />
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
