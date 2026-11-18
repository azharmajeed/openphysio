import { getExercise } from "@openphysio/catalog";
import { ADAPT_CONFIG, daysLeftInWeek, type AdaptResult } from "@openphysio/core";
import { useFocusEffect, useRouter } from "expo-router";
import { CalendarDays, ChevronRight, Play } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { BandCard } from "../../health/BandCard";
import { proposeNextWeek, reviewedWeek } from "../../lib/adaptdb";
import { describeItem, ymd } from "../../lib/plan";
import { allPlanned, type Planned } from "../../lib/plandb";

/** UI0 spike: Today in the kit. UI2a turns it into the tile layout of TP-003. */
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
  const today = all.filter((s) => s.date === ymd(new Date()));

  return (
    <ScrollView className="bg-background" contentContainerClassName="gap-4 p-4">
      <Text variant="muted">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</Text>

      {review && (
        <Pressable onPress={() => router.push("/checkin")}>
          <Card className="flex-row items-center gap-3 px-4 py-4">
            <View className="flex-1 gap-1">
              <Text className="font-semibold">Review next week</Text>
              <Text variant="muted">Your plan has suggested changes based on this week.</Text>
            </View>
            <Icon as={ChevronRight} className="text-muted-foreground size-5" />
          </Card>
        </Pressable>
      )}

      {today.map((s) => (
        <Card key={s.id} className="gap-4 py-5">
          <CardHeader className="px-5">
            <Badge variant={s.status === "done" ? "secondary" : "outline"} className="self-start">
              <Text>{s.status === "done" ? "Done" : s.type.replace(/_/g, " ")}</Text>
            </Badge>
            <CardTitle className="text-lg">{s.title}</CardTitle>
            <CardDescription>
              {s.items.length} exercises{s.warmup.length ? ` · ${s.warmup.length} warm-up` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="gap-2 px-5">
            {s.items.map((i, n) => (
              <View key={n} className="flex-row justify-between gap-3">
                <Text className="flex-1" numberOfLines={1}>
                  {getExercise(i.exerciseId)?.name ?? i.exerciseId}
                </Text>
                <Text variant="muted">{describeItem(i)}</Text>
              </View>
            ))}
            {s.status === "planned" && (
              <Button className="mt-2 self-start" onPress={() => router.push(`/session/${s.id}`)}>
                <Icon as={Play} className="text-primary-foreground size-4" />
                <Text>Start</Text>
              </Button>
            )}
          </CardContent>
        </Card>
      ))}

      {today.length === 0 && (
        <Card className="items-start gap-3 px-5 py-5">
          <Text className="font-semibold">{all.length === 0 ? "No plan yet" : "Rest day"}</Text>
          <Text variant="muted">
            {all.length === 0 ? "Your 4-week plan uses your goals, equipment, injuries and history." : "Nothing planned today. Recovery is part of the plan."}
          </Text>
          <Button variant="outline" size="sm" onPress={() => router.push("/plan")}>
            <Icon as={CalendarDays} className="text-foreground size-4" />
            <Text>{all.length === 0 ? "Generate plan" : "See the plan"}</Text>
          </Button>
        </Card>
      )}

      <BandCard />
    </ScrollView>
  );
}
