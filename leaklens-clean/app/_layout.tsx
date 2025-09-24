import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
      <Stack.Screen name="ar" options={{title:'AR'}} />
      <Stack.Screen name="notificationlogs" options={{title:'Notification Logs'}} />
      <Stack.Screen name="realtimedata" options={{title:'Real Time Data'}} />
      <Stack.Screen name="index" options={{title:'Home'}} />
    </Stack>
  );
}
