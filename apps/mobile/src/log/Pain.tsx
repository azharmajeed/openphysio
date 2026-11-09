import type { Exercise } from "@openphysio/catalog";
import { BODY_AREAS, PAIN_KINDS, painAdvice, type BodyArea, type PainAdvice, type PainKind } from "@openphysio/core";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Chips } from "../ui";

const ADVICE: Record<PainAdvice, string> = {
  continue: "Mild ache. You can continue; stop if it gets worse.",
  easier_variant: "Pain is high or worsening. Switch to an easier variant, or stop this exercise.",
  stop_see_physio: "Stop this session now and see a physio before training again.",
};

/** Score + kind + area -> painAdvice -> saved entry and next step. */
export function PainCheck(p: {
  exercise: Exercise;
  regression?: Exercise;
  onSave: (v: { bodyArea: BodyArea; score: number; kind: PainKind }) => Promise<unknown>;
  onSwitch: (e: Exercise) => void;
  onStopSession: () => void;
  onClose: () => void;
}) {
  const [score, setScore] = useState(3);
  const [kind, setKind] = useState<PainKind>("ache");
  const [area, setArea] = useState<BodyArea>(p.exercise.loads[0] ?? BODY_AREAS[0]);
  const [advice, setAdvice] = useState<PainAdvice | null>(null);

  const save = async () => {
    await p.onSave({ bodyArea: area, score, kind });
    setAdvice(painAdvice({ score, kind }));
  };

  return (
    <View style={{ borderWidth: 1, borderColor: "#dc2626", borderRadius: 8, padding: 12, marginBottom: 12 }}>
      <Text style={{ fontWeight: "700", marginBottom: 8 }}>Pain check: {p.exercise.name}</Text>
      {advice ? (
        <>
          <Text style={{ marginBottom: 12 }}>{ADVICE[advice]}</Text>
          {advice === "easier_variant" && p.regression && (
            <Action t={`Switch to ${p.regression.name}`} onPress={() => p.onSwitch(p.regression!)} />
          )}
          {advice === "stop_see_physio" && <Action t="End session" onPress={p.onStopSession} />}
          <Action t="Close" onPress={p.onClose} />
        </>
      ) : (
        <>
          <Text>Score (0-10)</Text>
          <Chips options={Array.from({ length: 11 }, (_, i) => ({ id: i, label: String(i) }))} value={score} onChange={setScore} />
          <Text>Kind</Text>
          <Chips options={PAIN_KINDS.map((k) => ({ id: k, label: k.replace("_", " ") }))} value={kind} onChange={setKind} />
          <Text>Area</Text>
          <Chips options={BODY_AREAS.map((a) => ({ id: a, label: a.replace("_", " ") }))} value={area} onChange={setArea} />
          <Action t="Save pain entry" onPress={save} />
          <Action t="Cancel" onPress={p.onClose} />
        </>
      )}
    </View>
  );
}

const Action = ({ t, onPress }: { t: string; onPress: () => void }) => (
  <Pressable onPress={onPress} style={{ padding: 14, borderRadius: 8, backgroundColor: "#2563eb", marginBottom: 8, alignItems: "center" }}>
    <Text style={{ color: "#fff", fontWeight: "600" }}>{t}</Text>
  </Pressable>
);
