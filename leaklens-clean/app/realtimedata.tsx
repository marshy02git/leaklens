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
  Easing,
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { subscribeReadings, subscribeAlerts } from "../firebase/db";

function getStats(values: (number | undefined)[]) {
  const nums = values.filter((v): v is number => typeof v === "number" && !isNaN(v));
  if (nums.length === 0)
    return { min: "-", max: "-", avg: "-", current: "-" };
  const avg = (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1);
  return {
    current: nums[nums.length - 1].toFixed(1),
    min: Math.min(...nums).toFixed(1),
    max: Math.max(...nums).toFixed(1),
    avg,
  };
}

type Reading = {
  id: string;
  t_ms: number;
  flow_Lmin: number;
  temp_C: number;
  pressure_psi: number;
  ts_server_ms: number;
};

export default function RealTimeDataScreen() {
  const router = useRouter();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Pulse animation for LIVE badge
  

  // Subscribe to RTDB readings + alerts
  useEffect(() => {
    const unsubReadings = subscribeReadings("LL-001", (rows) => setReadings(rows));
    const unsubAlerts = subscribeAlerts("LL-001", (rows) => setAlerts(rows));
    return () => {
      unsubReadings();
      unsubAlerts();
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  // Dashboard summary
  const renderDashboard = () => {
    if (readings.length === 0) {
      return (
        <View style={styles.dashboard}>
          <Text style={{ color: "gray" }}>No data yet</Text>
        </View>
      );
    }

    const flows = readings.map((r) => r.flow_Lmin || 0);
    const pressures = readings.map((r) => r.pressure_psi || 0);

    const avgFlow = flows.reduce((a, b) => a + b, 0) / (flows.length || 1);
    const maxPressure = Math.max(...pressures);

    return (
      <View style={styles.dashboard}>
        <View style={styles.card}>
          <Text style={styles.cardTitleCenter}>Avg Flow</Text>
          <Text style={styles.cardValue}>{avgFlow.toFixed(1)} L/m</Text>
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

  // Logs section
  const renderLogs = () => {
    const recent = readings.slice(-10); // last 10 entries
    const flowStats = getStats(recent.map((r) => r.flow_Lmin));
    const pressureStats = getStats(recent.map((r) => r.pressure_psi));
    const tempStats = getStats(recent.map((r) => r.temp_C));

    return (
      <View style={styles.dataContainer}>
        <Text style={styles.sectionTitle}>Latest Logs</Text>
        {recent.length === 0 ? (
          <Text style={styles.empty}>No logs yet.</Text>
        ) : (
          <>
            {recent.map((r) => (
              <View key={r.id} style={styles.logItem}>
                <Text style={styles.logText}>
                  Flow: {r.flow_Lmin ?? "N/A"} L/min
                </Text>
                <Text style={styles.logText}>
                  Pressure: {r.pressure_psi ?? "N/A"} PSI
                </Text>
                <Text style={styles.logText}>
                  Temp: {r.temp_C ?? "N/A"} °C
                </Text>
                <Text style={styles.timestamp}>
                  {r.ts_server_ms
                    ? new Date(r.ts_server_ms).toLocaleTimeString()
                    : "No timestamp"}
                </Text>
              </View>
            ))}

            {/* Summary */}
            <View style={styles.logItem}>
              <Text
                style={{
                  color: "#0bfffe",
                  fontWeight: "bold",
                  marginBottom: 10,
                }}
              >
                Summary
              </Text>
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#111" }}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Back Button */}
        <TouchableOpacity
          style={{ margin: 10, flexDirection: "row", alignItems: "center" }}
          onPress={() => router.back()}
        >
          <FontAwesome name="arrow-left" size={20} color="#0bfffe" />
          <Text style={{ color: "#0bfffe", marginLeft: 8 }}>Back</Text>
        </TouchableOpacity>

        {/* Title + Live Badge */}
        <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 16, marginTop: 10 }}>
          <Text style={{ color: "#fff", fontSize: 24, fontWeight: "bold" }}>
            Real-Time Data
          </Text>
          <Animated.View
            style={[
              styles.liveBadge,
            ]}
          >
            <Text style={styles.liveText}>LIVE</Text>
          </Animated.View>
        </View>

        {/* Dashboard + Logs */}
        {renderDashboard()}
        {renderLogs()}
      </ScrollView>
    </SafeAreaView>
  );
}

// Define styles
const styles = StyleSheet.create({
  dashboard: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 20,
  },
  card: {
    backgroundColor: "#1f1f1f",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    width: 110,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 6,
  },
  cardValue: {
    color: "#0bfffe",
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 5,
  },
  cardTitleCenter: { color: "gray", fontSize: 13, textAlign: "center" },

  dataContainer: {
    backgroundColor: "#181818",
    borderRadius: 10,
    padding: 16,
    margin: 10,
  },
  sectionTitle: {
    fontSize: 20,
    color: "#0bfffe",
    marginBottom: 12,
    fontWeight: "bold",
    borderBottomWidth: 2,
    borderBottomColor: "#0bfffe",
    paddingBottom: 4,
  },

  empty: {
    color: "#888",
    fontStyle: "italic",
    textAlign: "center",
    marginVertical: 20,
  },
  logItem: {
    backgroundColor: "#1c1c1c",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#0bfffe",
  },
  logText: { color: "white", fontSize: 15, marginBottom: 2 },
  timestamp: { color: "#999", fontSize: 12, marginTop: 5 },

  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 2,
  },
  statLabel: {
    color: "#aaa",
    fontWeight: "bold",
    width: 50,
  },
  statValue: {
    color: "#fff",
    width: 60,
    textAlign: "center",
  },

  liveBadge: {
    marginLeft: 10,
    backgroundColor: "#ff1744",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignSelf: "center",
  },
  liveText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 12,
  },
});
