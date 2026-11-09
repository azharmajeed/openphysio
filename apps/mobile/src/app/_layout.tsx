import { Stack, useRouter } from "expo-router";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { db } from "../db";
import { loadForm } from "../lib/store";
import migrations from "../migrations";

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!success) return;
    void loadForm().then((r) => {
      setReady(true);
      if (!r.exists) router.replace("/intake");
    });
  }, [success, router]);

  if (error) return <Text style={{ padding: 16 }}>Database error: {error.message}</Text>;
  if (!ready)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
      <Stack.Screen name="intake" options={{ title: "Welcome", headerBackVisible: false, gestureEnabled: false }} />
      <Stack.Screen name="profile" options={{ title: "Profile" }} />
      <Stack.Screen name="health" options={{ title: "Band data" }} />
    </Stack>
  );
}
