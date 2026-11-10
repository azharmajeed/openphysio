import { projectRoute, trackStats, workout } from "@openphysio/core";
import { eq } from "drizzle-orm";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import { db } from "../db";
import { fmtDistance, fmtDur, fmtPace } from "../lib/run";
import { runPoints } from "./rundb";

const SIZE = 300;

/** Finished run: summary, route as an SVG polyline (no map tiles) and splits per km. */
export function RunDetail({ id }: { id: string }) {
  const [data, setData] = useState<{
    w: typeof workout.$inferSelect;
    route: string;
    splits: ReturnType<typeof trackStats>["splits"];
  } | null>();
  useEffect(() => {
    void (async () => {
      const [w] = await db.select().from(workout).where(eq(workout.id, id));
      if (!w) return setData(null);
      const pts = await runPoints(id);
      setData({ w, route: projectRoute(pts, SIZE, SIZE), splits: trackStats(pts).splits });
    })();
  }, [id]);

  if (data === undefined) return null;
  if (data === null) return <Text style={{ padding: 16 }}>This run no longer exists.</Text>;
  const { w, route, splits } = data;
  const pace = w.distanceM && w.durationS ? (w.durationS / w.distanceM) * 1000 : null;
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: "700" }}>
        {new Date(w.startedAt).toLocaleString()}
      </Text>
      <Text style={{ marginBottom: 12 }}>
        {fmtDistance("run", w.distanceM ?? 0)} · {fmtDur(w.durationS ?? 0)} · {fmtPace(pace)} /km
        {w.avgHr ? ` · ${w.avgHr} bpm` : ""}
      </Text>
      {route !== "" && (
        <Svg
          width={SIZE}
          height={SIZE}
          style={{
            alignSelf: "center",
            backgroundColor: "#f3f4f6",
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <Polyline
            points={route}
            fill="none"
            stroke="#2563eb"
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </Svg>
      )}
      {splits.length > 0 && <Text style={{ fontWeight: "700", marginBottom: 4 }}>Splits</Text>}
      {splits.map((s) => (
        <View
          key={s.index}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            paddingVertical: 4,
            borderBottomWidth: 1,
            borderColor: "#e5e7eb",
          }}
        >
          <Text>
            {s.distanceM >= 999 ? `km ${s.index}` : `last ${(s.distanceM / 1000).toFixed(2)} km`}
          </Text>
          <Text>{fmtPace(s.paceSPerKm)} /km</Text>
        </View>
      ))}
      {w.notes ? <Text style={{ marginTop: 12, fontStyle: "italic" }}>{w.notes}</Text> : null}
    </ScrollView>
  );
}
