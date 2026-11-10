import { Link } from "expo-router";
import Storage from "expo-sqlite/kv-store";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Image, Modal, Pressable, RefreshControl, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { loadConfig } from "../sync";
import { embedUrl, ERROR_TEXT, fetchFeed, formatDate, loadCachedFeed, saveFeed, type FeedItem, type LearnError } from "./feed";

export default function LearnScreen() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [error, setError] = useState<LearnError>();
  const [failed, setFailed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState<FeedItem>();

  const refresh = useCallback(async () => {
    setBusy(true);
    const r = await fetchFeed(await loadConfig());
    if (r.ok) {
      setItems(r.items);
      setError(undefined);
      setFailed(r.failed);
      if (r.items.length) await saveFeed(Storage, r.items);
    } else setError(r.error);
    setBusy(false);
  }, []);

  useEffect(() => {
    void loadCachedFeed(Storage).then(setItems);
    void refresh();
  }, [refresh]);

  const settings = error === "notConfigured" || error === "badToken";
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Link href="/channels" style={{ color: "#2563eb", marginBottom: 8 }}>
        Channels
      </Link>
      {error && (
        <Text style={{ color: "#b91c1c", marginBottom: 8 }}>
          {ERROR_TEXT[error]}
          {error === "offline" && items.length ? " Showing saved videos." : ""}{" "}
          {settings && (
            <Link href="/settings" style={{ color: "#2563eb" }}>
              Open Settings
            </Link>
          )}
        </Text>
      )}
      {failed > 0 && !error && <Text style={{ color: "#92400e", marginBottom: 8 }}>{failed} channel(s) could not be loaded.</Text>}
      <FlatList
        data={items}
        keyExtractor={(i) => i.videoId}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void refresh()} />}
        ListEmptyComponent={<Text>{busy || error ? "" : "No videos yet. Pull down to refresh, or follow channels."}</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => setPlaying(item)} style={{ flexDirection: "row", marginBottom: 12 }}>
            <Image source={{ uri: item.thumbnailUrl }} style={{ width: 128, height: 72, borderRadius: 6, backgroundColor: "#e5e7eb" }} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ fontWeight: "600" }} numberOfLines={3}>
                {item.title}
              </Text>
              <Text style={{ color: "#555", marginTop: 2 }}>
                {item.channel} · {formatDate(item.published)}
              </Text>
            </View>
          </Pressable>
        )}
      />
      <Modal visible={!!playing} animationType="slide" onRequestClose={() => setPlaying(undefined)}>
        <View style={{ flex: 1, backgroundColor: "#000", paddingTop: 40 }}>
          <Pressable onPress={() => setPlaying(undefined)} style={{ padding: 12 }}>
            <Text style={{ color: "#fff", fontSize: 16 }}>Close</Text>
          </Pressable>
          {playing && <WebView source={{ uri: embedUrl(playing.videoId) }} allowsFullscreenVideo style={{ flex: 1 }} />}
        </View>
      </Modal>
    </View>
  );
}
