import "../../global.css";
import { PortalHost } from "@rn-primitives/portal";
import { Stack, useRouter } from "expo-router";
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useCSSVariable, useUniwind } from "uniwind";
import { db } from "../db";
import { loadForm } from "../lib/store";
import migrations from "../migrations";
import { useSyncOnForeground } from "../sync";
import "../run/task";

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);
  const router = useRouter();
  const navTheme = useNavTheme();
  const [ready, setReady] = useState(false);
  useSyncOnForeground(ready);

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
    <ThemeProvider value={navTheme}>
      <Screens />
      <PortalHost />
    </ThemeProvider>
  );
}

/** Navigation chrome (headers, tab bar) follows the kit's theme colours. */
function useNavTheme() {
  const { theme } = useUniwind();
  const [background, card, text, border, primary, notification] = useCSSVariable([
    "--color-background",
    "--color-card",
    "--color-foreground",
    "--color-border",
    "--color-primary",
    "--color-destructive",
  ]) as string[];
  const base = theme === "dark" ? DarkTheme : DefaultTheme;
  return { ...base, colors: { ...base.colors, background, card, text, border, primary, notification } } as typeof base;
}

function Screens() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
      <Stack.Screen name="intake" options={{ title: "Welcome", headerBackVisible: false, gestureEnabled: false }} />
      <Stack.Screen name="profile" options={{ title: "Profile" }} />
      <Stack.Screen name="health" options={{ title: "Band data" }} />
      <Stack.Screen name="checkin" options={{ title: "Next week" }} />
      <Stack.Screen name="session/[id]" options={{ title: "Session" }} />
      <Stack.Screen name="run/index" options={{ title: "Run" }} />
      <Stack.Screen name="run/[id]" options={{ title: "Run" }} />
      <Stack.Screen name="progress" options={{ title: "Progress" }} />
      <Stack.Screen name="swim" options={{ title: "Swim" }} />
      <Stack.Screen name="scan/index" options={{ title: "Import scan" }} />
      <Stack.Screen name="scan/[id]" options={{ title: "Review scan" }} />
      <Stack.Screen name="channels" options={{ title: "Channels" }} />
    </Stack>
  );
}
