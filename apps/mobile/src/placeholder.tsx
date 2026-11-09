import { Text, View } from "react-native";

export function Placeholder({ title }: { title: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>{title} placeholder</Text>
    </View>
  );
}
