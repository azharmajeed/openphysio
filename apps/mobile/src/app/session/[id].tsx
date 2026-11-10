import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { getPlanned, workoutFor, type Planned } from "../../lib/plandb";
import { Session } from "../../log/Session";
import { QuickLog } from "../../plan/QuickLog";
import { Tracker } from "../../run/Tracker";

type Loaded = { planned: Planned; workout?: Awaited<ReturnType<typeof workoutFor>> } | null | undefined;

/** Session player for one planned session. Runs use the GPS tracker (quick form as fallback), swims the quick form; everything else steps through the M4 session. */
export default function Player() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [state, setState] = useState<Loaded>(undefined);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    void (async () => {
      const planned = await getPlanned(id);
      if (!planned) return setState(null);
      const quick = planned.type === "run" || planned.type === "swim";
      setState({ planned, workout: quick || planned.status === "done" ? undefined : await workoutFor(planned) });
    })();
  }, [id]);

  const done = () => router.back();
  if (state === undefined) return null;
  if (state === null) return <Text style={{ padding: 16 }}>This session no longer exists. It may have been replaced by a new plan.</Text>;
  const { planned, workout } = state;
  if (planned.status === "done")
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: "700" }}>{planned.title}: completed.</Text>
      </View>
    );
  if (!workout)
    return planned.type === "run" && !manual ? (
      <Tracker planned={planned} onDone={done} onManual={() => setManual(true)} />
    ) : (
      <QuickLog planned={planned} onDone={done} />
    );
  return <Session workout={workout} onDone={done} />;
}
