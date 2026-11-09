import { useRouter } from "expo-router";
import { ProfileForm } from "../ProfileForm";
import { emptyForm } from "../lib/intake";
import { saveForm } from "../lib/store";

export default function Intake() {
  const router = useRouter();
  return (
    <ProfileForm
      initial={emptyForm()}
      submitLabel="Save and start"
      onSubmit={async (f) => {
        await saveForm(f, "");
        router.replace("/(tabs)");
      }}
    />
  );
}
