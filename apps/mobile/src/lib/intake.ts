import { newRow, type BodyArea, type InjuryStatus, type Sex, type Side } from "@openphysio/core";
import { exercises, goals } from "@openphysio/catalog";

export type Option = { id: string; label: string };

const humanize = (id: string) => (id.charAt(0).toUpperCase() + id.slice(1)).replace(/_/g, " ");
const opt = (id: string): Option => ({ id, label: humanize(id) });

/** Options come from catalogue data, never literals. */
export const goalOptions: Option[] = goals.map((g) => ({ id: g.id, label: g.label }));
export const equipmentOptions: Option[] = [...new Set(exercises.flatMap((e) => e.equipment))].map(opt);
export const sportOptions: Option[] = [
  ...new Set(goals.flatMap((g) => g.demands.map((d) => d.sport).filter((s): s is string => !!s))),
].map(opt);
/** Date.getDay() numbers 0..6 with locale short names (2023-01-01 is a Sunday). */
export const weekdayOptions = [0, 1, 2, 3, 4, 5, 6].map((n) => ({
  id: n,
  label: new Date(2023, 0, 1 + n).toLocaleDateString(undefined, { weekday: "short" }),
}));
export const humanizeId = humanize;

export type InjuryForm = {
  id?: string;
  bodyArea: BodyArea;
  side: Side | null;
  description: string;
  avoidAreas: BodyArea[];
  status: InjuryStatus;
  startedOn: string;
};

export type IntakeForm = {
  name: string;
  birthYear: string;
  sex: Sex | null;
  heightCm: string;
  weightKg: string;
  goals: string[];
  equipment: string[];
  /** Empty sports means "all" to the plan engine, so every derived sport is preselected. */
  sports: string[];
  poolDays: number[];
  injuries: InjuryForm[];
};

export const emptyForm = (): IntakeForm => ({
  name: "",
  birthYear: "",
  sex: null,
  heightCm: "",
  weightKg: "",
  goals: [],
  equipment: [],
  sports: sportOptions.map((s) => s.id),
  poolDays: [],
  injuries: [],
});

const num = (s: string) => {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
export const today = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

/** Form -> DB rows. injuries with an id keep it so edits update, not duplicate. */
export function formToRows(form: IntakeForm, now = Date.now()) {
  const profileRow = {
    id: "me",
    updatedAt: now,
    deletedAt: null,
    name: form.name.trim(),
    birthYear: num(form.birthYear),
    sex: form.sex,
    heightCm: num(form.heightCm),
    goals: form.goals,
    equipment: form.equipment,
    sports: form.sports,
    poolDays: [...form.poolDays].sort(),
    units: "metric" as const,
  };
  const kg = num(form.weightKg);
  const weight = kg === null ? null : { ...newRow(now), date: today(now), kg };
  const injuries = form.injuries.map((i) => ({
    ...(i.id ? { id: i.id, updatedAt: now, deletedAt: null } : newRow(now)),
    bodyArea: i.bodyArea,
    side: i.side,
    description: i.description.trim(),
    avoidAreas: i.avoidAreas.length ? i.avoidAreas : [i.bodyArea],
    status: i.status,
    startedOn: i.startedOn || null,
    source: "manual" as const,
  }));
  return { profileRow, weight, injuries };
}

export const validate = (form: IntakeForm) => (form.name.trim() ? null : "Name is required");
