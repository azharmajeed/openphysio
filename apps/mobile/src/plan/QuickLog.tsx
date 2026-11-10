import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { parseQuick } from "../lib/plan";
import { logQuick, type Planned } from "../lib/plandb";
import { Chips, input, label } from "../ui";
import { SessionCard } from "./SessionCard";

/** Run or swim: target plus a manual "Log it" form. M5 replaces this with the GPS tracker. */
export function QuickLog({ planned, onDone }: { planned: Planned; onDone: () => void }) {
  const target = planned.items[0];
  const [unit, setUnit] = useState<"km" | "m">(target?.unit === "meters" ? "m" : "km");
  const [minutes, setMinutes] = useState(target?.unit === "minutes" ? String(target.amount) : "");
  const [distance, setDistance] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");

  const save = async () => {
    const v = parseQuick(minutes, distance, unit);
    if (!v) return setErr("Enter the duration in minutes (a number above 0). Distance is optional.");
    await logQuick(planned, { ...v, notes });
    onDone();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <SessionCard s={planned} />
      <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>Log it</Text>
      <Text style={label}>Duration (min)</Text>
      <TextInput value={minutes} onChangeText={setMinutes} keyboardType="decimal-pad" style={input} />
      <Text style={label}>Distance</Text>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
        <TextInput value={distance} onChangeText={setDistance} keyboardType="decimal-pad" style={[input, { flex: 1 }]} />
        <Chips options={[{ id: "km", label: "km" }, { id: "m", label: "m" }]} value={unit} onChange={setUnit} />
      </View>
      <Text style={label}>Notes (optional)</Text>
      <TextInput value={notes} onChangeText={setNotes} style={input} />
      {err !== "" && <Text style={{ color: "#dc2626", marginBottom: 8 }}>{err}</Text>}
      <Pressable onPress={() => void save()} style={{ padding: 16, borderRadius: 8, backgroundColor: "#2563eb", alignItems: "center" }}>
        <Text style={{ color: "#fff", fontWeight: "700" }}>Save and complete</Text>
      </Pressable>
    </ScrollView>
  );
}
