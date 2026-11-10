import { Text, View } from "react-native";
import Svg, { Polyline, Rect } from "react-native-svg";

const W = 300;
const H = 80;

/** Bars, oldest left; the last bar (this week) is darker. */
export function Bars({ values, color = "#2563eb" }: { values: number[]; color?: string }) {
  const max = Math.max(...values, 1);
  const bw = W / values.length;
  return (
    <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
      {values.map((v, i) => (
        <Rect key={i} x={i * bw + 2} y={H - (v / max) * H} width={bw - 4} height={(v / max) * H} fill={color} opacity={i === values.length - 1 ? 1 : 0.55} />
      ))}
    </Svg>
  );
}

export function Line({ values, color = "#059669" }: { values: number[]; color?: string }) {
  const [min, max] = [Math.min(...values), Math.max(...values)];
  const span = max - min || 1;
  const pts = values.map((v, i) => `${values.length > 1 ? (i / (values.length - 1)) * W : W / 2},${H - 4 - ((v - min) / span) * (H - 8)}`).join(" ");
  return (
    <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
      <Polyline points={pts} fill="none" stroke={color} strokeWidth={3} />
    </Svg>
  );
}

export const Card = ({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) => (
  <View style={{ borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, marginBottom: 12 }}>
    <Text style={{ fontWeight: "700" }}>{title}</Text>
    {sub ? <Text style={{ color: "#4b5563", marginBottom: 6 }}>{sub}</Text> : null}
    {children}
  </View>
);
