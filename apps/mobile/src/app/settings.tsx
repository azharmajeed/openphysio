import { name as coreName } from "@openphysio/core";
import * as SecureStore from "expo-secure-store";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { db } from "../db";
import { lastResult, SERVER_KEYS, syncNow, type SyncResult } from "../sync";
import { Button, Text, TextInput, View } from "react-native";

const input = { borderWidth: 1, padding: 8, marginBottom: 12 };

export default function Settings() {
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState(false);
  const [last, setLast] = useState<SyncResult>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      setUrl((await SecureStore.getItemAsync(SERVER_KEYS.url)) ?? "");
      setToken((await SecureStore.getItemAsync(SERVER_KEYS.token)) ?? "");
      setLast(await lastResult(db));
    })();
  }, []);

  async function save() {
    await SecureStore.setItemAsync(SERVER_KEYS.url, url);
    await SecureStore.setItemAsync(SERVER_KEYS.token, token);
    setSaved(true);
  }

  async function sync() {
    setBusy(true);
    await save();
    setLast(await syncNow());
    setBusy(false);
  }

  return (
    <View style={{ padding: 16 }}>
      <Link href="/profile" style={{ marginBottom: 16, color: "#2563eb" }}>Edit profile</Link>
      <Link href="/health" style={{ marginBottom: 16, color: "#2563eb" }}>Import band data</Link>
      <Link href="/scan" style={{ marginBottom: 16, color: "#2563eb" }}>Import scan</Link>
      <Text>Server URL</Text>
      <TextInput style={input} value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" />
      <Text>Token</Text>
      <TextInput style={input} value={token} onChangeText={setToken} autoCapitalize="none" secureTextEntry />
      <Button title="Save" onPress={save} />
      {saved && <Text>Saved</Text>}
      <View style={{ marginTop: 24 }}>
        <Button title={busy ? "Syncing..." : "Sync now"} onPress={sync} disabled={busy || !url || !token} />
        {!last ? (
          <Text>Not synced yet.</Text>
        ) : last.ok ? (
          <Text>Last sync {new Date(last.at).toLocaleString()}: sent {last.sent}, received {last.received} rows.</Text>
        ) : (
          <Text style={{ color: "#b91c1c" }}>Sync failed ({new Date(last.at).toLocaleString()}): {last.error}</Text>
        )}
      </View>
      <Text style={{ marginTop: 24 }}>core: {coreName}</Text>
    </View>
  );
}
