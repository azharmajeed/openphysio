import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { parseQuick } from "../lib/plan";
import { logQuick, type Planned } from "../lib/plandb";
import { STROKES, swimNotes } from "../lib/run";
import { Chips, input, label } from "../ui";
import { SessionCard } from "./SessionCard";

/** Manual log: swims (distance, duration, stroke, notes) and the "log without GPS" fallback for runs. Planned or ad hoc. */
export function QuickLog({ planned, type = planned?.type === "swim" ? "swim" : "run", onDone }: { planned?: Planned; type?: "run" | "swim"; onDone: () => void }) {
  const target = planned?.items[0];
  const [unit, setUnit] = useState<"km" | "m">(type === "swim" || target?.unit === "meters" ? "m" : "km");
  const [minutes, setMinutes] = useState(target?.unit === "minutes" ? String(target.amount) : "");
  const [distance, setDistance] = useState("");
  const [stroke, setStroke] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");

  const save = async () => {
    const v = parseQuick(minutes, distance, unit);
    if (!v) return setErr("Enter the duration in minutes (a number above 0). Distance is optional.");
    await logQuick(type, planned, { ...v, notes: type === "swim" ? (swimNotes(stroke, notes) ?? "") : notes });
    onDone();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {planned && <SessionCard s={planned} />}
      <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>{type === "swim" ? "Log a swim" : "Log it"}</Text>
      <Text style={label}>Duration (min)</Text>
      <TextInput value={minutes} onChangeText={setMinutes} keyboardType="decimal-pad" style={input} />
      <Text style={label}>Distance</Text>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
        <TextInput value={distance} onChangeText={setDistance} keyboardType="decimal-pad" style={[input, { flex: 1 }]} />
        <Chips options={[{ id: "km", label: "km" }, { id: "m", label: "m" }]} value={unit} onChange={setUnit} />
      </View>
      {type === "swim" && (
        <>
          <Text style={label}>Stroke (optional)</Text>
          <Chips options={STROKES.map((s) => ({ id: s, label: s }))} value={stroke} onChange={(s: string) => setStroke(s === stroke ? null : s)} />
        </>
      )}
      <Text style={label}>Notes (optional)</Text>
      <TextInput value={notes} onChangeText={setNotes} style={input} />
      {err !== "" && <Text style={{ color: "#dc2626", marginBottom: 8 }}>{err}</Text>}
      <Pressable onPress={() => void save()} style={{ padding: 16, borderRadius: 8, backgroundColor: "#2563eb", alignItems: "center" }}>
        <Text style={{ color: "#fff", fontWeight: "700" }}>{planned ? "Save and complete" : "Save"}</Text>
      </Pressable>
    </ScrollView>
  );
}
