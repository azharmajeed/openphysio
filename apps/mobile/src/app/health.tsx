import { useState } from "react";
import { Button, ScrollView, Text } from "react-native";
import { openHealthConnectSettings, requestPermission } from "react-native-health-connect";
import { hasPermissions, importBandData, PERMISSIONS, type ImportResult } from "../health/sync";

function describe(r: ImportResult) {
  if (r.status === "unavailable")
    return "Health Connect is not available on this phone. Install or update it from the Play Store.";
  if (r.status === "no-permission") return "Permission not granted yet.";
  return `Imported ${r.daily} day(s), ${r.hrSamples} heart rate samples, ${r.workouts} workout(s).`;
}

export default function Health() {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      if (!(await hasPermissions())) await requestPermission(PERMISSIONS);
      setMsg(describe(await importBandData()));
    } catch (e) {
      setMsg(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    setBusy(false);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontWeight: "600", fontSize: 16 }}>Import band data</Text>
      <Text>
        OpenPhysio reads your band data from Health Connect so training and recovery can use it:
        steps, heart rate, sleep, workouts, distance and active calories. Data stays on this phone
        (and your own server if you set one up). OpenPhysio never writes to Health Connect, and you
        can revoke access any time in Health Connect settings.
      </Text>
      <Button
        title={busy ? "Importing..." : "Allow access and import"}
        onPress={run}
        disabled={busy}
      />
      {msg !== "" && <Text>{msg}</Text>}
      <Button title="Health Connect settings" onPress={() => openHealthConnectSettings()} />
    </ScrollView>
  );
}
