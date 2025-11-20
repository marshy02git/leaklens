// app/_layout.tsx
import "react-native-gesture-handler";
import "../firebase/config";

import React, { useEffect, useState } from "react";
import { Platform, View, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";

// ---- Notifications (safe defaults) ----
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    // newer Expo types:
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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

function useNotificationNavigation() {
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      try {
        // lazy import to avoid circular deps
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { router } = require("expo-router");
        router.push("/realtimedata");
      } catch {}
    });
    return () => sub.remove();
  }, []);
}

export default function RootLayout() {
  useLocalNotificationSetup();
  useNotificationNavigation();

  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (u) => setUser(u ?? null));
  }, []);

  // 1) Loading gate: show a stable splash (no navigation here)
  if (user === undefined) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: "#121212", alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#0bfffe" />
        </View>
      </GestureHandlerRootView>
    );
  }

  // 2) Signed OUT: render a stack that ONLY contains /login
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
        <Stack.Screen name="login" /> {/* keep routable, but users won’t see it when signed in */}
      </Stack>
    </GestureHandlerRootView>
  );
}
