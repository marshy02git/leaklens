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
import { ref, onValue, off, query, limitToLast, push, set } from "firebase/database";
import { subscribeAlerts } from "../firebase/db";
import Svg, { Path, Line } from "react-native-svg";

// ---------- Fixed selection ----------
const ROOMS = ["Room6", "Room4", "Room1"] as const;
const PIPE_FILTER = "Pipe2";

// ---------- Thresholds (HIGH + LOW) ----------
const FLOW_CRITICAL_LMIN = 11.0;   // High flow
const PRESS_CRITICAL_PSI = 3.0;    // High pressure
const TEMP_CRITICAL_C = 30.0;      // High temperature

const FLOW_MIN_LMIN = 7;         // Low flow
const PRESS_MIN_PSI = 0.8;         // Low pressure
const TEMP_MIN_C = 24;            // Low temp

// UI colors
const COLOR_HIGH = "#ff4d4d";      // Red
const COLOR_LOW = "#ffff66";       // Yellow
const COLOR_NORMAL = "#00ff66";    // Green

// Background tints
const BG_TINT_HIGH = "#331010";
const BG_TINT_LOW = "#332f10";
const BG_TINT_NORMAL = "#181818";

// Cooldown between auto alerts
const ALERT_COOLDOWN_MS = 2 * 60 * 1000;

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
  ts_key: string;
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

type RoomsBundleState = Record<string, RoomState>;

type AlertLevel = "info" | "critical";

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
  const safeAvg = (a: number[]) =>
    a.length ? a.reduce((x, y) => x + y, 0) / a.length : undefined;

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

/** Determine alert severity based on thresholds */
const computeSeverity = (r?: LatestReading): AlertLevel => {
  if (!r) return "info";

  const flow = num(r.flow_Lmin, 0) as number;
  const press = num(r.pressure_psi, 0) as number;
  const temp = num(r.temp_C, 0) as number;

  // High faults
  if (
    flow > FLOW_CRITICAL_LMIN ||
    press > PRESS_CRITICAL_PSI ||
    temp > TEMP_CRITICAL_C
  ) {
    return "critical";
  }

  // Low faults
  if (
    flow < FLOW_MIN_LMIN ||
    press < PRESS_MIN_PSI ||
    temp < TEMP_MIN_C
  ) {
    return "critical";
  }

  return "info";
};

/** Build human-readable alert description */
const buildCriticalMessage = (r: LatestReading): string => {
  const parts: string[] = [];

  if (typeof r.flow_Lmin === "number") {
    if (r.flow_Lmin > FLOW_CRITICAL_LMIN)
      parts.push(`High flow ${r.flow_Lmin.toFixed(2)} L/min`);
    else if (r.flow_Lmin < FLOW_MIN_LMIN)
      parts.push(`Low flow ${r.flow_Lmin.toFixed(2)} L/min`);
  }

  if (typeof r.pressure_psi === "number") {
    if (r.pressure_psi > PRESS_CRITICAL_PSI)
      parts.push(`High pressure ${r.pressure_psi.toFixed(2)} PSI`);
    else if (r.pressure_psi < PRESS_MIN_PSI)
      parts.push(`Low pressure ${r.pressure_psi.toFixed(2)} PSI`);
  }

  if (typeof r.temp_C === "number") {
    if (r.temp_C > TEMP_CRITICAL_C)
      parts.push(`High temp ${r.temp_C.toFixed(1)} °C`);
    else if (r.temp_C < TEMP_MIN_C)
      parts.push(`Low temp ${r.temp_C.toFixed(1)} °C`);
  }

  return parts.join(", ") || "Critical condition detected";
};

/** Write a new critical alert to RTDB */
const writeCriticalAlert = (roomName: string, pipeKey: string, reading: LatestReading) => {
  const alertsRoot = ref(rtdb, `Alerts/${roomName}`);
  const newRef = push(alertsRoot);
  const now = Date.now();
  return set(newRef, {
    level: "critical",
    message: buildCriticalMessage(reading),
    room: roomName,
    pipe: pipeKey,
    ts_server_ms: now,
  });
};

/* ---------- Sparkline with Threshold Lines (auto-scaled) ---------- */
function Sparkline({
  data,
  accessor,
  width = 180,
  height = 48,
  strokeWidth = 2,
  minThreshold,
  maxThreshold
}: {
  data: HistoryPoint[];
  accessor: (p: HistoryPoint) => number | undefined;
  width?: number;
  height?: number;
  strokeWidth?: number;

  // NEW: thresholds
  minThreshold: number;
  maxThreshold: number;
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

  // Build sparkline path
  let d = "";
  vals.forEach((y, i) => {
    if (typeof y !== "number") return;
    const X = i * stepX;
    const Y = height - ((y - min) / span) * height;
    d += (d ? " L " : "M ") + `${X} ${Y}`;
  });

  // Compute threshold line positions (auto-scaled)
  const clampThreshold = (t: number) => {
    // Convert threshold to Y position
    return height - ((t - min) / span) * height;
  };

  const yMinLine = clampThreshold(minThreshold);
  const yMaxLine = clampThreshold(maxThreshold);

  return (
    <Svg width={width} height={height}>
      {/* Neutral gray threshold lines */}
      <Line
        x1={0} x2={width}
        y1={yMinLine} y2={yMinLine}
        stroke="#777"
        strokeDasharray="4 4"
        strokeWidth={1}
      />
      <Line
        x1={0} x2={width}
        y1={yMaxLine} y2={yMaxLine}
        stroke="#777"
        strokeDasharray="4 4"
        strokeWidth={1}
      />

      {/* Sparkline */}
      <Path d={d} stroke="#0bfffe" strokeWidth={strokeWidth} fill="none" />
    </Svg>
  );
}
/* ---------- Pipe Card with High/Low Coloring + Background Tint ---------- */

export default function RealTimeDataScreen() {
  const router = useRouter();

  const [roomsState, setRoomsState] = useState<RoomsBundleState>(() => {
    const init: RoomsBundleState = {};
    ROOMS.forEach((r) => {
      init[r] = {
        pipes: [PIPE_FILTER],
        map: {
          [PIPE_FILTER]: {
            latest: undefined,
            history: [],
            stats: { min: {}, max: {}, avg: {} } as any,
            expanded: false,
          },
        },
      };
    });
    return init;
  });

  const [alertsCount, setAlertsCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subscriptions
  const latestUnsubsRef = useRef<Record<string, () => void>>({});
  const historyUnsubsRef = useRef<Record<string, () => void>>({});
  const alertsUnsubsRef = useRef<Record<string, () => void>>({});
  const roomAlertCacheRef = useRef<Record<string, number>>({});

  const lastSeverityRef = useRef<Record<string, AlertLevel | undefined>>({});
  const hasSeenInitialRef = useRef<Record<string, boolean>>({});
  const lastAlertAtRef = useRef<Record<string, number>>({});

  const key = (room: string, pipe: string, kind: "L" | "H") =>
    `${kind}:${room}:${pipe}`;
  const rpKey = (room: string, pipe: string) => `${room}/${pipe}`;

  const goToPipe = useCallback(
    (room: string, pipeKey: string) => {
      router.push({
        pathname: "/pipe/[pipe]",
        params: { pipe: pipeKey, room },
      } as never);
    },
    [router]
  );

  const detachAll = useCallback(() => {
    Object.values(latestUnsubsRef.current).forEach((u) => u && u());
    Object.values(historyUnsubsRef.current).forEach((u) => u && u());
    Object.values(alertsUnsubsRef.current).forEach((u) => u && u());

    latestUnsubsRef.current = {};
    historyUnsubsRef.current = {};
    alertsUnsubsRef.current = {};
    roomAlertCacheRef.current = {};
    lastSeverityRef.current = {};
    hasSeenInitialRef.current = {};
    lastAlertAtRef.current = {};
    setAlertsCount(0);
  }, []);

  const attachAll = useCallback(() => {
    roomAlertCacheRef.current = {};
    lastSeverityRef.current = {};
    hasSeenInitialRef.current = {};
    lastAlertAtRef.current = {};
    setAlertsCount(0);

    ROOMS.forEach((roomName) => {
      const pipeKey = PIPE_FILTER;

      /* ---------- Latest subscription ---------- */
      const latestRef = ref(rtdb, `Devices/${roomName}/${pipeKey}/Latest`);
      const lu = onValue(
        latestRef,
        (snap) => {
          const v = (snap.val() || {}) as LatestReading;
          const thisRP = rpKey(roomName, pipeKey);

          // Update UI
          setRoomsState((prev) => {
            const curR = prev[roomName] ?? {
              pipes: [pipeKey],
              map: {} as any,
            };
            const ps = curR.map[pipeKey] ?? {
              latest: undefined,
              history: [],
              stats: { min: {}, max: {}, avg: {} } as any,
              expanded: false,
            };
            return {
              ...prev,
              [roomName]: {
                pipes: [pipeKey],
                map: { ...curR.map, [pipeKey]: { ...ps, latest: v } },
              },
            };
          });

          // Auto alerts
          const sev = computeSeverity(v);
          const prevS = lastSeverityRef.current[thisRP];
          const seen = hasSeenInitialRef.current[thisRP];

          if (!seen) {
            hasSeenInitialRef.current[thisRP] = true;
            lastSeverityRef.current[thisRP] = sev;
          } else {
            if (sev === "critical" && prevS !== "critical") {
              const now = Date.now();
              const last = lastAlertAtRef.current[thisRP] ?? 0;
              if (now - last > ALERT_COOLDOWN_MS) {
                lastAlertAtRef.current[thisRP] = now;
                writeCriticalAlert(roomName, pipeKey, v).catch((e) =>
                  console.warn("Failed alert:", e)
                );
              }
            }
            lastSeverityRef.current[thisRP] = sev;
          }
        },
        (err) => setError(`Latest ${roomName}/${pipeKey}: ${err?.message ?? "unknown"}`)
      );
      latestUnsubsRef.current[key(roomName, pipeKey, "L")] = () =>
        off(latestRef, "value", lu);

      /* ---------- History subscription ---------- */
      const readingsQ = query(
        ref(rtdb, `Devices/${roomName}/${pipeKey}/Readings`),
        limitToLast(MAX_POINTS)
      );
      const hu = onValue(
        readingsQ,
        (snap) => {
          const val = snap.val() || {};
          const pts: HistoryPoint[] = Object.keys(val)
            .sort()
            .map((k) => ({ ts_key: k, ...(val[k] || {}) }));

          const stats = calcStats(pts);

          setRoomsState((prev) => {
            const cur = prev[roomName] ?? { pipes: [pipeKey], map: {} as any };
            const ps = cur.map[pipeKey] ?? {
              latest: undefined,
              history: [],
              stats: { min: {}, max: {}, avg: {} } as any,
              expanded: false,
            };

            return {
              ...prev,
              [roomName]: {
                pipes: [pipeKey],
                map: { ...cur.map, [pipeKey]: { ...ps, history: pts, stats } },
              },
            };
          });
        },
        (err) => setError(`Readings ${roomName}/${pipeKey}: ${err?.message ?? "unknown"}`)
      );
      historyUnsubsRef.current[key(roomName, pipeKey, "H")] = () =>
        off(readingsQ, "value", hu);

      /* ---------- Alerts count ---------- */
      if (alertsUnsubsRef.current[roomName]) alertsUnsubsRef.current[roomName]!();

      alertsUnsubsRef.current[roomName] = subscribeAlerts(
        roomName,
        (rows: any[]) => {
          const criticalCount = Array.isArray(rows)
            ? rows.filter((a: any) => a?.level === "critical").length
            : 0;

          roomAlertCacheRef.current[roomName] = criticalCount;

          const total = Object.values(roomAlertCacheRef.current).reduce(
            (a, b) => a + (b || 0),
            0
          );
          setAlertsCount(total);
        }
      );
    });
  }, []);

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
      setTimeout(() => setRefreshing(false), 300);
    }, 50);
  }, [attachAll, detachAll]);

  /* ---------- color helpers ---------- */
  const colorForValue = (
    value: number | undefined,
    low: number,
    high: number
  ): string => {
    if (value == null || Number.isNaN(value)) return COLOR_NORMAL;
    if (value > high) return COLOR_HIGH;
    if (value < low) return COLOR_LOW;
    return COLOR_NORMAL;
  };

  const labelForValue = (
    value: number | undefined,
    low: number,
    high: number
  ): string => {
    if (value == null || Number.isNaN(value)) return "";
    if (value > high) return " (HIGH)";
    if (value < low) return " (LOW)";
    return "";
  };

  const detectTint = (lt?: LatestReading) => {
    if (!lt) return BG_TINT_NORMAL;

    const f = lt.flow_Lmin ?? 0;
    const p = lt.pressure_psi ?? 0;
    const t = lt.temp_C ?? 0;

    if (f > FLOW_CRITICAL_LMIN || p > PRESS_CRITICAL_PSI || t > TEMP_CRITICAL_C)
      return BG_TINT_HIGH;

    if (f < FLOW_MIN_LMIN || p < PRESS_MIN_PSI || t < TEMP_MIN_C)
      return BG_TINT_LOW;

    return BG_TINT_NORMAL;
  };

  /* ---------- PipeCard Component ---------- */
  const PipeCard = ({ roomName, pipeKey }: { roomName: string; pipeKey: string }) => {
    const ps = roomsState[roomName]?.map[pipeKey];
    const lt = ps?.latest;
    const st = ps?.stats;

    const bgTint = detectTint(lt);

    // Latest value coloring
    const flowColor = colorForValue(lt?.flow_Lmin, FLOW_MIN_LMIN, FLOW_CRITICAL_LMIN);
    const tempColor = colorForValue(lt?.temp_C, TEMP_MIN_C, TEMP_CRITICAL_C);
    const pressColor = colorForValue(lt?.pressure_psi, PRESS_MIN_PSI, PRESS_CRITICAL_PSI);

    return (
      <View style={[styles.cardWrap, { backgroundColor: bgTint }]}>
        {/* Header row */}
        <TouchableOpacity style={styles.cardHead} onPress={() => goToPipe(roomName, pipeKey)}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <FontAwesome name="tint" size={16} color="#0bfffe" />
            <Text style={styles.cardHeadTitle}>{pipeKey}</Text>
          </View>
          <FontAwesome name="chevron-right" size={16} color="#aaa" />
        </TouchableOpacity>

        {/* Latest snapshot */}
        <View style={styles.latestRow}>
          <Text style={[styles.latestItem, { color: flowColor }]}>
            Flow: {fmt(lt?.flow_Lmin, " L/min")}
            <Text style={{ fontSize: 11 }}>{labelForValue(lt?.flow_Lmin, FLOW_MIN_LMIN, FLOW_CRITICAL_LMIN)}</Text>
          </Text>

          <Text style={[styles.latestItem, { color: tempColor }]}>
            Temp: {fmt(lt?.temp_C, " °C")}
            <Text style={{ fontSize: 11 }}>{labelForValue(lt?.temp_C, TEMP_MIN_C, TEMP_CRITICAL_C)}</Text>
          </Text>

          <Text style={[styles.latestItem, { color: pressColor }]}>
            Pressure: {fmt(lt?.pressure_psi, " PSI")}
            <Text style={{ fontSize: 11 }}>{labelForValue(lt?.pressure_psi, PRESS_MIN_PSI, PRESS_CRITICAL_PSI)}</Text>
          </Text>
        </View>

        <Text style={styles.latestTs}>
          Updated: {formatTimeWithMs(num(lt?.ts_server_ms) ?? lt?.t_ms ?? undefined)}
        </Text>

        {/* Collapsed preview */}
        {!ps?.expanded && (
          <View style={styles.previewRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.previewStat}>
                Min {fmt(st?.min.flow_Lmin, " L/m")} • Avg {fmt(st?.avg.flow_Lmin, " L/m")} • Max{" "}
                {fmt(st?.max.flow_Lmin, " L/m")}
              </Text>
            </View>

            <Sparkline
              data={ps?.history ?? []}
              accessor={(p) => p.flow_Lmin}
              width={140}
              height={40}
              minThreshold={FLOW_MIN_LMIN}
              maxThreshold={FLOW_CRITICAL_LMIN}
            />
          </View>
        )}

        {/* Expanded content */}
        {ps?.expanded && (
          <View style={styles.expandedBox}>
            {/* Flow */}
            <Text style={styles.sectionLabel}>
              Flow (last {Math.min(ps.history.length, MAX_POINTS)} pts)
            </Text>
            <Sparkline
              data={ps.history}
              accessor={(p) => p.flow_Lmin}
              width={260}
              height={64}
              minThreshold={FLOW_MIN_LMIN}
              maxThreshold={FLOW_CRITICAL_LMIN}
            />

            {/* Pressure */}
            <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Pressure</Text>
            <Sparkline
              data={ps.history}
              accessor={(p) => p.pressure_psi}
              width={260}
              height={64}
              minThreshold={PRESS_MIN_PSI}
              maxThreshold={PRESS_CRITICAL_PSI}
            />

            {/* Temperature */}
            <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Temperature</Text>
            <Sparkline
              data={ps.history}
              accessor={(p) => p.temp_C}
              width={260}
              height={64}
              minThreshold={TEMP_MIN_C}
              maxThreshold={TEMP_CRITICAL_C}
            />

            {/* Stats Table */}
            <View style={styles.statsTable}>
              <View style={styles.statsRow}>
                <Text style={styles.statsCellHead}>Metric</Text>
                <Text style={styles.statsCellHead}>Min</Text>
                <Text style={styles.statsCellHead}>Avg</Text>
                <Text style={styles.statsCellHead}>Max</Text>
              </View>

              <View style={styles.statsRow}>
                <Text style={styles.statsCellKey}>Flow</Text>
                <Text style={styles.statsCell}>{fmt(st?.min.flow_Lmin, " L/m")}</Text>
                <Text style={styles.statsCell}>{fmt(st?.avg.flow_Lmin, " L/m")}</Text>
                <Text style={styles.statsCell}>{fmt(st?.max.flow_Lmin, " L/m")}</Text>
              </View>

              <View style={styles.statsRow}>
                <Text style={styles.statsCellKey}>Temp</Text>
                <Text style={styles.statsCell}>{fmt(st?.min.temp_C, " °C")}</Text>
                <Text style={styles.statsCell}>{fmt(st?.avg.temp_C, " °C")}</Text>
                <Text style={styles.statsCell}>{fmt(st?.max.temp_C, " °C")}</Text>
              </View>

              <View style={styles.statsRow}>
                <Text style={styles.statsCellKey}>Pressure</Text>
                <Text style={styles.statsCell}>{fmt(st?.min.pressure_psi, " PSI")}</Text>
                <Text style={styles.statsCell}>{fmt(st?.avg.pressure_psi, " PSI")}</Text>
                <Text style={styles.statsCell}>{fmt(st?.max.pressure_psi, " PSI")}</Text>
              </View>
            </View>

            {/* Recent Log */}
            <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Recent Log</Text>
            {(ps.history.slice(-12) || []).map((p) => (
              <View key={p.ts_key} style={styles.logRow}>
                <Text style={styles.logText}>
                  {p.ts_key.replace(/T/, " ").replace(/_/g, ":")}
                </Text>
                <Text style={styles.logTextSm}>
                  F:{fmt(p.flow_Lmin, "", 2)}  P:{fmt(p.pressure_psi, "", 1)}  T:{fmt(p.temp_C, "", 1)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Expand toggle */}
        <TouchableOpacity
          onPress={() =>
            setRoomsState((prev) => {
              const cur = prev[roomName].map[pipeKey];
              return {
                ...prev,
                [roomName]: {
                  ...prev[roomName],
                  map: {
                    ...prev[roomName].map,
                    [pipeKey]: { ...cur, expanded: !cur.expanded },
                  },
                },
              };
            })
          }
          style={{ marginTop: 8, alignSelf: "flex-start" }}
        >
          <Text style={{ color: "#0bfffe" }}>{ps?.expanded ? "Collapse" : "Expand"}</Text>
        </TouchableOpacity>
      </View>
    );
  };
  /* ---------- Dashboard ---------- */
  const dashboard = useMemo(() => {
    const allLatest: LatestReading[] = [];
    ROOMS.forEach((r) => {
      const lt = roomsState[r]?.map[PIPE_FILTER]?.latest;
      if (lt) allLatest.push(lt);
    });
    if (allLatest.length === 0) return null;

    const avg = (a: number[]) =>
      a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;

    const flows = allLatest.map((x) => num(x.flow_Lmin, 0) as number);
    const temps = allLatest.map((x) => num(x.temp_C, 0) as number);
    const press = allLatest.map((x) => num(x.pressure_psi, 0) as number);

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
  }, [roomsState, alertsCount]);

  /* ---------- Screen UI ---------- */
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#111" }}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ padding: 6, marginRight: 8 }}
            >
              <FontAwesome name="arrow-left" size={20} color="#0bfffe" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Real-Time Data</Text>
          </View>
          <Text style={styles.roomPill}>Room6 • Room4 • Room1 · {PIPE_FILTER}</Text>
        </View>

        {/* Dashboard */}
        {dashboard ?? (
          <View style={{ alignItems: "center", marginVertical: 24 }}>
            <Text style={{ color: "gray" }}>No data yet</Text>
          </View>
        )}

        {/* Per-Room Sections */}
        <View style={{ paddingHorizontal: 12, paddingBottom: 24 }}>
          <Text style={styles.sectionTitle}>Pipes</Text>

          {ROOMS.map((roomName) => (
            <View key={roomName} style={{ marginTop: 10 }}>
              <Text style={styles.roomHeader}>{roomName}</Text>
              <PipeCard roomName={roomName} pipeKey={PIPE_FILTER} />
            </View>
          ))}
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

  roomHeader: {
    color: "#bbb",
    fontSize: 14,
    marginLeft: 6,
    marginBottom: 6,
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

  latestRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  latestItem: { color: "#ddd", fontSize: 13 },
  latestTs: { color: "#999", fontSize: 11, marginBottom: 6 },

  previewRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  previewStat: { color: "#bbb", fontSize: 12, marginRight: 10 },

  expandedBox: {
    backgroundColor: "#151515",
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  sectionLabel: { color: "#aaa", fontSize: 12, marginBottom: 6 },

  statsTable: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#2a2a2a",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
    paddingVertical: 6,
  },
  statsCellHead: {
    color: "#eee",
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
    fontSize: 12,
  },
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
