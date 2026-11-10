import { useRouter } from "expo-router";
import { useState } from "react";
import { QuickLog } from "../../plan/QuickLog";
import { Tracker } from "../../run/Tracker";

/** Unplanned GPS run (also resumes an unfinished one). */
export default function RunScreen() {
  const router = useRouter();
  const [manual, setManual] = useState(false);
  return manual ? (
    <QuickLog type="run" onDone={router.back} />
  ) : (
    <Tracker onDone={router.back} onManual={() => setManual(true)} />
  );
}
