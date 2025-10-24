// app/realtimedata.tsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { rtdb } from "../firebase/config";
import { ref, onValue } from "firebase/database";
import { subscribeAlerts } from "../firebase/db";

function getStats(values: (number | undefined)[]) {
  const nums = values.filter((v): v is number => typeof v === "number" && !isNaN(v));
  if (nums.length === 0) return { min: "-", max: "-", avg: "-", current: "-" };
  const avg = (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1);
  return {
    current: nums[nums.length - 1].toFixed(1),
    min: Math.min(...nums).toFixed(1),
    max: Math.max(...nums).toFixed(1),
    avg,
  };
}

const formatTimeWithMs = (ms: number) => {
  try {
    // @ts-ignore
    return new Date(ms).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
  } catch {
    const d = new Date(ms);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    const mmm = String(d.getMilliseconds()).padStart(3, "0");
    return `${hh}:${mm}:${ss}.${mmm}`;
  }
};

type Reading = {
  id: string;          // "Room1/Pipe3"
  t_ms: number;
  flow_Lmin: number;
  temp_C: number;
  pressure_psi: number;
  ts_server_ms: number;
};

export default function RealTimeDataScreen() {
  const router = useRouter();

  // UI state
  const [readings, setReadings] = useState<Reading[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Debug state
  const [rooms, setRooms] = useState<string[]>([]);
  const [pipes, setPipes] = useState<string[]>([]);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // ====== Listener lifecycle refs (so we can detach/reattach on pull-to-refresh) ======
  const devicesUnsubRef = useRef<null | (() => void)>(null);
  const roomUnsubRef = useRef<null | (() => void)>(null);
  const pipeUnsubsRef = useRef<Array<() => void>>([]);
  const alertsUnsubRef = useRef<null | (() => void)>(null);

  // ====== Throttle state updates to avoid jank ======
  const latestMapRef = useRef<Record<string, Reading>>({});
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const THROTTLE_MS = 400; // tweak (300–500ms is a good sweet spot)

  const flushThrottled = useCallback(() => {
    if (throttleTimerRef.current) return;
    throttleTimerRef.current = setTimeout(() => {
      throttleTimerRef.current = null;
      const rows = Object.values(latestMapRef.current);
      setReadings(rows);
    }, THROTTLE_MS);
  }, []);

  const detachAll = useCallback(() => {
    devicesUnsubRef.current?.();
    roomUnsubRef.current?.();
    pipeUnsubsRef.current.forEach((u) => u());
    pipeUnsubsRef.current = [];
    alertsUnsubRef.current?.();
    devicesUnsubRef.current = null;
    roomUnsubRef.current = null;
    alertsUnsubRef.current = null;
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }
  }, []);

  const attachAll = useCallback(() => {
    console.log("[RT] attaching listeners");
    const devicesRef = ref(rtdb, "Devices");

    devicesUnsubRef.current = onValue(
      devicesRef,
      (snap) => {
        const devicesVal = snap.val() || {};
        const roomKeys = Object.keys(devicesVal);
        setRooms(roomKeys);

        let chosen = activeRoom && roomKeys.includes(activeRoom) ? activeRoom : null;
        if (!chosen && roomKeys.length > 0) chosen = roomKeys[0];
        setActiveRoom(chosen);

        // if no rooms, clear
        if (!chosen) {
          setPipes([]);
          latestMapRef.current = {};
          setReadings([]);
          return;
        }

        // room listener
        const roomRef = ref(rtdb, `Devices/${chosen}`);
        roomUnsubRef.current?.();
        roomUnsubRef.current = onValue(
          roomRef,
          (roomSnap) => {
            const roomVal = roomSnap.val() || {};
            const pipeKeys = Object.keys(roomVal);
            setPipes(pipeKeys);

            // clear old per-pipe
            pipeUnsubsRef.current.forEach((u) => u());
            pipeUnsubsRef.current = [];

            if (pipeKeys.length === 0) {
              latestMapRef.current = {};
              setReadings([]);
              return;
            }

            pipeKeys.forEach((pipeKey) => {
              const latestRef = ref(rtdb, `Devices/${chosen}/${pipeKey}/Latest`);
              const u = onValue(
                latestRef,
                (lsnap) => {
                  const v = lsnap.val();
                  if (!v) return;

                  const item: Reading = {
                    id: `${chosen}/${pipeKey}`,
                    t_ms: Number(v.t_ms ?? 0),
                    flow_Lmin: Number(v.flow_Lmin ?? 0),
                    temp_C: Number(v.temp_C ?? 0),
                    pressure_psi: Number(v.pressure_psi ?? 0),
                    ts_server_ms: Number(v.ts_server_ms ?? Date.now()),
                  };

                  // store in map and flush on throttle
                  latestMapRef.current[item.id] = item;
                  flushThrottled();
                },
                (err) => {
                  console.warn(`[RT] Latest error @ ${chosen}/${pipeKey}:`, err?.message);
                  setLastError(`Latest ${chosen}/${pipeKey}: ${err?.message ?? "unknown"}`);
                }
              );
              pipeUnsubsRef.current.push(u);
            });
          },
          (err) => {
            console.warn("[RT] room error:", err?.message);
            setLastError(`Room: ${err?.message ?? "unknown"}`);
          }
        );
      },
      (err) => {
        console.warn("[RT] devices error:", err?.message);
        setLastError(`Devices: ${err?.message ?? "unknown"}`);
      }
    );

    // Alerts
    alertsUnsubRef.current?.();
    alertsUnsubRef.current = subscribeAlerts(activeRoom ?? "Room1", (rows) => setAlerts(rows));
  }, [activeRoom, flushThrottled]);

  // First mount
  useEffect(() => {
    attachAll();
    return () => {
      console.log("[RT] unmount → detachAll");
      detachAll();
    };
  }, [attachAll, detachAll]);

  // ====== Pull-to-refresh: full reset and reattach ======
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // full reset state & listeners
    detachAll();
    latestMapRef.current = {};
    setReadings([]);
    setAlerts([]);
    setLastError(null);
    // small delay to ensure old listeners are detached
    setTimeout(() => {
      attachAll();
      // stop spinner after first flush or a short timeout
      setTimeout(() => setRefreshing(false), 500);
    }, 50);
  }, [attachAll, detachAll]);

  // ====== UI ======
  const renderDashboard = () => {
    if (readings.length === 0) {
      return (
        <View style={styles.dashboard}>
          <Text style={{ color: "gray" }}>No data yet</Text>
        </View>
      );
    }

    const flows = readings.map((r) => r.flow_Lmin || 0);
    const temps = readings.map((r) => r.temp_C || 0);
    const pressures = readings.map((r) => r.pressure_psi || 0);
    const avgFlow = flows.reduce((a, b) => a + b, 0) / (flows.length || 1);
    const maxPressure = Math.max(...pressures);
    const avgTemp = temps.reduce((a, b) => a + b, 0) / (temps.length || 1);
    

    return (
      <View style={styles.dashboard}>
        <View style={styles.card}>
          <Text style={styles.cardTitleCenter}>Avg Flow</Text>
          <Text style={styles.cardValue}>{avgFlow.toFixed(1)} L/m</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitleCenter}>Avg Temp</Text>
          <Text style={styles.cardValue}>{avgTemp.toFixed(1)} °C</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitleCenter}>Max Pressure</Text>
          <Text style={styles.cardValue}>{maxPressure.toFixed(1)} PSI</Text>
        </View>
        
        <View style={styles.card}>
          <Text style={styles.cardTitleCenter}>Critical Alerts</Text>
          <Text style={styles.cardValue}>{alerts.length}</Text>
        </View>
      </View>
    );
  };

  const renderLogs = () => {
    const recent = [...readings].sort((a, b) => a.id.localeCompare(b.id));
    const flowStats = getStats(recent.map((r) => r.flow_Lmin));
    const pressureStats = getStats(recent.map((r) => r.pressure_psi));
    const tempStats = getStats(recent.map((r) => r.temp_C));
    return (
      <View style={styles.dataContainer}>
        <Text style={styles.sectionTitle}>Latest by Pipe</Text>
        {recent.length === 0 ? (
          <Text style={styles.empty}>No logs yet.</Text>
        ) : (
          <>
            {recent.map((r) => (
              <View key={r.id} style={styles.logItem}>
                <Text style={styles.logText} selectable>{r.id}</Text>
                <Text style={styles.logText}>Flow: {r.flow_Lmin ?? "N/A"} L/min</Text>
                <Text style={styles.logText}>Pressure: {r.pressure_psi ?? "N/A"} PSI</Text>
                <Text style={styles.logText}>Temp: {r.temp_C ?? "N/A"} °C</Text>
                <Text style={styles.timestamp}>{formatTimeWithMs(r.ts_server_ms)}</Text>
              </View>
            ))}
            <View style={styles.logItem}>
              <Text style={{ color: "#0bfffe", fontWeight: "bold", marginBottom: 10 }}>Summary</Text>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Min</Text>
                <Text style={styles.statValue}>{flowStats.min}</Text>
                <Text style={styles.statValue}>{pressureStats.min}</Text>
                <Text style={styles.statValue}>{tempStats.min}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Max</Text>
                <Text style={styles.statValue}>{flowStats.max}</Text>
                <Text style={styles.statValue}>{pressureStats.max}</Text>
                <Text style={styles.statValue}>{tempStats.max}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Avg</Text>
                <Text style={styles.statValue}>{flowStats.avg}</Text>
                <Text style={styles.statValue}>{pressureStats.avg}</Text>
                <Text style={styles.statValue}>{tempStats.avg}</Text>
              </View>
            </View>
          </>
        )}
      </View>
    );
  };

  const renderDebug = () => (
    <View style={styles.debugBox}>
      <Text style={styles.debugTitle}>Debug</Text>
      <Text style={styles.debugLine}>Rooms: {rooms.length ? rooms.join(", ") : "(none)"}</Text>
      <Text style={styles.debugLine}>
        Active Room: {activeRoom ?? "(none selected)"} | Pipes: {pipes.length ? pipes.join(", ") : "(none)"}
      </Text>
      <Text style={styles.debugLine}>Readings: {readings.length}</Text>
      <Text style={[styles.debugLine, { color: lastError ? "#ff8080" : "#9acd32" }]}>
        Status: {lastError ? lastError : "OK"}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#111" }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <TouchableOpacity style={{ margin: 10, flexDirection: "row", alignItems: "center" }} onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={25} color="#fff" />
        </TouchableOpacity>

        <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 16, marginTop: 10 }}>
          <Text style={{ color: "#fff", fontSize: 24, fontWeight: "bold" }}>Real-Time Data</Text>
        </View>

        {renderDashboard()}
        {renderLogs()}
        {renderDebug()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  dashboard: { flexDirection: "row", justifyContent: "space-around", marginVertical: 20 },
  card: {
    backgroundColor: "#1f1f1f", padding: 18, borderRadius: 16, alignItems: "center",
    width: 110, shadowColor: "#000", shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6, elevation: 6,
  },
  cardValue: { color: "#0bfffe", fontSize: 22, fontWeight: "bold", marginTop: 5 },
  cardTitleCenter: { color: "gray", fontSize: 13, textAlign: "center" },
  dataContainer: { backgroundColor: "#181818", borderRadius: 10, padding: 16, margin: 10 },
  sectionTitle: {
    fontSize: 20, color: "#0bfffe", marginBottom: 12, fontWeight: "bold",
    borderBottomWidth: 2, borderBottomColor: "#0bfffe", paddingBottom: 4,
  },
  empty: { color: "#888", fontStyle: "italic", textAlign: "center", marginVertical: 20 },
  logItem: {
    backgroundColor: "#1c1c1c", padding: 14, borderRadius: 12, marginBottom: 10,
    borderLeftWidth: 4, borderLeftColor: "#0bfffe",
  },
  logText: { color: "white", fontSize: 15, marginBottom: 2 },
  timestamp: { color: "#999", fontSize: 12, marginTop: 5 },
  statRow: { flexDirection: "row", justifyContent: "space-between", marginVertical: 2 },
  statLabel: { color: "#aaa", fontWeight: "bold", width: 50 },
  statValue: { color: "#fff", width: 60, textAlign: "center" },
  debugBox: { margin: 10, backgroundColor: "#121826", borderRadius: 10, padding: 12 },
  debugTitle: { color: "#0bfffe", fontWeight: "bold", marginBottom: 6 },
  debugLine: { color: "#bbb", fontSize: 12, marginBottom: 2 },
});
