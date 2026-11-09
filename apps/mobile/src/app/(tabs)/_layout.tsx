import { Link, Tabs } from "expo-router";
import { Text } from "react-native";

const tabs = ["index", "plan", "log", "learn", "coach"] as const;
const titles = { index: "Today", plan: "Plan", log: "Log", learn: "Learn", coach: "Coach" };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerRight: () => (
          <Link href="/settings" style={{ marginRight: 16 }}>
            <Text>Settings</Text>
          </Link>
        ),
      }}
    >
      {tabs.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ title: titles[name] }} />
      ))}
    </Tabs>
  );
}
