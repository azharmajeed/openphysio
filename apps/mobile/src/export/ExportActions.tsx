import { runPoint, type Workout } from "@openphysio/core";
import { toGpx, toTcx } from "@openphysio/integrations";
import { and, asc, eq, isNull } from "drizzle-orm";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { db } from "../db";
import { MIME, exportFilename, formatsFor, type ExportFormat } from "./name";

const points = (workoutId: string) =>
  db
    .select({ t: runPoint.t, lat: runPoint.lat, lon: runPoint.lon, alt: runPoint.alt, hr: runPoint.hr })
    .from(runPoint)
    .where(and(eq(runPoint.workoutId, workoutId), isNull(runPoint.deletedAt)))
    .orderBy(asc(runPoint.t));

/** Writes the file to the cache dir and opens the Android share sheet (save, send, or upload on strava.com). */
async function exportWorkout(w: Workout, format: ExportFormat) {
  const pts = await points(w.id);
  const file = new File(Paths.cache, exportFilename(w.type, w.startedAt, format));
  file.create({ overwrite: true });
  file.write(format === "gpx" ? toGpx(w, pts) : toTcx(w, pts));
  await Sharing.shareAsync(file.uri, { mimeType: MIME[format], dialogTitle: "Export workout" });
}

export function ExportActions({ w }: { w: Workout }) {
  const [err, setErr] = useState<string | null>(null);
  const go = (f: ExportFormat) =>
    exportWorkout(w, f).then(
      () => setErr(null),
      (e: unknown) => setErr(e instanceof Error ? e.message : "Export failed"),
    );
  return (
    <View style={{ marginTop: 16 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {formatsFor(w.type).map((f) => (
          <Pressable
            key={f}
            onPress={() => void go(f)}
            style={{ flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#2563eb", alignItems: "center" }}
          >
            <Text style={{ color: "#2563eb", fontWeight: "700" }}>Export {f.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={{ marginTop: 8, color: "#6b7280" }}>
        To upload to Strava: save the file, then on strava.com choose Upload activity and pick it.
      </Text>
      {err ? <Text style={{ marginTop: 4, color: "#b91c1c" }}>{err}</Text> : null}
    </View>
  );
}
