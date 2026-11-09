import type { Exercise, SessionType } from "@openphysio/catalog";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { pickerExercises, pickerSessionTypes, PRESETS, type LoggableType } from "../lib/log";
import { Chips, input } from "../ui";

export type PickerCtx = {
  equipment: Parameters<typeof pickerExercises>[1]["equipment"];
  injuries: Parameters<typeof pickerExercises>[2];
};

/** Injury-filtered catalogue picker with search and session-type chips. */
export function Picker(p: { type: LoggableType; ctx: PickerCtx; onPick: (e: Exercise) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [st, setSt] = useState<SessionType | null>(PRESETS[p.type].sessionTypes?.[0] ?? null);
  const list = pickerExercises(p.type, p.ctx, p.ctx.injuries, { query, sessionType: st });
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <TextInput value={query} onChangeText={setQuery} placeholder="Search exercises" style={input} />
      <ScrollView style={{ flexGrow: 0, maxHeight: 130 }}>
        <Chips
          options={[{ id: "", label: "All" }, ...pickerSessionTypes.map((t) => ({ id: t as string, label: t.replace("_", " ") }))]}
          value={st ?? ""}
          onChange={(v: string) => setSt((v || null) as SessionType | null)}
        />
      </ScrollView>
      <ScrollView>
        {list.map((e) => (
          <Pressable key={e.id} onPress={() => p.onPick(e)} style={{ paddingVertical: 14, borderBottomWidth: 1, borderColor: "#ddd" }}>
            <Text style={{ fontSize: 16 }}>{e.name}</Text>
          </Pressable>
        ))}
        {list.length === 0 && <Text>Nothing matches (injuries and equipment are applied).</Text>}
      </ScrollView>
      <Pressable onPress={p.onClose} style={{ padding: 14, alignItems: "center" }}>
        <Text style={{ color: "#2563eb", fontWeight: "600" }}>Back</Text>
      </Pressable>
    </View>
  );
}
