import TextRecognition from "@react-native-ml-kit/text-recognition";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Button, Text, View } from "react-native";
import DocumentScanner from "react-native-document-scanner-plugin";
import { uploadScan } from "../../scan/api";
import { SCAN_KINDS, type ScanKind } from "../../scan/scan";
import { Chips } from "../../ui";

export default function ImportScan() {
  const router = useRouter();
  const [kind, setKind] = useState<ScanKind>("medical");
  const [step, setStep] = useState<string>();
  const [err, setErr] = useState<string>();

  async function go() {
    setErr(undefined);
    try {
      setStep("Scanning...");
      const { scannedImages } = await DocumentScanner.scanDocument({ maxNumDocuments: 1 });
      const uri = scannedImages?.[0];
      if (!uri) return setStep(undefined); // cancelled
      setStep("Reading text on this phone...");
      const { text } = await TextRecognition.recognize(uri);
      setStep("Uploading to your server...");
      const scan = await uploadScan({ uri, name: "scan.jpg", type: "image/jpeg" }, kind, text);
      setStep(undefined);
      router.replace({ pathname: "/scan/[id]", params: { id: scan.id } });
    } catch (e) {
      setStep(undefined);
      setErr(e instanceof Error ? e.message : "Import failed");
    }
  }

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ marginBottom: 8 }}>What are you scanning?</Text>
      <Chips options={SCAN_KINDS} value={kind} onChange={setKind} />
      <Button title={step ?? "Scan"} onPress={() => void go()} disabled={!!step} />
      <Text style={{ marginTop: 12, color: "#6b7280" }}>
        Text is read on this phone. The picture goes only to your own server, and nothing is saved until you approve it.
      </Text>
      {err ? <Text style={{ marginTop: 12, color: "#b91c1c" }}>{err}</Text> : null}
    </View>
  );
}
