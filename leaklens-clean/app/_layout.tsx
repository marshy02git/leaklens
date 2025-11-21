import "react-native-gesture-handler";

import React, { useEffect, useState } from "react";
import { Platform, View, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";

// ✅ Shared firebase exports
import { auth } from "../firebase/config";
import { onAuthStateChanged, type User } from "firebase/auth";

// ✅ Critical alerts watcher (now outside app/)
import { attachCriticalAlertWatchers } from "../lib/alerts-notifier";

// ---- Notifications handler (foreground behavior) ----
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // Newer Expo flags (iOS-style)
    shouldShowBanner: true,
    shouldShowList: true,
    // Clarify behavior
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// ---- Local notification setup (permissions + channel) ----
function useLocalNotificationSetup() {
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") {
        await Notifications.requestPermissionsAsync();
      }
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }
    })();
  }, []);
}

// ---- Handle taps on notifications ----
function useNotificationNavigation() {
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      try {
        // Lazy import to avoid circular deps with expo-router
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { router } = require("expo-router");

        const data = resp.notification.request.content.data as
          | { room?: string; pipe?: string }
          | undefined;

        // For now, always go to the notification logs screen
        // (you can later branch on data.room/pipe to deep-link to a pipe)
        router.push("/notificationlogs");
      } catch (e) {
        console.warn("[_layout] notification navigation error:", e);
      }
    });
    return () => sub.remove();
  }, []);
}

// ---- Attach watchers that turn Alerts/{room} into OS banners ----
function useCriticalAlertWatchers(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    console.log("[_layout] Attaching critical alert watchers");
    const detach = attachCriticalAlertWatchers(["Room6", "Room4", "Room1"]);
    return () => {
      console.log("[_layout] Detaching critical alert watchers");
      detach();
    };
  }, [enabled]);
}

export default function RootLayout() {
  useLocalNotificationSetup();
  useNotificationNavigation();

  // undefined => loading, null => signed out, User => signed in
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    // ✅ subscribe using the shared `auth`
    const off = onAuthStateChanged(auth, (u) => setUser(u ?? null));
    return off;
  }, []);

  // Attach alert watchers only when signed in
  useCriticalAlertWatchers(!!user);

  // 1) Loading gate: show a stable splash (no navigation here)
  if (user === undefined) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            backgroundColor: "#121212",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator color="#0bfffe" />
        </View>
      </GestureHandlerRootView>
    );
  }

  // 2) Signed OUT: render only the /login screen
  if (!user) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
        </Stack>
      </GestureHandlerRootView>
    );
  }

  // 3) Signed IN: render your full app stack
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
        <Stack.Screen name="ar" />
        <Stack.Screen name="notificationlogs" />
        <Stack.Screen name="realtimedata" />
        <Stack.Screen name="pipe/[pipe]" />
        <Stack.Screen name="index" />
        <Stack.Screen name="qa" />
        {/* Keep routable for testing, but users won't see it when signed in */}
        <Stack.Screen name="login" />
      </Stack>
    </GestureHandlerRootView>
  );
}
