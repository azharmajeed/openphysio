import { name as coreName } from "@openphysio/core";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { Button, Text, TextInput, View } from "react-native";

const input = { borderWidth: 1, padding: 8, marginBottom: 12 };

export default function Settings() {
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      setUrl((await SecureStore.getItemAsync("serverUrl")) ?? "");
      setToken((await SecureStore.getItemAsync("serverToken")) ?? "");
    })();
  }, []);

  async function save() {
    await SecureStore.setItemAsync("serverUrl", url);
    await SecureStore.setItemAsync("serverToken", token);
    setSaved(true);
  }

  return (
    <View style={{ padding: 16 }}>
      <Text>Server URL</Text>
      <TextInput style={input} value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" />
      <Text>Token</Text>
      <TextInput style={input} value={token} onChangeText={setToken} autoCapitalize="none" secureTextEntry />
      <Button title="Save" onPress={save} />
      {saved && <Text>Saved</Text>}
      <Text style={{ marginTop: 24 }}>core: {coreName}</Text>
    </View>
  );
}
