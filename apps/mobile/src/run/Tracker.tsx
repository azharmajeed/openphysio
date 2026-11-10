import { GEO, trackStats, type TrackStats } from "@openphysio/core";
import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { describeItem } from "../lib/plan";
import type { Planned } from "../lib/plandb";
import { fmtDur, fmtPace } from "../lib/run";
import { SessionCard } from "../plan/SessionCard";
import { activeRun, discardRun, finishRun, runPoints, startRun } from "./rundb";
import { RUN_TASK } from "./task";

type Run = NonNullable<Awaited<ReturnType<typeof activeRun>>>;
const POLL_MS = 2000;

const Big = ({ label, value }: { label: string; value: string }) => (
  <View style={{ flex: 1, alignItems: "center", marginBottom: 16 }}>
    <Text style={{ fontSize: 32, fontWeight: "700" }}>{value}</Text>
    <Text style={{ color: "#6b7280" }}>{label}</Text>
  </View>
);
const Btn = ({
  label,
  onPress,
  color = "#2563eb",
}: {
  label: string;
  onPress: () => void;
  color?: string;
}) => (
  <Pressable
    onPress={onPress}
    style={{
      padding: 16,
      borderRadius: 8,
      backgroundColor: color,
      alignItems: "center",
      marginBottom: 8,
    }}
  >
    <Text style={{ color: "#fff", fontWeight: "700" }}>{label}</Text>
  </Pressable>
);

const startUpdates = () =>
  Location.startLocationUpdatesAsync(RUN_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 2000,
    distanceInterval: 0,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: "OpenPhysio",
      notificationBody: "Tracking your run",
      killServiceOnDestroy: false,
    },
  });
const stopUpdates = async () => {
  if (await Location.hasStartedLocationUpdatesAsync(RUN_TASK))
    await Location.stopLocationUpdatesAsync(RUN_TASK);
};

/** GPS run: start, pause, resume, finish, with live time, distance and pace. Resumes an unfinished run on reopen. */
export function Tracker({
  planned,
  onDone,
  onManual,
}: {
  planned?: Planned;
  onDone: () => void;
  onManual: () => void;
}) {
  const [run, setRun] = useState<Run>();
  const [tracking, setTracking] = useState(false);
  const [stats, setStats] = useState<TrackStats>();
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      setRun(await activeRun());
      setTracking(await Location.hasStartedLocationUpdatesAsync(RUN_TASK));
      setLoaded(true);
    })();
  }, []);

  const refresh = useCallback(async () => {
    if (run) setStats(trackStats(await runPoints(run.id)));
  }, [run]);
  useEffect(() => {
    void refresh();
    if (!run) return;
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [run, refresh]);

  const begin = async (r: Run) => {
    try {
      await startUpdates();
      setTracking(true);
    } catch (e) {
      setErr(`Could not start tracking: ${(e as Error).message}`);
    }
    setRun(r);
  };
  const start = async () => {
    setErr("");
    const fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted)
      return setErr(
        "Location permission was denied, so the run cannot be tracked. Allow it in Android settings, or log the run without GPS.",
      );
    // Background permission keeps tracking going with the screen off; the foreground-service notification covers the rest.
    await Location.requestBackgroundPermissionsAsync();
    await begin(await startRun(planned?.id));
  };
  const pause = async () => {
    await stopUpdates();
    setTracking(false);
  };
  const finish = async () => {
    if (!run) return;
    await stopUpdates();
    setTracking(false);
    if (!(await finishRun(run)))
      Alert.alert("Nothing recorded", "No distance was tracked, so this run was not saved.");
    onDone();
  };
  const discard = () =>
    Alert.alert("Discard this run?", "The tracked route is deleted and cannot be restored.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () =>
          void (async () => {
            await stopUpdates();
            if (run) await discardRun(run.id);
            onDone();
          })(),
      },
    ]);

  if (!loaded) return null;
  const target = planned?.items[0];
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {planned && !run && <SessionCard s={planned} />}
      {!run && (
        <>
          <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 4 }}>Track with GPS</Text>
          <Text style={{ marginBottom: 12 }}>
            OpenPhysio uses your location only while a run is being tracked, to measure distance and
            pace. Tracking continues with the screen off and shows a notification until you finish.
            The route stays on this phone.
          </Text>
          <Btn label="Allow location and start" onPress={() => void start()} />
          <Pressable onPress={onManual} style={{ padding: 12, alignItems: "center" }}>
            <Text style={{ color: "#2563eb" }}>Log without GPS</Text>
          </Pressable>
        </>
      )}
      {run && (
        <>
          {target && (
            <Text style={{ marginBottom: 12, color: "#6b7280" }}>
              Target: {describeItem(target)}
            </Text>
          )}
          <View style={{ flexDirection: "row" }}>
            <Big label="time" value={fmtDur(stats?.movingS ?? 0)} />
            <Big label="km" value={((stats?.distanceM ?? 0) / 1000).toFixed(2)} />
          </View>
          <View style={{ flexDirection: "row" }}>
            <Big label="pace /km" value={fmtPace(stats?.currentPaceSPerKm ?? null)} />
            <Big label="avg /km" value={fmtPace(stats?.avgPaceSPerKm ?? null)} />
          </View>
          <Text style={{ textAlign: "center", marginBottom: 12, color: "#6b7280" }}>
            {tracking ? "Tracking" : "Paused"} · gaps over {GEO.maxGapS} s are not timed
          </Text>
          {tracking ? (
            <Btn label="Pause" onPress={() => void pause()} color="#d97706" />
          ) : (
            <Btn label="Resume" onPress={() => void begin(run)} />
          )}
          <Btn label="Finish and save" onPress={() => void finish()} color="#059669" />
          <Pressable onPress={discard} style={{ padding: 12, alignItems: "center" }}>
            <Text style={{ color: "#dc2626" }}>Discard run</Text>
          </Pressable>
        </>
      )}
      {err !== "" && <Text style={{ color: "#dc2626", marginTop: 8 }}>{err}</Text>}
    </ScrollView>
  );
}
