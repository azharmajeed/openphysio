import * as Notifications from "expo-notifications";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, Vibration, View } from "react-native";
import { REST } from "../lib/log";

/** Rest countdown. Foreground: vibrates at zero. Background: a scheduled notification fires. */
export function RestTimer({ endsAt, onChange }: { endsAt: number; onChange: (t: number | null) => void }) {
  const [now, setNow] = useState(Date.now());
  const fired = useRef(false);
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));

  useEffect(() => {
    fired.current = false;
    setNow(Date.now());
    let id: string | undefined;
    let cancelled = false;
    Notifications.scheduleNotificationAsync({
      content: { title: "Rest over", body: "Ready for the next set" },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.ceil((endsAt - Date.now()) / 1000)),
      },
    })
      .then((x) => {
        if (cancelled) void Notifications.cancelScheduledNotificationAsync(x);
        else id = x;
      })
      .catch(() => {}); // permission denied: vibration still works in the app
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => {
      cancelled = true;
      clearInterval(t);
      if (id) void Notifications.cancelScheduledNotificationAsync(id);
    };
  }, [endsAt]);

  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true;
      Vibration.vibrate([0, 400, 200, 400]);
    }
  }, [left]);

  return (
    <View style={{ backgroundColor: "#e0e7ff", borderRadius: 8, padding: 12, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Text style={{ fontSize: 28, fontWeight: "700", flex: 1 }}>
        {left === 0 ? "Go!" : `Rest ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}
      </Text>
      <Btn t={`-${REST.adjustS}`} onPress={() => onChange(endsAt - REST.adjustS * 1000)} />
      <Btn t={`+${REST.adjustS}`} onPress={() => onChange(endsAt + REST.adjustS * 1000)} />
      <Btn t="Skip" onPress={() => onChange(null)} />
    </View>
  );
}

const Btn = ({ t, onPress }: { t: string; onPress: () => void }) => (
  <Pressable onPress={onPress} style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: "#2563eb" }}>
    <Text style={{ color: "#fff", fontWeight: "600" }}>{t}</Text>
  </Pressable>
);
