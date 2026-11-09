import { Pressable, Text, View } from "react-native";

export const input = { borderWidth: 1, borderColor: "#999", borderRadius: 6, padding: 8, marginBottom: 12 } as const;
export const label = { fontWeight: "600", marginBottom: 4 } as const;

/** Multi-select (array value) or single-select (scalar/null value) chips. */
export function Chips<T extends string | number>(p: {
  options: { id: T; label: string }[];
  value: T[] | T | null;
  onChange: (v: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
}) {
  const multi = Array.isArray(p.value);
  const on = (id: T) => (multi ? (p.value as T[]).includes(id) : p.value === id);
  const toggle = (id: T) =>
    p.onChange(multi ? ((p.value as T[]).includes(id) ? (p.value as T[]).filter((x) => x !== id) : [...(p.value as T[]), id]) : id);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
      {p.options.map((o) => (
        <Pressable
          key={String(o.id)}
          onPress={() => toggle(o.id)}
          style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: "#2563eb", backgroundColor: on(o.id) ? "#2563eb" : "transparent" }}
        >
          <Text style={{ color: on(o.id) ? "#fff" : "#2563eb" }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
