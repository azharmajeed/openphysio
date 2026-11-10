import { Link } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Button, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { loadConfig } from "../sync";
import { input } from "../ui";
import { addChannel, ERROR_TEXT, listChannels, removeChannel, type Channel } from "./feed";

export default function ChannelsScreen() {
  const [rows, setRows] = useState<Channel[]>([]);
  const [msg, setMsg] = useState<string>();
  const [id, setId] = useState("");
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    const r = await listChannels(await loadConfig());
    if ("channels" in r) {
      setRows(r.channels);
      setMsg(undefined);
    } else setMsg(ERROR_TEXT[r.error]);
  }, []);
  useEffect(() => void load(), [load]);

  /** Runs a change, then reloads the list; returns the error message if any. */
  const run = async (change: (cfg: Awaited<ReturnType<typeof loadConfig>>) => Promise<string | undefined>) => {
    const err = await change(await loadConfig());
    setMsg(err);
    if (!err) await load();
    return err;
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      {msg && (
        <Text style={{ color: "#b91c1c", marginBottom: 8 }}>
          {msg}{" "}
          <Link href="/settings" style={{ color: "#2563eb" }}>
            Settings
          </Link>
        </Text>
      )}
      <FlatList
        data={rows}
        keyExtractor={(c) => c.channelId}
        renderItem={({ item }) => (
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Text style={{ flex: 1 }}>{item.name}</Text>
            <Pressable onPress={() => void run((cfg) => removeChannel(cfg, item.channelId))}>
              <Text style={{ color: "#b91c1c" }}>Remove</Text>
            </Pressable>
          </View>
        )}
      />
      <Text style={{ fontWeight: "600", marginBottom: 4 }}>Follow a channel</Text>
      <TextInput style={input} placeholder="Channel id (starts with UC)" autoCapitalize="none" autoCorrect={false} value={id} onChangeText={setId} />
      <TextInput style={input} placeholder="Name" value={name} onChangeText={setName} />
      <Button
        title="Add"
        disabled={!id.trim() || !name.trim()}
        onPress={() =>
          void run((cfg) => addChannel(cfg, id, name)).then((err) => {
            if (!err) {
              setId("");
              setName("");
            }
          })
        }
      />
    </View>
  );
}
