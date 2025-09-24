import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="+not-found" />
      <Stack.Screen name="ar" />
      <Stack.Screen name="notificationlogs" />
      <Stack.Screen name="realtimedata" />
      <Stack.Screen name="index" />
    </Stack>
  );
}
