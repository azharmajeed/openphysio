import { goals } from "@openphysio/catalog";
import { healthDaily, profile, setLog, weightEntry, workout } from "@openphysio/core";
import { localDate } from "@openphysio/integrations";
import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text } from "react-native";
import { db } from "../db";
import { buildHistory, ymd } from "../lib/plan";
import { bestPace, metricsFor, weeklyTotals, weightSeries, type Metric } from "../lib/progress";
import { fmtPace } from "../lib/run";
import { Bars, Card, Line } from "../progress/Charts";
import { NutritionCard, type NutritionData } from "../progress/NutritionCard";

const WEEKS = 8;
const DAY = 86_400_000;
type Data = { metrics: Metric[]; hist: ReturnType<typeof buildHistory>; ws: (typeof workout.$inferSelect)[]; nutrition: NutritionData };

async function load(): Promise<Data | null> {
  const now = Date.now();
  const [p] = await db.select().from(profile).limit(1);
  if (!p) return null;
  const ws = (await db.select().from(workout).where(and(isNull(workout.deletedAt), gte(workout.startedAt, now - WEEKS * 7 * DAY)))).filter((w) => w.endedAt != null);
  const sets = ws.length ? await db.select().from(setLog).where(and(inArray(setLog.workoutId, ws.map((w) => w.id)), isNull(setLog.deletedAt))) : [];
  const entries = await db.select().from(weightEntry).where(isNull(weightEntry.deletedAt)).orderBy(desc(weightEntry.date), desc(weightEntry.updatedAt));
  const [band] = await db.select().from(healthDaily).where(and(eq(healthDaily.date, localDate(now)), eq(healthDaily.source, "band"), isNull(healthDaily.deletedAt))).limit(1);
  return {
    metrics: metricsFor(goals, p.goals),
    hist: buildHistory(ws, sets),
    ws,
    nutrition: {
      profile: p,
      weights: weightSeries(entries, ymd(new Date(now))),
      latestKg: entries[0]?.kg ?? null,
      sessionsPerWeek: Math.round(ws.filter((w) => w.startedAt >= now - 28 * DAY).length / 4),
      bandActiveKcal: band?.activeKcal ?? null,
    },
  };
}

function MetricCard({ m, d }: { m: Metric; d: Data }) {
  const now = Date.now();
  const sum = (a: number[]) => a.at(-1) ?? 0;
  if (m.kind === "run" || m.kind === "swim") {
    const mine = d.ws.filter((w) => w.type === m.kind);
    const v = weeklyTotals(mine.map((w) => ({ at: w.startedAt, value: (w.distanceM ?? 0) / 1000 })), now, WEEKS);
    const pace = m.kind === "run" ? bestPace(mine) : null;
    return (
      <Card title={m.kind === "run" ? "Run: weekly km" : "Swim: weekly metres"} sub={`This week ${m.kind === "run" ? `${sum(v).toFixed(1)} km` : `${Math.round(sum(v) * 1000)} m`}${pace ? `. Best 5 km+ pace ${fmtPace(pace)}/km` : ""}`}>
        <Bars values={m.kind === "swim" ? v.map((x) => x * 1000) : v} />
      </Card>
    );
  }
  if (m.kind === "plyo") {
    const v = weeklyTotals(d.hist.plyoContacts.map((c) => ({ at: c.at, value: c.contacts })), now, WEEKS);
    return (
      <Card title="Jump: weekly foot contacts" sub={`This week ${sum(v)}`}>
        <Bars values={v} color="#d97706" />
      </Card>
    );
  }
  const rows = m.muscles
    .map((mu) => ({ mu, v: weeklyTotals((d.hist.hardSetsByMuscle[mu] ?? []).map((h) => ({ at: h.at, value: h.sets })), now, WEEKS) }))
    .filter((r) => r.v.some(Boolean));
  return (
    <Card title="Strength: weekly hard sets" sub={rows.length ? "By muscle group, last 8 weeks" : "No hard sets logged yet"}>
      {rows.map((r) => (
        <Text key={r.mu} style={{ marginTop: 4 }}>
          {r.mu.replace(/_/g, " ")}: {sum(r.v)} this week
        </Text>
      )).flatMap((t, i) => [t, <Bars key={`b${i}`} values={rows[i]!.v} color="#7c3aed" />])}
    </Card>
  );
}

export default function Progress() {
  const [d, setD] = useState<Data | null>(null);
  const refresh = useCallback(() => void load().then(setD), []);
  useFocusEffect(refresh);
  if (!d) return null;
  const w = d.nutrition.weights;
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {d.metrics.length === 0 && <Text style={{ marginBottom: 12 }}>Pick goals in Profile to see trends.</Text>}
      {d.metrics.map((m) => (
        <MetricCard key={m.kind} m={m} d={d} />
      ))}
      <Card title="Weight: last 14 days" sub={w.length ? `${w.at(-1)!.kg} kg` : "No weight logged in 14 days"}>
        {w.length > 1 && <Line values={w.map((p) => p.kg)} />}
      </Card>
      <NutritionCard d={d.nutrition} onAdded={refresh} />
    </ScrollView>
  );
}
