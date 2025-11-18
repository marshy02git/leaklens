// app/_layout.tsx
import "react-native-gesture-handler";              // <-- must be first
import "../firebase/config";                        // ensure Firebase is initialized

import React, { useEffect } from "react";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// ---- Local notifications (works in Expo Go) ----
import * as Notifications from "expo-notifications";

// ---- (Optional) Firebase Auth anon sign-in for RTDB rules auth != null ----
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";

// Show banners while app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () =>
    ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    } as Notifications.NotificationBehavior),
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
        const data = resp.notification.request.content.data as any;
        // Lazy import to avoid circulars
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { router } = require("expo-router");
        // You can route to a specific pipe later with params from `data`
        router.push("/realtimedata");
      } catch {}
    });
    return () => sub.remove();
  }, []);
}

function useAnonAuth() {
  useEffect(() => {
    const auth = getAuth();
    const off = onAuthStateChanged(auth, (u) => {
      if (!u) {
        signInAnonymously(auth).catch((e) =>
          console.warn("Anon sign-in failed:", e?.message || e)
        );
      }
    });
    return off;
  }, []);
}

export default function RootLayout() {
  useLocalNotificationSetup();
  useNotificationNavigation();
  useAnonAuth(); // remove if your RTDB rules are public-read

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
        <Stack.Screen name="qa"/>

      </Stack>
    </GestureHandlerRootView>
  );
}
