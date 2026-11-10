import { useRouter } from "expo-router";
import { QuickLog } from "../plan/QuickLog";

export default function SwimScreen() {
  const router = useRouter();
  return <QuickLog type="swim" onDone={router.back} />;
}
