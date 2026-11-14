import { Ionicons } from "@expo/vector-icons";
import { Link, Tabs } from "expo-router";

/** UI configuration: one tab per entry, with its title and Ionicons name. */
const tabs = [
  { name: "index", title: "Today", icon: "today-outline" },
  { name: "plan", title: "Plan", icon: "calendar-outline" },
  { name: "log", title: "Log", icon: "barbell-outline" },
  { name: "learn", title: "Learn", icon: "book-outline" },
  { name: "coach", title: "Coach", icon: "chatbubble-ellipses-outline" },
] as const;

const HeaderIcon = ({ href, icon, label }: { href: "/progress" | "/settings"; icon: "stats-chart-outline" | "settings-outline"; label: string }) => (
  <Link href={href} accessibilityLabel={label} style={{ marginHorizontal: 8 }}>
    <Ionicons name={icon} size={22} />
  </Link>
);

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerRight: () => (
          <>
            <HeaderIcon href="/progress" icon="stats-chart-outline" label="Progress" />
            <HeaderIcon href="/settings" icon="settings-outline" label="Settings" />
          </>
        ),
      }}
    >
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, size }) => <Ionicons name={t.icon} color={String(color)} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
