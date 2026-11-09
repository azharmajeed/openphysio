import { healthDaily } from "@openphysio/core";
import { localDate } from "@openphysio/integrations";
import { and, eq, isNull } from "drizzle-orm";
import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { db } from "../db";
import { importBandData } from "./sync";

type Day = typeof healthDaily.$inferSelect;

/** Today's band numbers. Imports on focus (app open / tab return) when permission is already granted. */
export function BandCard() {
  const [day, setDay] = useState<Day | null>(null);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        try {
          await importBandData();
        } catch {
          // Health Connect missing or failing must not break Today; the card falls back to stored data.
        }
        const [row] = await db
          .select()
          .from(healthDaily)
          .where(
            and(
              eq(healthDaily.date, localDate(Date.now())),
              eq(healthDaily.source, "band"),
              isNull(healthDaily.deletedAt),
            ),
          )
          .limit(1);
        setDay(row ?? null);
      })();
    }, []),
  );

  const sleep =
    day?.sleepMin != null ? `${Math.floor(day.sleepMin / 60)}h ${day.sleepMin % 60}m` : "-";
  return (
    <View style={{ borderWidth: 1, borderColor: "#999", borderRadius: 8, padding: 12, margin: 16 }}>
      <Text style={{ fontWeight: "600", marginBottom: 6 }}>Band today</Text>
      {day ? (
        <>
          <Text>Steps: {day.steps ?? "-"}</Text>
          <Text>Resting HR: {day.restingHr != null ? `${day.restingHr} bpm` : "-"}</Text>
          <Text>Last night&apos;s sleep: {sleep}</Text>
        </>
      ) : (
        <Text>No band data yet</Text>
      )}
      <Link href="/health" style={{ marginTop: 8, color: "#2563eb" }}>
        {day ? "Import band data" : "Connect band data"}
      </Link>
    </View>
  );
}
