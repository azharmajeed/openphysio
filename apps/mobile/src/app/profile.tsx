import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import { ProfileForm } from "../ProfileForm";
import { loadForm, saveForm } from "../lib/store";
import type { IntakeForm } from "../lib/intake";

export default function Profile() {
  const router = useRouter();
  const [form, setForm] = useState<IntakeForm | null>(null);
  useEffect(() => void loadForm().then((r) => setForm(r.form)), []);
  if (!form) return <Text style={{ padding: 16 }}>Loading</Text>;
  return (
    <ProfileForm
      initial={form}
      submitLabel="Save"
      onSubmit={async (f) => {
        await saveForm(f, form.weightKg);
        router.back();
      }}
    />
  );
}
