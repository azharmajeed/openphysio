import { parseSet, type ParsedSet } from "@openphysio/core";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useRef, useState } from "react";

/** Hold-to-talk: start() on press in, stop() on release; `parsed` holds the last heard set until cleared. */
export function useVoice() {
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [parsed, setParsed] = useState<ParsedSet | null>(null);
  const last = useRef("");
  let available = false;
  try {
    available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    /* module missing: mic stays disabled */
  }

  useSpeechRecognitionEvent("result", (e) => {
    last.current = e.results[0]?.transcript ?? "";
    setHeard(last.current);
  });
  useSpeechRecognitionEvent("error", () => setListening(false));
  useSpeechRecognitionEvent("end", () => {
    setListening(false);
    const p = parseSet(last.current);
    setParsed(Object.keys(p).length ? p : null);
  });

  return {
    available,
    listening,
    heard,
    parsed,
    clear: () => {
      setParsed(null);
      setHeard("");
    },
    async start() {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) return;
      last.current = "";
      setHeard("");
      setParsed(null);
      setListening(true);
      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: true,
        requiresOnDeviceRecognition: ExpoSpeechRecognitionModule.supportsOnDeviceRecognition(),
      });
    },
    stop: () => ExpoSpeechRecognitionModule.stop(),
  };
}
