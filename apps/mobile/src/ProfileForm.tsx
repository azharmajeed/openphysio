import { BODY_AREAS, INJURY_STATUSES, SEXES, SIDES } from "@openphysio/core";
import { useState } from "react";
import { Button, ScrollView, Text, TextInput, View } from "react-native";
import { equipmentOptions, goalOptions, humanizeId, sportOptions, today, validate, weekdayOptions, type InjuryForm, type IntakeForm } from "./lib/intake";
import { Chips, input, label } from "./ui";

const opts = (xs: readonly string[]) => xs.map((id) => ({ id, label: humanizeId(id) }));
const areaOpts = opts(BODY_AREAS);

const newInjury = (): InjuryForm => ({
  bodyArea: BODY_AREAS[0],
  side: null,
  description: "",
  avoidAreas: [BODY_AREAS[0]],
  status: "active",
  startedOn: today(),
});

/** Shared by first-run intake and the Profile screen. */
export function ProfileForm(p: { initial: IntakeForm; submitLabel: string; onSubmit: (f: IntakeForm) => Promise<void> }) {
  const [f, setF] = useState(p.initial);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof IntakeForm>(k: K, v: IntakeForm[K]) => setF((s) => ({ ...s, [k]: v }));
  const setInj = (idx: number, patch: Partial<InjuryForm>) =>
    set("injuries", f.injuries.map((i, n) => (n === idx ? { ...i, ...patch } : i)));

  async function submit() {
    const e = validate(f);
    setErr(e);
    if (!e) await p.onSubmit(f).catch((x) => setErr(String(x)));
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Text style={label}>Name</Text>
      <TextInput style={input} value={f.name} onChangeText={(v) => set("name", v)} />
      <Text style={label}>Birth year</Text>
      <TextInput style={input} value={f.birthYear} onChangeText={(v) => set("birthYear", v)} keyboardType="number-pad" />
      <Text style={label}>Sex</Text>
      <Chips options={opts(SEXES)} value={f.sex} onChange={(v) => set("sex", v)} />
      <Text style={label}>Height (cm)</Text>
      <TextInput style={input} value={f.heightCm} onChangeText={(v) => set("heightCm", v)} keyboardType="decimal-pad" />
      <Text style={label}>Weight (kg)</Text>
      <TextInput style={input} value={f.weightKg} onChangeText={(v) => set("weightKg", v)} keyboardType="decimal-pad" />
      <Text style={label}>Goals</Text>
      <Chips options={goalOptions} value={f.goals} onChange={(v) => set("goals", v)} />
      <Text style={label}>Equipment</Text>
      <Chips options={equipmentOptions} value={f.equipment} onChange={(v) => set("equipment", v)} />
      <Text style={label}>Sports</Text>
      <Chips options={sportOptions} value={f.sports} onChange={(v) => set("sports", v)} />
      <Text style={label}>Pool days</Text>
      <Chips options={weekdayOptions} value={f.poolDays} onChange={(v) => set("poolDays", v)} />

      <Text style={[label, { fontSize: 18, marginTop: 12 }]}>Injuries</Text>
      {f.injuries.map((i, n) => (
        <View key={i.id ?? n} style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 8, marginBottom: 12 }}>
          <Text style={label}>Body area</Text>
          <Chips options={areaOpts} value={i.bodyArea} onChange={(v) => setInj(n, { bodyArea: v, avoidAreas: i.avoidAreas.length ? i.avoidAreas : [v] })} />
          <Text style={label}>Side</Text>
          <Chips options={opts(SIDES)} value={i.side} onChange={(v) => setInj(n, { side: v })} />
          <Text style={label}>Description</Text>
          <TextInput style={input} value={i.description} onChangeText={(v) => setInj(n, { description: v })} multiline />
          <Text style={label}>Avoid areas (defaults to body area)</Text>
          <Chips options={areaOpts} value={i.avoidAreas} onChange={(v) => setInj(n, { avoidAreas: v })} />
          <Text style={label}>Status</Text>
          <Chips options={opts(INJURY_STATUSES)} value={i.status} onChange={(v) => setInj(n, { status: v })} />
          <Text style={label}>Started on (YYYY-MM-DD)</Text>
          <TextInput style={input} value={i.startedOn} onChangeText={(v) => setInj(n, { startedOn: v })} />
          {i.status !== "resolved" && <Button title="Mark resolved" onPress={() => setInj(n, { status: "resolved" })} />}
          {!i.id && <Button title="Remove" onPress={() => set("injuries", f.injuries.filter((_, k) => k !== n))} />}
        </View>
      ))}
      <Button title="Add injury" onPress={() => set("injuries", [...f.injuries, newInjury()])} />
      {err && <Text style={{ color: "#b91c1c", marginTop: 12 }}>{err}</Text>}
      <View style={{ marginTop: 16, marginBottom: 32 }}>
        <Button title={p.submitLabel} onPress={submit} />
      </View>
    </ScrollView>
  );
}
