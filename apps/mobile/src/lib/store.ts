import { injury, profile, weightEntry } from "@openphysio/core";
import { desc, isNull } from "drizzle-orm";
import { db } from "../db";
import { emptyForm, formToRows, type IntakeForm } from "./intake";

export async function loadForm(): Promise<{ form: IntakeForm; exists: boolean }> {
  const [p] = await db.select().from(profile).limit(1);
  if (!p) return { form: emptyForm(), exists: false };
  const [w] = await db
    .select()
    .from(weightEntry)
    .where(isNull(weightEntry.deletedAt))
    .orderBy(desc(weightEntry.date), desc(weightEntry.updatedAt))
    .limit(1);
  const injuries = await db.select().from(injury).where(isNull(injury.deletedAt));
  return {
    exists: true,
    form: {
      name: p.name,
      birthYear: p.birthYear?.toString() ?? "",
      sex: p.sex,
      heightCm: p.heightCm?.toString() ?? "",
      weightKg: w?.kg.toString() ?? "",
      goals: p.goals,
      equipment: p.equipment,
      sports: p.sports,
      poolDays: p.poolDays,
      injuries: injuries.map((i) => ({
        id: i.id,
        bodyArea: i.bodyArea,
        side: i.side,
        description: i.description,
        avoidAreas: i.avoidAreas,
        status: i.status,
        startedOn: i.startedOn ?? "",
      })),
    },
  };
}

/** Upserts everything; a weight entry is added only when the weight changed. */
export async function saveForm(form: IntakeForm, previousKg: string) {
  const { profileRow, weight, injuries } = formToRows(form);
  await db.transaction(async (tx) => {
    await tx.insert(profile).values(profileRow).onConflictDoUpdate({ target: profile.id, set: profileRow });
    if (weight && form.weightKg !== previousKg) await tx.insert(weightEntry).values(weight);
    for (const i of injuries) await tx.insert(injury).values(i).onConflictDoUpdate({ target: injury.id, set: i });
  });
}
