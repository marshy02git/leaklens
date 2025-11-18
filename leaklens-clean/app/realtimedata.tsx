// app/realtimedata.tsx
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  LayoutAnimation,
  UIManager,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { FontAwesome } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { rtdb } from "../firebase/config";
import { ref, onValue, off, query, limitToLast } from "firebase/database";
import { subscribeAlerts } from "../firebase/db";
import Svg, { Path, Line } from "react-native-svg";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ---------- Types ---------- */
type LatestReading = {
  t_ms?: number;
  flow_Lmin?: number;
  temp_C?: number;
  pressure_psi?: number;
  ts_server_ms?: number;
};

type HistoryPoint = {
  ts_key: string; // DB key (iso-ish string)
  t_ms?: number;
  flow_Lmin?: number;
  temp_C?: number;
  pressure_psi?: number;
};

type PipeState = {
  latest?: LatestReading;
  history: HistoryPoint[];
  stats: { min: LatestReading; max: LatestReading; avg: LatestReading };
  expanded: boolean;
};

type RoomState = {
  pipes: string[];
  map: Record<string, PipeState>;
};

const MAX_POINTS = 120;

/* ---------- Helpers ---------- */
const num = (v: any, d = undefined) =>
  typeof v === "number" && !Number.isNaN(v) ? v : d;

const calcStats = (history: HistoryPoint[]) => {
  const pick = (k: keyof HistoryPoint) =>
    history
      .map((p) => num(p[k], NaN))
      .filter((x) => Number.isFinite(x)) as number[];

  const safeMin = (a: number[]) => (a.length ? Math.min(...a) : undefined);
  const safeMax = (a: number[]) => (a.length ? Math.max(...a) : undefined);
  const safeAvg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : undefined);

  const flows = pick("flow_Lmin");
  const temps = pick("temp_C");
  const press = pick("pressure_psi");

  return {
    min: { flow_Lmin: safeMin(flows), temp_C: safeMin(temps), pressure_psi: safeMin(press) },
    max: { flow_Lmin: safeMax(flows), temp_C: safeMax(temps), pressure_psi: safeMax(press) },
    avg: { flow_Lmin: safeAvg(flows), temp_C: safeAvg(temps), pressure_psi: safeAvg(press) },
  } as PipeState["stats"];
};

const fmt = (v?: number, unit = "", digits = 1) =>
  typeof v === "number" && Number.isFinite(v) ? `${v.toFixed(digits)}${unit}` : "—";

const formatTimeWithMs = (ms?: number) => {
  if (!ms) return "—";
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
    const z = (n: number, w = 2) => String(n).padStart(w, "0");
    return `${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}.${z(
      d.getMilliseconds(),
      3
    )}`;
  }
};

/* ---------- Tiny Sparkline ---------- */
function Sparkline({
  data,
  accessor,
  width = 180,
  height = 48,
  strokeWidth = 2,
}: {
  data: HistoryPoint[];
  accessor: (p: HistoryPoint) => number | undefined;
  width?: number;
  height?: number;
  strokeWidth?: number;
}) {
  const vals = data
    .map(accessor)
    .map((v) => (typeof v === "number" && Number.isFinite(v) ? v : undefined));

  const valid = vals.filter((v) => typeof v === "number") as number[];
  if (valid.length < 2) {
    return (
      <View style={{ height, justifyContent: "center" }}>
        <Text style={{ color: "#888", fontSize: 12 }}>No data</Text>
      </View>
    );
  }
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const span = Math.max(1e-6, max - min);
  const stepX = vals.length > 1 ? width / (vals.length - 1) : width;

  let d = "";
  vals.forEach((y, i) => {
    if (typeof y !== "number") return;
    const X = i * stepX;
    const Y = height - ((y - min) / span) * height;
    d += (d ? " L " : "M ") + `${X} ${Y}`;
  });

  return (
    <Svg width={width} height={height}>
      <Line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="#2a2a2a" strokeWidth={1} />
      <Path d={d} stroke="#0bfffe" strokeWidth={strokeWidth} fill="none" />
    </Svg>
  );
}

/* ---------- Screen ---------- */
export default function RealTimeDataScreen() {
  const router = useRouter();

  const [room, setRoom] = useState<string | null>(null);
  const [alertsCount, setAlertsCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [roomState, setRoomState] = useState<RoomState>({ pipes: [], map: {} });

  // Unsubs
  const devicesUnsubRef = useRef<null | (() => void)>(null);
  const roomUnsubRef = useRef<null | (() => void)>(null);
  const latestUnsubsRef = useRef<Record<string, () => void>>({});
  const historyUnsubsRef = useRef<Record<string, () => void>>({});
  const alertsUnsubRef = useRef<null | (() => void)>(null);

  // ---- navigation helper (moved INSIDE component) ----
  const goToPipe = useCallback(
    (pipeKey: string) => {
      router.push({
        pathname: "/pipe/[pipe]",
        params: { pipe: pipeKey, room: room ?? "Room1" },
      } as never);
    },
    [router, room]
  );

  const detachAll = useCallback(() => {
    devicesUnsubRef.current?.();
    roomUnsubRef.current?.();
    Object.values(latestUnsubsRef.current).forEach((u) => u());
    Object.values(historyUnsubsRef.current).forEach((u) => u());
    alertsUnsubRef.current?.();

    devicesUnsubRef.current = null;
    roomUnsubRef.current = null;
    latestUnsubsRef.current = {};
    historyUnsubsRef.current = {};
    alertsUnsubRef.current = null;
  }, []);

  const attachAll = useCallback(() => {
    const devicesRef = ref(rtdb, "Devices");
    devicesUnsubRef.current = onValue(
      devicesRef,
      (snap) => {
        const devicesVal = snap.val() || {};
        const rooms = Object.keys(devicesVal);
        const chosen = room && rooms.includes(room) ? room : rooms[0] ?? null;
        setRoom(chosen);

        if (!chosen) {
          setRoomState({ pipes: [], map: {} });
          return;
        }

        const chosenRef = ref(rtdb, `Devices/${chosen}`);
        roomUnsubRef.current?.();
        roomUnsubRef.current = onValue(
          chosenRef,
          (rsnap) => {
            const roomVal = rsnap.val() || {};
            const pipeKeys = Object.keys(roomVal);

            // Unsubscribe removed pipes
            Object.keys(latestUnsubsRef.current).forEach((k) => {
              if (!pipeKeys.includes(k)) {
                latestUnsubsRef.current[k]?.();
                delete latestUnsubsRef.current[k];
              }
            });
            Object.keys(historyUnsubsRef.current).forEach((k) => {
              if (!pipeKeys.includes(k)) {
                historyUnsubsRef.current[k]?.();
                delete historyUnsubsRef.current[k];
              }
            });

            setRoomState((prev) => {
              const next: RoomState = { pipes: pipeKeys, map: { ...prev.map } };
              pipeKeys.forEach((k) => {
                if (!next.map[k]) {
                  next.map[k] = {
                    latest: undefined,
                    history: [],
                    stats: { min: {}, max: {}, avg: {} } as any,
                    expanded: false,
                  };
                }
              });
              return next;
            });

            // Attach per-pipe listeners
            pipeKeys.forEach((pipeKey) => {
              if (!latestUnsubsRef.current[pipeKey]) {
                const latestRef = ref(rtdb, `Devices/${chosen}/${pipeKey}/Latest`);
                const u = onValue(
                  latestRef,
                  (lsnap) => {
                    const v = (lsnap.val() || {}) as LatestReading;
                    setRoomState((prev) => {
                      const cur = prev.map[pipeKey] ?? {
                        history: [],
                        stats: { min: {}, max: {}, avg: {} } as any,
                        expanded: false,
                      };
                      const map = { ...prev.map, [pipeKey]: { ...cur, latest: v } };
                      return { pipes: prev.pipes, map };
                    });
                  },
                  (err) => setError(`Latest ${pipeKey}: ${err?.message ?? "unknown"}`)
                );
                latestUnsubsRef.current[pipeKey] = () => off(latestRef, "value", u);
              }

              if (!historyUnsubsRef.current[pipeKey]) {
                const readingsQ = query(
                  ref(rtdb, `Devices/${chosen}/${pipeKey}/Readings`),
                  limitToLast(MAX_POINTS)
                );
                const u = onValue(
                  readingsQ,
                  (hsnap) => {
                    const val = hsnap.val() || {};
                    const points: HistoryPoint[] = Object.keys(val)
                      .sort()
                      .map((k) => ({ ts_key: k, ...(val[k] || {}) }));

                    const stats = calcStats(points);
                    setRoomState((prev) => {
                      const cur = prev.map[pipeKey] ?? {
                        latest: undefined,
                        history: [],
                        stats: { min: {}, max: {}, avg: {} } as any,
                        expanded: false,
                      };
                      const map = { ...prev.map, [pipeKey]: { ...cur, history: points, stats } };
                      return { pipes: prev.pipes, map };
                    });
                  },
                  (err) => setError(`Readings ${pipeKey}: ${err?.message ?? "unknown"}`)
                );
                historyUnsubsRef.current[pipeKey] = () => off(readingsQ, "value", u);
              }
            });
          },
          (err) => setError(`Room: ${err?.message ?? "unknown"}`)
        );
      },
      (err) => setError(`Devices: ${err?.message ?? "unknown"}`)
    );

    // Alerts (dashboard count)
    alertsUnsubRef.current?.();
    alertsUnsubRef.current = subscribeAlerts(room ?? "Room1", (rows) => setAlertsCount(rows.length));
  }, [room]);

  // Focus attach/detach
  useFocusEffect(
    useCallback(() => {
      attachAll();
      return () => detachAll();
    }, [attachAll, detachAll])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    detachAll();
    setTimeout(() => {
      attachAll();
      setTimeout(() => setRefreshing(false), 400);
    }, 50);
  }, [attachAll, detachAll]);

  const toggleExpanded = useCallback((pipeKey: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRoomState((prev) => {
      const cur = prev.map[pipeKey];
      if (!cur) return prev;
      return {
        pipes: prev.pipes,
        map: {
          ...prev.map,
          [pipeKey]: { ...cur, expanded: !cur.expanded },
        },
      };
    });
  }, []);

  /* ---------- UI ---------- */
  const renderPipeCard = (pipeKey: string) => {
    const ps = roomState.map[pipeKey];
    const lt = ps?.latest;
    const st = ps?.stats;

    return (
      <View key={pipeKey} style={styles.cardWrap}>
        {/* Header row navigates to detail */}
        <TouchableOpacity style={styles.cardHead} onPress={() => goToPipe(pipeKey)}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <FontAwesome name="tint" size={16} color="#0bfffe" />
            <Text style={styles.cardHeadTitle}>{pipeKey}</Text>
          </View>
          <FontAwesome name="chevron-right" size={16} color="#aaa" />
        </TouchableOpacity>

        {/* Latest snapshot */}
        <View style={styles.latestRow}>
          <Text style={styles.latestItem}>Flow: {fmt(num(lt?.flow_Lmin), " L/min")}</Text>
          <Text style={styles.latestItem}>Temp: {fmt(num(lt?.temp_C), " °C")}</Text>
          <Text style={styles.latestItem}>Pressure: {fmt(num(lt?.pressure_psi), " PSI")}</Text>
        </View>
        <Text style={styles.latestTs}>
          Updated: {formatTimeWithMs(num(lt?.ts_server_ms) ?? Date.now())}
        </Text>

        {/* Collapsed preview */}
        {!ps?.expanded && (
          <View style={styles.previewRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.previewStat}>
                Min {fmt(num(st?.min.flow_Lmin), " L/m")} • Avg {fmt(num(st?.avg.flow_Lmin), " L/m")} • Max {fmt(num(st?.max.flow_Lmin), " L/m")}
              </Text>
            </View>
            <Sparkline data={ps?.history ?? []} accessor={(p) => p.flow_Lmin} width={140} height={40} />
          </View>
        )}

        {/* Expanded content */}
        {ps?.expanded && (
          <View style={styles.expandedBox}>
            <Text style={styles.sectionLabel}>Flow (last {Math.min(ps.history.length, MAX_POINTS)} pts)</Text>
            <Sparkline data={ps.history} accessor={(p) => p.flow_Lmin} width={260} height={64} />

            <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Pressure</Text>
            <Sparkline data={ps.history} accessor={(p) => p.pressure_psi} width={260} height={64} />

            <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Temperature</Text>
            <Sparkline data={ps.history} accessor={(p) => p.temp_C} width={260} height={64} />

            <View style={styles.statsTable}>
              <View style={styles.statsRow}>
                <Text style={styles.statsCellHead}>Metric</Text>
                <Text style={styles.statsCellHead}>Min</Text>
                <Text style={styles.statsCellHead}>Avg</Text>
                <Text style={styles.statsCellHead}>Max</Text>
              </View>
              <View style={styles.statsRow}>
                <Text style={styles.statsCellKey}>Flow</Text>
                <Text style={styles.statsCell}>{fmt(num(st?.min.flow_Lmin), " L/m")}</Text>
                <Text style={styles.statsCell}>{fmt(num(st?.avg.flow_Lmin), " L/m")}</Text>
                <Text style={styles.statsCell}>{fmt(num(st?.max.flow_Lmin), " L/m")}</Text>
              </View>
              <View style={styles.statsRow}>
                <Text style={styles.statsCellKey}>Temp</Text>
                <Text style={styles.statsCell}>{fmt(num(st?.min.temp_C), " °C")}</Text>
                <Text style={styles.statsCell}>{fmt(num(st?.avg.temp_C), " °C")}</Text>
                <Text style={styles.statsCell}>{fmt(num(st?.max.temp_C), " °C")}</Text>
              </View>
              <View style={styles.statsRow}>
                <Text style={styles.statsCellKey}>Pressure</Text>
                <Text style={styles.statsCell}>{fmt(num(st?.min.pressure_psi), " PSI")}</Text>
                <Text style={styles.statsCell}>{fmt(num(st?.avg.pressure_psi), " PSI")}</Text>
                <Text style={styles.statsCell}>{fmt(num(st?.max.pressure_psi), " PSI")}</Text>
              </View>
            </View>

            <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Recent Log</Text>
            {(ps.history.slice(-12) || []).map((p) => (
              <View key={p.ts_key} style={styles.logRow}>
                <Text style={styles.logText}>{p.ts_key.replace(/T/, " ").replace(/_/g, ":")}</Text>
                <Text style={styles.logTextSm}>
                  F:{fmt(num(p.flow_Lmin), "", 2)}  P:{fmt(num(p.pressure_psi), "", 1)}  T:{fmt(num(p.temp_C), "", 1)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const dashboard = useMemo(() => {
    const all = roomState.pipes.flatMap((k) =>
      roomState.map[k]?.latest ? [roomState.map[k]!.latest!] : []
    );
    if (all.length === 0) return null;
    const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    const flows = all.map((x) => num(x.flow_Lmin, 0) as number);
    const temps = all.map((x) => num(x.temp_C, 0) as number);
    const press = all.map((x) => num(x.pressure_psi, 0) as number);

    return (
      <View style={styles.dashboard}>
        <View style={styles.card}>
          <Text style={styles.cardTitleCenter}>Avg Flow</Text>
          <Text style={styles.cardValue}>{fmt(avg(flows), " L/m")}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitleCenter}>Avg Temp</Text>
          <Text style={styles.cardValue}>{fmt(avg(temps), " °C")}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitleCenter}>Max Pressure</Text>
          <Text style={styles.cardValue}>{fmt(Math.max(0, ...press), " PSI")}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitleCenter}>Critical Alerts</Text>
          <Text style={styles.cardValue}>{alertsCount}</Text>
        </View>
      </View>
    );
  }, [roomState, alertsCount]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#111" }}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => {
                detachAll();
                router.back();
              }}
              style={{ padding: 6, marginRight: 8 }}
            >
              <FontAwesome name="arrow-left" size={20} color="#0bfffe" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Real-Time Data</Text>
          </View>
          {room ? <Text style={styles.roomPill}>{room}</Text> : <View />}
        </View>

        {/* Dashboard */}
        {dashboard ?? (
          <View style={{ alignItems: "center", marginVertical: 24 }}>
            <Text style={{ color: "gray" }}>No data yet</Text>
          </View>
        )}

        {/* Pipes list */}
        <View style={{ paddingHorizontal: 12, paddingBottom: 24 }}>
          <Text style={styles.sectionTitle}>Pipes</Text>
          {roomState.pipes.length === 0 ? (
            <Text style={{ color: "#888", marginLeft: 4 }}>No pipes found.</Text>
          ) : (
            roomState.pipes.map(renderPipeCard)
          )}
        </View>

        {/* Error */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={{ color: "#ff9ca0" }}>{error}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 10,
  },
  headerTitle: { color: "#fff", fontSize: 24, fontWeight: "bold" },
  roomPill: {
    color: "#0bfffe",
    borderColor: "#0bfffe",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
  },

  dashboard: { flexDirection: "row", justifyContent: "space-around", marginVertical: 20 },
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
  cardValue: { color: "#0bfffe", fontSize: 22, fontWeight: "bold", marginTop: 5 },
  cardTitleCenter: { color: "gray", fontSize: 13, textAlign: "center" },

  sectionTitle: {
    fontSize: 18,
    color: "#0bfffe",
    marginVertical: 8,
    fontWeight: "bold",
    borderBottomWidth: 2,
    borderBottomColor: "#0bfffe",
    paddingBottom: 4,
    marginHorizontal: 4,
  },

  cardWrap: {
    backgroundColor: "#181818",
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardHeadTitle: { color: "#fff", fontSize: 16, fontWeight: "bold", marginLeft: 8 },

  latestRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  latestItem: { color: "#ddd", fontSize: 13 },
  latestTs: { color: "#999", fontSize: 11, marginBottom: 6 },

  previewRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  previewStat: { color: "#bbb", fontSize: 12, marginRight: 10 },

  expandedBox: { backgroundColor: "#151515", borderRadius: 10, padding: 10, marginTop: 10 },
  sectionLabel: { color: "#aaa", fontSize: 12, marginBottom: 6 },

  statsTable: { marginTop: 8, borderTopWidth: 1, borderTopColor: "#2a2a2a" },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
    paddingVertical: 6,
  },
  statsCellHead: { color: "#eee", fontWeight: "bold", flex: 1, textAlign: "center", fontSize: 12 },
  statsCellKey: { color: "#ccc", flex: 1, fontSize: 12 },
  statsCell: { color: "#fff", flex: 1, textAlign: "center", fontSize: 12 },

  logRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#1c1c1c",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginTop: 6,
  },
  logText: { color: "#ddd", fontSize: 12 },
  logTextSm: { color: "#aaa", fontSize: 12 },

  errorBox: {
    backgroundColor: "#2a1214",
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 12,
    marginBottom: 24,
  },
});
