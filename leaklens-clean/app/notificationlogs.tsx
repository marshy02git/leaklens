// app/notificationlogs.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Platform,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";

import { rtdb, auth } from "../firebase/config";
import { ref, onValue, off, push, set } from "firebase/database";
import { onAuthStateChanged, type User } from "firebase/auth";

/* ----------------- helpers ----------------- */
const formatTimeWithMs = (ms?: number) => {
  if (!ms) return "—";
  try {
    // @ts-ignore fractionalSecondDigits may be missing in some RN TS defs
    return new Date(ms).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
  } catch {
    const d = new Date(ms);
    const z = (n: number, w = 2) => String(n).padStart(w, "0");
    return `${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}.${z(
      d.getMilliseconds(),
      3
    )}`;
  }
};

type AlertRow = {
  id: string;
  room: string;
  pipe?: string;
  level: "info" | "caution" | "critical";
  message?: string;
  ts_server_ms?: number;
};

/* ----------------- screen ----------------- */
export default function NotificationLogsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ room?: string; pipe?: string }>();

  const [user, setUser] = useState<User | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [statusIndex, setStatusIndex] = useState(0);
  const lastRefresh = useRef<number>(Date.now());

  const openedFromNotification = !!(params.room || params.pipe);

  // notifications perms (ok even if also done in _layout)
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

  // watch auth (✅ use shared auth from config)
  useEffect(() => {
    const offAuth = onAuthStateChanged(auth, (u) => setUser(u ?? null));
    return offAuth;
  }, []);

  // subscribe to Alerts root: Alerts/{room}/{id}
  useEffect(() => {
    const alertsRef = ref(rtdb, "Alerts");
    const unsub = onValue(
      alertsRef,
      (snap) => {
        const val = snap.val() || {};
        const rows: AlertRow[] = [];

        Object.keys(val).forEach((room) => {
          const node = val[room] || {};
          Object.keys(node).forEach((id) => {
            const a = node[id] || {};
            rows.push({
              id,
              room,
              pipe: a.pipe,
              level: a.level ?? "info",
              message: a.message,
              ts_server_ms: a.ts_server_ms,
            });
          });
        });

        rows.sort((a, b) => (b.ts_server_ms ?? 0) - (a.ts_server_ms ?? 0));
        setAlerts(rows.slice(0, 100));
        setError(null);
      },
      (err) => setError(err?.message ?? "Alerts read error")
    );
    return () => off(alertsRef, "value", unsub);
  }, []);

  const statusStates = [
    { label: "Good", color: "#28a745", icon: "check" as const },
    { label: "Caution", color: "#ffc107", icon: "exclamation-triangle" as const },
    { label: "Critical", color: "#dc3545", icon: "times" as const },
  ];
  const currentStatus = statusStates[statusIndex];

  const handleStatusPress = () =>
    setStatusIndex((prevIndex) => (prevIndex + 1) % statusStates.length);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      lastRefresh.current = Date.now();
      setRefreshing(false);
    }, 600);
  }, []);

  const criticalCount = useMemo(
    () => alerts.filter((a) => a.level === "critical").length,
    [alerts]
  );

  // Test button: requires signed-in user to write to RTDB.
  // Still shows a local OS notification so you can confirm push/UI behavior.
  const sendTestLocal = useCallback(async () => {
    try {
      if (!user) {
        Alert.alert(
          "Sign in required",
          "Please sign in to write a test alert to the log.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Go to Login", onPress: () => router.push("/login") },
          ]
        );
      } else {
        const room = "Room6"; // change as desired
        const pipe = "Pipe2";
        const newRef = push(ref(rtdb, `Alerts/${room}`));
        await set(newRef, {
          level: "critical",
          message: "Manual test alert from app",
          room,
          pipe,
          ts_server_ms: Date.now(),
          from_uid: user.uid,
        });
      }

      // Always show a local device notification so you can test OS banner/tap behavior
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "LeakLens • Test",
          body: "Manual test notification",
          data: {
            screen: "notificationlogs",
            room: "Room6",
            pipe: "Pipe2",
          },
        },
        trigger: null,
      });
    } catch (e: any) {
      console.warn("Test alert failed:", e?.message || e);
      Alert.alert("Test Failed", String(e?.message || e));
    }
  }, [user, router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#121212" }} edges={["top"]}>
      <ScrollView
        style={{ flex: 1, backgroundColor: "#121212" }}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <FontAwesome name="arrow-left" size={25} color="white" />
          </TouchableOpacity>
          <Text style={styles.title}>Notifications</Text>
        </View>

        {/* If opened from a notification, show quick context */}
        {openedFromNotification && (
          <View style={styles.openedFromBanner}>
            <FontAwesome name="bell" size={14} color="#0bfffe" />
            <Text style={styles.openedFromText}>
              Opened from alert
              {params.room ? ` • ${params.room}` : ""}
              {params.pipe ? ` / ${params.pipe}` : ""}
            </Text>
          </View>
        )}

        {/* Auth line */}
        <Text style={styles.subheading}>
          Auth:{" "}
          <Text style={{ color: user ? "#0bfffe" : "#f88" }}>
            {user ? user.email ?? user.uid : "signed out"}
          </Text>
        </Text>

        {/* Badges */}
        <View style={styles.badgeRow}>
          <View style={styles.connectionBadge}>
            <FontAwesome name="wifi" size={14} color="white" />
            <Text style={styles.badgeText}>Connected</Text>
          </View>
          <View style={styles.batteryBadge}>
            <FontAwesome name="battery-three-quarters" size={14} color="white" />
            <Text style={styles.badgeText}>Battery: 75%</Text>
          </View>
        </View>

        {/* Status box */}
        <View style={styles.statusContainerWrapper}>
          <TouchableOpacity
            style={[styles.statusContainer, { backgroundColor: currentStatus.color }]}
            onPress={handleStatusPress}
          >
            <FontAwesome
              name={currentStatus.icon}
              size={20}
              color="white"
              style={{ marginRight: 10 }}
            />
            <Text style={styles.statusText}>{currentStatus.label}</Text>
          </TouchableOpacity>
        </View>

        {/* Summary cards */}
        <View style={styles.cardsRow}>
          <View style={styles.card}>
            <Text style={styles.cardTitleCenter}>Critical Alerts</Text>
            <Text style={styles.cardValue}>{criticalCount}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitleCenter}>Last Refresh</Text>
            <Text style={styles.cardValueSm}>{formatTimeWithMs(lastRefresh.current)}</Text>
          </View>
        </View>

        {/* Alerts feed + Test button */}
        <View style={styles.cardWide}>
          <Text style={styles.cardTitle}>All Notifications</Text>

          <TouchableOpacity style={styles.testBtn} onPress={sendTestLocal}>
            <Text style={styles.testBtnText}>Send Test Notification</Text>
          </TouchableOpacity>

          {error ? (
            <Text style={{ color: "#ff9ca0", marginTop: 10 }}>{error}</Text>
          ) : alerts.length === 0 ? (
            <Text style={{ color: "#888", marginTop: 10 }}>No alerts yet.</Text>
          ) : (
            alerts.map((a) => (
              <View key={`${a.room}:${a.id}`} style={styles.alertRow}>
                <View style={styles.alertLeft}>
                  <View
                    style={[
                      styles.levelDot,
                      a.level === "critical"
                        ? { backgroundColor: "#dc3545" }
                        : a.level === "caution"
                        ? { backgroundColor: "#ffc107" }
                        : { backgroundColor: "#28a745" },
                    ]}
                  />
                  <Text style={styles.alertTitle}>
                    {a.room}
                    {a.pipe ? ` / ${a.pipe}` : ""} • {a.level.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.alertTime}>{formatTimeWithMs(a.ts_server_ms)}</Text>
                {a.message ? <Text style={styles.alertMsg}>{a.message}</Text> : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ----------------- styles ----------------- */
const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#121212",
    flexGrow: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  backButton: { paddingRight: 10 },
  title: { fontSize: 24, fontWeight: "bold", color: "white" },

  openedFromBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1f2a",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
    marginLeft: 4,
  },
  openedFromText: { color: "#0bfffe", fontSize: 12, marginLeft: 6 },

  subheading: { fontSize: 12, color: "#aaa", marginBottom: 10, marginLeft: 4 },

  badgeRow: { flexDirection: "row", gap: 8, marginLeft: 4, marginBottom: 8 },
  connectionBadge: {
    backgroundColor: "#2ecc71",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  batteryBadge: {
    backgroundColor: "#f39c12",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  badgeText: { color: "white", fontSize: 12, marginLeft: 6 },

  statusContainerWrapper: { alignItems: "center", marginVertical: 24 },
  statusContainer: {
    width: 300,
    height: 60,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    elevation: 4,
  },
  statusText: { color: "white", fontSize: 22, fontWeight: "bold" },

  cardsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  card: {
    backgroundColor: "#1f1f1f",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    width: "48%",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 6,
  },
  cardTitleCenter: { color: "gray", fontSize: 13, textAlign: "center" },
  cardValue: { color: "#0bfffe", fontSize: 26, fontWeight: "bold", marginTop: 6 },
  cardValueSm: { color: "#0bfffe", fontSize: 14, fontWeight: "600", marginTop: 6 },

  cardWide: {
    backgroundColor: "#1e1e1e",
    padding: 16,
    marginTop: 20,
    borderRadius: 12,
  },
  cardTitle: { fontSize: 18, color: "#0bfffe", marginBottom: 8 },

  testBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#0bfffe",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  testBtnText: { color: "#000", fontWeight: "bold" },

  alertRow: {
    backgroundColor: "#222",
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  alertLeft: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  levelDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  alertTitle: { color: "#fff", fontWeight: "600" },
  alertTime: { color: "#aaa", fontSize: 12, marginTop: 2 },
  alertMsg: { color: "#ddd", fontSize: 13, marginTop: 6 },
});
