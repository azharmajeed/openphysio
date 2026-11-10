import { Link } from "expo-router";
import Storage from "expo-sqlite/kv-store";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, Text, TextInput, View } from "react-native";
import { loadConfig, syncNow } from "../sync";
import { buildRequest, ERROR_TEXT, formatCitations, sendChat, type ChatError, type Reply } from "./chat";

type Item = { role: "user" | "assistant"; content: string; reply?: Reply };
const KEY = "coach.conversation";

function Bubble({ m }: { m: Item }) {
  const mine = m.role === "user";
  const red = m.reply?.redFlag;
  const f = m.reply ? formatCitations(m.content, m.reply.citations) : { text: m.content, chips: [] };
  return (
    <View
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "85%",
        marginBottom: 8,
        padding: 10,
        borderRadius: 10,
        backgroundColor: red ? "#fee2e2" : mine ? "#2563eb" : "#e5e7eb",
        borderWidth: red ? 2 : 0,
        borderColor: "#b91c1c",
      }}
    >
      {red && <Text style={{ fontWeight: "700", color: "#b91c1c", marginBottom: 4 }}>Stop and get this checked</Text>}
      <Text style={{ color: mine ? "#fff" : "#111" }}>{f.text}</Text>
      {f.chips.map((c) => (
        <Pressable
          key={c.n}
          onPress={() => void Linking.openURL(c.url)}
          style={{ marginTop: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: "#2563eb", backgroundColor: "#fff" }}
        >
          <Text style={{ color: "#2563eb" }}>
            [{c.n}] {c.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function CoachScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ChatError>();
  const list = useRef<FlatList<Item>>(null);

  useEffect(() => {
    void Storage.getItem(KEY).then((s) => {
      try {
        if (s) setItems(JSON.parse(s) as Item[]);
      } catch {
        /* corrupt saved chat: start fresh */
      }
    });
  }, []);

  async function send() {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(undefined);
    const cfg = await loadConfig();
    if (cfg) await syncNow().catch(() => undefined); // coach sees recent logs; a failed sync never blocks the send
    const res = await sendChat(cfg, buildRequest(items, q).messages);
    if (res.ok) {
      const next: Item[] = [...items, { role: "user", content: q }, { role: "assistant", content: res.reply.text, reply: res.reply }];
      setItems(next);
      setText("");
      await Storage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
    } else setError(res.error);
    setBusy(false);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <FlatList
        ref={list}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12 }}
        data={items}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => <Bubble m={item} />}
        onContentSizeChange={() => list.current?.scrollToEnd()}
        ListEmptyComponent={<Text style={{ color: "#666" }}>Ask about training, recovery or your plan. The coach reads your synced logs and cites its sources.</Text>}
      />
      {error && (
        <View style={{ padding: 10, backgroundColor: "#fef3c7" }}>
          <Text>{ERROR_TEXT[error]}</Text>
          {(error === "notConfigured" || error === "badToken") && (
            <Link href="/settings" style={{ color: "#2563eb", marginTop: 4 }}>
              Open Settings
            </Link>
          )}
        </View>
      )}
      <View style={{ flexDirection: "row", padding: 8, gap: 8, alignItems: "center" }}>
        <TextInput
          style={{ flex: 1, borderWidth: 1, borderColor: "#999", borderRadius: 6, padding: 8 }}
          value={text}
          onChangeText={setText}
          placeholder="Ask the coach"
          multiline
        />
        {busy ? (
          <ActivityIndicator />
        ) : (
          <Pressable onPress={() => void send()}>
            <Text style={{ color: "#2563eb", fontWeight: "600" }}>Send</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
