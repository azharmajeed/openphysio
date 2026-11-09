import { getExercise } from "@openphysio/catalog";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { LOGGABLE_TYPES, fmtSet, type LoggableType } from "../../lib/log";
import { activeWorkout, history, startWorkout } from "../../lib/logdb";
import { Session } from "../../log/Session";
import { Chips } from "../../ui";

export default function Log() {
  const [active, setActive] = useState<Awaited<ReturnType<typeof activeWorkout>>>();
  const [past, setPast] = useState<Awaited<ReturnType<typeof history>>>([]);
  const [type, setType] = useState<LoggableType>(LOGGABLE_TYPES[0]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setActive(await activeWorkout());
    setPast(await history());
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

      <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>History</Text>
      {past.length === 0 && <Text>No sessions logged yet.</Text>}
      {past.map((w) => (
        <View key={w.id} style={{ borderBottomWidth: 1, borderColor: "#ddd", paddingVertical: 8 }}>
          <Text style={{ fontWeight: "600" }}>
            {new Date(w.startedAt).toLocaleString()} · {w.type} · {Math.round((w.durationS ?? 0) / 60)} min · {w.sets.length} sets
          </Text>
          {w.sets.map((s) => {
            const e = getExercise(s.exerciseId);
            return <Text key={s.id}>{e ? `${e.name}: ${fmtSet(e, s)}` : s.exerciseId}</Text>;
          })}
        </View>
      ))}
    </ScrollView>
  );
}
