import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { calendar, typeColor, ymd } from "../../lib/plan";
import { allPlanned, generatePlan, savedWarnings, type Planned } from "../../lib/plandb";
import { SessionCard } from "../../plan/SessionCard";

const Btn = ({ t, onPress, disabled }: { t: string; onPress: () => void; disabled?: boolean }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    style={{ padding: 14, borderRadius: 8, backgroundColor: disabled ? "#9ca3af" : "#2563eb", alignItems: "center", marginBottom: 12 }}
  >
    <Text style={{ color: "#fff", fontWeight: "700" }}>{t}</Text>
  </Pressable>
);

const longDay = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });

export default function Plan() {
  const router = useRouter();
  const [all, setAll] = useState<Planned[] | null>(null);
  const [warnings, setWarnings] = useState(savedWarnings());
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const load = useCallback(() => allPlanned().then(setAll), []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const generate = async () => {
    setBusy(true);
    setMsg("");
    try {
      const r = await generatePlan();
      setWarnings(r.warnings);
      if (r.count === 0) setMsg("Nothing could be planned. Check your goals, equipment and injuries in Profile.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const regenerate = () =>
    Alert.alert("Regenerate plan?", "Planned sessions from today are replaced. Completed sessions stay.", [
      { text: "Keep plan" },
      { text: "Regenerate", style: "destructive", onPress: () => void generate() },
    ]);

  if (!all) return null;
  const weeks = calendar(all);
  const today = ymd(new Date());
  const day = sel ? weeks.flat().find((d) => d.date === sel) : undefined;

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Btn
        t={busy ? "Planning..." : all.length ? "Regenerate 4-week plan" : "Generate 4-week plan"}
        disabled={busy}
        onPress={all.length ? regenerate : () => void generate()}
      />
      {msg !== "" && <Text style={{ color: "#dc2626", marginBottom: 12 }}>{msg}</Text>}
      {warnings.length > 0 && (
        <View style={{ backgroundColor: "#fef3c7", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <Text style={{ fontWeight: "700", marginBottom: 4 }}>Not everything fit</Text>
          {warnings.map((w, i) => (
            <Text key={i}>- {w.reason}</Text>
          ))}
        </View>
      )}
      {weeks.map((w, wi) => (
        <View key={wi} style={{ marginBottom: 12 }}>
          <Text style={{ fontWeight: "700", marginBottom: 4 }}>Week {wi + 1}</Text>
          <View style={{ flexDirection: "row", gap: 4 }}>
            {w.map((d) => {
              const missed = d.date < today && d.sessions.some((s) => s.status === "planned");
              return (
                <Pressable
                  key={d.date}
                  onPress={() => setSel(d.date === sel ? null : d.date)}
                  style={{
                    flex: 1,
                    minHeight: 64,
                    borderRadius: 6,
                    borderWidth: d.date === sel ? 2 : 1,
                    borderColor: d.date === today ? "#111827" : "#d1d5db",
                    padding: 2,
                    opacity: missed ? 0.5 : 1,
                  }}
                >
                  <Text style={{ fontSize: 10, textAlign: "center" }}>{new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" })}</Text>
                  <Text style={{ fontSize: 12, fontWeight: "600", textAlign: "center" }}>{Number(d.date.slice(8))}</Text>
                  {d.sessions.map((s) => (
                    <View key={s.id} style={{ backgroundColor: typeColor(s.type), borderRadius: 3, marginTop: 2 }}>
                      <Text numberOfLines={1} style={{ color: "#fff", fontSize: 9, textAlign: "center" }}>
                        {s.status === "done" ? "✓ " : ""}
                        {s.type}
                      </Text>
                    </View>
                  ))}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      {day && (
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontWeight: "700", marginBottom: 8 }}>{longDay(day.date)}</Text>
          {day.sessions.length === 0 && <Text>Rest day.</Text>}
          {day.sessions.map((s) => (
            <SessionCard key={s.id} s={s} onStart={() => router.push(`/session/${s.id}`)} />
          ))}
        </View>
      )}
      {all.length === 0 && <Text>No plan yet. It uses your goals, equipment, injuries and logged history.</Text>}
    </ScrollView>
  );
}
