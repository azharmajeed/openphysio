import { getExercise } from "@openphysio/catalog";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { LOGGABLE_TYPES, fmtSet, type LoggableType } from "../../lib/log";
import { fmtDistance, fmtPace } from "../../lib/run";
import { activeWorkout, history, startWorkout } from "../../lib/logdb";
import { Session } from "../../log/Session";
import { activeRun } from "../../run/rundb";
import { Chips } from "../../ui";

export default function Log() {
  const [active, setActive] = useState<Awaited<ReturnType<typeof activeWorkout>>>();
  const [past, setPast] = useState<Awaited<ReturnType<typeof history>>>([]);
  const [type, setType] = useState<LoggableType>(LOGGABLE_TYPES[0]);
  const [loaded, setLoaded] = useState(false);
  const [runOn, setRunOn] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    setActive(await activeWorkout());
    setPast(await history());
    setRunOn(!!(await activeRun()));
    setLoaded(true);
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!loaded) return null;
  if (active) return <Session key={active.id} workout={active} onDone={load} />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>Start a session</Text>
      <Chips options={LOGGABLE_TYPES.map((t) => ({ id: t, label: t }))} value={type} onChange={setType} />
      <Pressable
        onPress={() => void startWorkout(type).then(load)}
        style={{ padding: 16, borderRadius: 8, backgroundColor: "#2563eb", alignItems: "center", marginBottom: 24 }}
      >
        <Text style={{ color: "#fff", fontWeight: "700" }}>Start {type} session</Text>
      </Pressable>

      <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>Run or swim</Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 24 }}>
        <Pressable onPress={() => router.push("/run")} style={{ flex: 1, padding: 14, borderRadius: 8, borderWidth: 1, borderColor: "#2563eb", alignItems: "center" }}>
          <Text style={{ color: "#2563eb", fontWeight: "700" }}>{runOn ? "Resume run" : "Start GPS run"}</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/swim")} style={{ flex: 1, padding: 14, borderRadius: 8, borderWidth: 1, borderColor: "#2563eb", alignItems: "center" }}>
          <Text style={{ color: "#2563eb", fontWeight: "700" }}>Log a swim</Text>
        </Pressable>
      </View>

      <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>History</Text>
      {past.length === 0 && <Text>No sessions logged yet.</Text>}
      {past.map((w) => (
        <Pressable
          key={w.id}
          disabled={!(w.type === "run" && w.source === "gps")}
          onPress={() => router.push(`/run/${w.id}`)}
          style={{ borderBottomWidth: 1, borderColor: "#ddd", paddingVertical: 8 }}
        >
          <Text style={{ fontWeight: "600" }}>
            {new Date(w.startedAt).toLocaleString()} · {w.type} · {Math.round((w.durationS ?? 0) / 60)} min{w.distanceM ? ` · ${fmtDistance(w.type, w.distanceM)}` : ""}
            {w.type === "run" && w.distanceM && w.durationS ? ` · ${fmtPace((w.durationS / w.distanceM) * 1000)} /km` : ""}
            {w.sets.length ? ` · ${w.sets.length} sets` : ""}
          </Text>
          {w.notes ? <Text>{w.notes}</Text> : null}
          {w.sets.map((s) => {
            const e = getExercise(s.exerciseId);
            return <Text key={s.id}>{e ? `${e.name}: ${fmtSet(e, s)}` : s.exerciseId}</Text>;
          })}
        </Pressable>
      ))}
    </ScrollView>
  );
}
