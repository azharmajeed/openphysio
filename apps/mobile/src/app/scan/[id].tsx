import { Link, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Button, ScrollView, Text, View } from "react-native";
import { decide, getScan } from "../../scan/api";
import { itemLabel, pendingIds, type Scan } from "../../scan/scan";
import { syncNow } from "../../sync";

const link = { color: "#2563eb", marginBottom: 8 } as const;

export default function ReviewScan() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [scan, setScan] = useState<Scan>();
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getScan(id).then(setScan, (e: Error) => setErr(e.message));
  }, [id]);

  async function send(approve: string[], reject: string[]) {
    setBusy(true);
    setErr(undefined);
    try {
      setScan(await decide(id, approve, reject));
      await syncNow(); // approved rows are written server-side; pull them onto the phone
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
    setBusy(false);
  }

  if (!scan) return err ? <Text style={{ padding: 16, color: "#b91c1c" }}>{err}</Text> : <ActivityIndicator style={{ marginTop: 24 }} />;
  const { items, unreadable, dropped } = scan.extracted;
  const pending = pendingIds(scan);

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {items.length === 0 && (
        <Text style={{ marginBottom: 8 }}>
          {unreadable ? "Could not read this." : "Nothing found in this scan."} Enter it manually:
        </Text>
      )}
      {items.length === 0 && <Link href="/profile" style={link}>Add an injury in your profile</Link>}
      {items.length === 0 && <Link href="/log" style={link}>Log a session</Link>}
      {items.length > 0 && (
        <Text style={{ marginBottom: 8, color: "#6b7280" }}>
          Review each item. Fields can&apos;t be edited yet; reject an item that is wrong and add it by hand.
        </Text>
      )}
      {dropped > 0 && <Text style={{ marginBottom: 8, color: "#6b7280" }}>{dropped} unclear item(s) were skipped.</Text>}
      {items.map((i) => {
        const { title, lines } = itemLabel(i);
        return (
          <View key={i.itemId} style={{ borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <Text style={{ fontWeight: "700" }}>{title}</Text>
            {lines.map((l, n) => (
              <Text key={n}>{l}</Text>
            ))}
            {i.decision ? (
              <Text style={{ marginTop: 8, fontWeight: "600" }}>{i.decision === "approved" ? "Approved" : "Rejected"}</Text>
            ) : (
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <Button title="Approve" onPress={() => void send([i.itemId], [])} disabled={busy} />
                <Button title="Reject" color="#b91c1c" onPress={() => void send([], [i.itemId])} disabled={busy} />
              </View>
            )}
          </View>
        );
      })}
      {pending.length > 1 && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button title="Approve all" onPress={() => void send(pending, [])} disabled={busy} />
          <Button title="Reject all" color="#b91c1c" onPress={() => void send([], pending)} disabled={busy} />
        </View>
      )}
      {items.length > 0 && <Link href="/log" style={{ ...link, marginTop: 16 }}>Something missing? Enter it manually</Link>}
      {err ? <Text style={{ marginTop: 12, color: "#b91c1c" }}>{err}</Text> : null}
    </ScrollView>
  );
}
