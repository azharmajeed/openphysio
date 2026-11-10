import { useLocalSearchParams } from "expo-router";
import { RunDetail } from "../../run/RunDetail";

export default function RunDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RunDetail id={id} />;
}
