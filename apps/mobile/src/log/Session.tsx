import { getExercise, type Exercise } from "@openphysio/catalog";
import type { PlanItem } from "@openphysio/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { draftFor, fmtSet, restFor, RPE_OPTIONS, STEPS, type LoggableType, type SetDraft } from "../lib/log";
import { addSet, discardWorkout, finishWorkout, loadContext, savePain, undoSet, workoutSets } from "../lib/logdb";
import { describeItem, plural, targetDraft } from "../lib/plan";
import { getPlanned } from "../lib/plandb";
import { Chips } from "../ui";
import { PainCheck } from "./Pain";
import { Picker, type PickerCtx } from "./Picker";
import { RestTimer } from "./Rest";
import { useVoice } from "./useVoice";

type W = { id: string; type: string; startedAt: number; plannedSessionId?: string | null };
type Step = { item: PlanItem; warmup: boolean };
type SetRow = Awaited<ReturnType<typeof workoutSets>>[number];

function Stepper(p: { label: string; value: number; step: number; unit?: string; onChange: (v: number) => void }) {
  const set = (v: number) => p.onChange(Math.max(0, Math.round(v * 100) / 100));
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
      <Text style={{ width: 70, fontWeight: "600" }}>{p.label}</Text>
      <Big t="−" onPress={() => set(p.value - p.step)} />
      <Text style={{ flex: 1, textAlign: "center", fontSize: 28, fontWeight: "700" }}>
        {p.value}
        {p.unit ?? ""}
      </Text>
      <Big t="+" onPress={() => set(p.value + p.step)} />
    </View>
  );
}

const Big = ({ t, onPress }: { t: string; onPress: () => void }) => (
  <Pressable onPress={onPress} style={{ width: 64, height: 56, borderRadius: 8, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center" }}>
    <Text style={{ color: "#fff", fontSize: 28 }}>{t}</Text>
  </Pressable>
);

const Btn = ({ t, onPress, color = "#2563eb", disabled }: { t: string; onPress: () => void; color?: string; disabled?: boolean }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    style={{ padding: 14, borderRadius: 8, backgroundColor: disabled ? "#9ca3af" : color, alignItems: "center", marginBottom: 8 }}
  >
    <Text style={{ color: "#fff", fontWeight: "600" }}>{t}</Text>
  </Pressable>
);

export function Session({ workout, onDone }: { workout: W; onDone: () => void }) {
  const type = workout.type as LoggableType;
  const [ctx, setCtx] = useState<PickerCtx>({ equipment: [], injuries: [] });
  const [sets, setSets] = useState<SetRow[]>([]);
  const [extra, setExtra] = useState<string[]>([]); // exercises added but not yet logged
  const [curId, setCurId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SetDraft | null>(null);
  const [restEnds, setRestEnds] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [pain, setPain] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const voice = useVoice();
  // Planned session: warm-up first, then the exercises (first item wins when an exercise repeats).
  const [steps, setSteps] = useState<Step[]>([]);
  const positioned = useRef(false);

  const [setsLoaded, setSetsLoaded] = useState(false);
  const reload = useCallback(() => workoutSets(workout.id).then((r) => { setSets(r); setSetsLoaded(true); }), [workout.id]);
  useEffect(() => {
    void reload();
    void loadContext().then(setCtx);
  }, [reload]);

  useEffect(() => {
    if (!workout.plannedSessionId) return;
    void getPlanned(workout.plannedSessionId).then((p) => {
      if (!p) return;
      const all = [...p.warmup.map((item) => ({ item, warmup: true })), ...p.items.map((item) => ({ item, warmup: false }))];
      setSteps(all.filter((x, i) => all.findIndex((y) => y.item.exerciseId === x.item.exerciseId) === i));
    });
  }, [workout.plannedSessionId]);

  const stepOf = (id: string) => steps.find((x) => x.item.exerciseId === id);
  const order = [...new Set([...steps.map((x) => x.item.exerciseId), ...sets.map((s) => s.exerciseId), ...extra])];
  const cur = curId ? getExercise(curId) : undefined;
  const curSets = sets.filter((s) => s.exerciseId === curId);
  const lastOf = (id: string) => sets.filter((s) => s.exerciseId === id).at(-1);

  const select = (e: Exercise) => {
    setCurId(e.id);
    setDraft(targetDraft(e, stepOf(e.id)?.item, lastOf(e.id)));
    setExtra((x) => (x.includes(e.id) ? x : [...x, e.id]));
    setPicking(false);
    setPain(false);
  };

  const log = async (d: SetDraft) => {
    if (!cur) return;
    await addSet(workout.id, cur, d, curSets.length);
    await reload();
    setRestEnds(Date.now() + (stepOf(cur.id)?.item.restSec || restFor(cur)) * 1000);
    voice.clear();
  };

  const confirmVoice = () => {
    const v = voice.parsed;
    const last = curId ? lastOf(curId) : undefined;
    if (!v || !cur) return;
    if (v.same && last) return void log(draftFor(cur, last));
    const next = { ...(draft ?? draftFor(cur)), ...(v.reps !== undefined && { reps: v.reps }), ...(v.loadKg !== undefined && { loadKg: v.loadKg }), ...(v.rpe !== undefined && { rpe: v.rpe }) };
    setDraft(next);
    void log(next);
  };

  // Start on the first step with sets left, once the plan and logged sets are loaded.
  useEffect(() => {
    if (positioned.current || !steps.length || !setsLoaded) return;
    positioned.current = true;
    const left = steps.find((x) => sets.filter((s) => s.exerciseId === x.item.exerciseId).length < x.item.sets) ?? steps.at(-1)!;
    const e = getExercise(left.item.exerciseId);
    if (e) select(e);
  });

  const stepIdx = steps.findIndex((x) => x.item.exerciseId === curId);
  const nextStep = stepIdx >= 0 ? steps[stepIdx + 1] : undefined;

  const finish = async () => {
    await finishWorkout(workout.id, workout.startedAt);
    onDone();
  };
  const cancel = () =>
    Alert.alert("Discard session?", "Logged sets are removed from history.", [
      { text: "Keep logging" },
      { text: "Discard", style: "destructive", onPress: () => void discardWorkout(workout.id).then(onDone) },
    ]);

  if (picking) return <Picker type={type} ctx={ctx} onPick={select} onClose={() => setPicking(false)} />;

  return (
    <ScrollView ref={scroll} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>{type} session</Text>
      {stepIdx >= 0 && cur && (
        <View style={{ backgroundColor: "#f3f4f6", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <Text style={{ fontWeight: "700" }}>
            {steps[stepIdx]!.warmup ? "Warm-up" : "Exercise"} · step {stepIdx + 1} of {steps.length}
          </Text>
          <Text style={{ fontSize: 16, marginTop: 4 }}>
            Target: {describeItem(steps[stepIdx]!.item)} · rest {steps[stepIdx]!.item.restSec}s · done {curSets.length}/{plural(steps[stepIdx]!.item.sets, "set")}
          </Text>
          {steps[stepIdx]!.item.notes !== "" && <Text style={{ fontStyle: "italic", marginTop: 4 }}>{steps[stepIdx]!.item.notes}</Text>}
          {cur.cues.map((c, i) => (
            <Text key={i}>- {c}</Text>
          ))}
          <Text style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Film it</Text>
          {nextStep && <Btn t={`Next: ${getExercise(nextStep.item.exerciseId)?.name ?? nextStep.item.exerciseId}`} color="#059669" onPress={() => select(getExercise(nextStep.item.exerciseId)!)} />}
        </View>
      )}
      {restEnds && <RestTimer endsAt={restEnds} onChange={setRestEnds} />}

      <Chips options={order.map((id) => ({ id, label: getExercise(id)?.name ?? id }))} value={curId} onChange={(id: string) => select(getExercise(id)!)} />
      <Btn t="+ Add exercise" onPress={() => setPicking(true)} />

      {cur && draft && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", marginBottom: 8 }}>{cur.name}</Text>
          {curSets.map((s, i) => (
            <Text key={s.id}>
              Set {i + 1}: {fmtSet(cur, s)}
              {s.footContacts ? ` (${s.footContacts} contacts)` : ""}
            </Text>
          ))}
          {cur.unit === "reps" ? (
            <Stepper label="Reps" value={draft.reps} step={STEPS.reps} onChange={(reps) => setDraft({ ...draft, reps })} />
          ) : (
            <Stepper label="Time" value={draft.durationS} step={STEPS.durationS} unit="s" onChange={(durationS) => setDraft({ ...draft, durationS })} />
          )}
          <Stepper label="Load" value={draft.loadKg} step={STEPS.loadKg} unit=" kg" onChange={(loadKg) => setDraft({ ...draft, loadKg })} />
          <Text style={{ fontWeight: "600" }}>RPE</Text>
          <Chips options={RPE_OPTIONS.map((n) => ({ id: n, label: String(n) }))} value={draft.rpe} onChange={(rpe: number) => setDraft({ ...draft, rpe: draft.rpe === rpe ? null : rpe })} />
          <Btn t="Log set" onPress={() => void log(draft)} />
          {curSets.length > 0 && (
            <>
              <Btn t="Repeat last set" onPress={() => void log(draftFor(cur, lastOf(cur.id)))} />
              <Btn t="Undo last set" color="#6b7280" onPress={() => void undoSet(lastOf(cur.id)!.id).then(reload)} />
            </>
          )}

          <Pressable
            disabled={!voice.available}
            onPressIn={() => void voice.start()}
            onPressOut={voice.stop}
            style={{ padding: 18, borderRadius: 8, alignItems: "center", marginBottom: 8, backgroundColor: !voice.available ? "#9ca3af" : voice.listening ? "#dc2626" : "#059669" }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>
              {!voice.available ? "Voice unavailable" : voice.listening ? "Listening..." : "Hold to talk"}
            </Text>
          </Pressable>
          {voice.heard !== "" && <Text style={{ marginBottom: 8 }}>Heard: {voice.heard}</Text>}
          {voice.parsed && (
            <Btn
              t={voice.parsed.same ? "Confirm: same again" : `Confirm: ${fmtSet(cur, { reps: voice.parsed.reps ?? draft.reps, loadKg: voice.parsed.loadKg ?? draft.loadKg, durationS: draft.durationS, rpe: voice.parsed.rpe ?? draft.rpe })}`}
              color="#059669"
              onPress={confirmVoice}
            />
          )}

          <Btn t="Pain" color="#dc2626" onPress={() => setPain(true)} />
        </View>
      )}

      {pain && cur && (
        <View onLayout={(e) => scroll.current?.scrollTo({ y: e.nativeEvent.layout.y, animated: true })}>
          <PainCheck
            exercise={cur}
            regression={cur.regressionId ? getExercise(cur.regressionId) : undefined}
            onSave={(v) => savePain({ workoutId: workout.id, exerciseId: cur.id, ...v })}
            onSwitch={select}
            onStopSession={() => void finish()}
            onClose={() => setPain(false)}
          />
        </View>
      )}

      <Btn t="Finish session" onPress={() => void finish()} />
      <Btn t="Discard session" color="#6b7280" onPress={cancel} />
    </ScrollView>
  );
}
