// app/pipe/[pipe].tsx
import "react-native-gesture-handler";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome } from "@expo/vector-icons";
import { rtdb } from "../../firebase/config";
import { ref, onValue, off, query, limitToLast } from "firebase/database";
import Svg, { Line, Path, Circle } from "react-native-svg";
import Animated from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useSharedValue } from "react-native-reanimated";

/* ---------------- Types & Utils ---------------- */
type Point = {
  ts_server_ms?: number;
  ts_key: string;
  t_ms?: number;
  flow_Lmin?: number;
  temp_C?: number;
  pressure_psi?: number;
};

const fmt = (v?: number, unit = "", d = 1) =>
  typeof v === "number" && Number.isFinite(v) ? `${v.toFixed(d)}${unit}` : "—";

const formatTimeWithMs = (ms?: number) => {
  if (!ms) return "—";
  try {
    // @ts-ignore fractionalSecondDigits isn't in RN TS yet
    return new Date(ms).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
  } catch {
    const d = new Date(ms);
    const z = (n: number, s = 2) => String(n).padStart(s, "0");
    return `${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}.${z(
      d.getMilliseconds(),
      3
    )}`;
  }
};

/* ---------------- ZoomableSpark (no .value reads in render) ---------------- */
type ZPoint = {
  t_ms?: number;
  flow_Lmin?: number;
  temp_C?: number;
  pressure_psi?: number;
  ts_key?: string;
};

function clamp(n: number, lo: number, hi: number) {
  "worklet";
  return Math.max(lo, Math.min(hi, n));
}

function ZoomableSpark({
  data,
  accessor,
  width = 320,
  height = 140,
  stroke = "#0bfffe",
  unit = "",
}: {
  data: ZPoint[];
  accessor: (p: ZPoint) => number | undefined;
  width?: number;
  height?: number;
  stroke?: string;
  unit?: string;
}) {
  // React state used for rendering (safe)
  const [viewport, setViewport] = useState({ scaleX: 1, offsetX: 0 }); // offset in [0, 1 - 1/scale]
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Shared values only for gesture math (never read in render)
  const svScale = useSharedValue(1);
  const svOffset = useSharedValue(0);

  const updateViewport = (scale: number, off: number) => {
    // avoids excessive renders using rAF batching
    requestAnimationFrame(() => setViewport({ scaleX: scale, offsetX: off }));
  };

  const ys = useMemo(
    () => data.map(accessor).map((v) => (typeof v === "number" && isFinite(v) ? v : undefined)),
    [data, accessor]
  );
  const valid = useMemo(() => ys.filter((v): v is number => typeof v === "number"), [ys]);
  const notEnough = valid.length < 2;
  const yMin = useMemo(() => (notEnough ? 0 : Math.min(...valid)), [valid, notEnough]);
  const yMax = useMemo(() => (notEnough ? 1 : Math.max(...valid)), [valid, notEnough]);
  const ySpan = Math.max(1e-6, yMax - yMin);
  const N = ys.length;

  // Gestures (worklets) — update shared values and push to React via runOnJS
  const pinch = Gesture.Pinch().onChange((e) => {
    "worklet";
    const nextScale = clamp(svScale.value * e.scale, 1, 20);
    const prevView = 1 / svScale.value;
    const center = svOffset.value + prevView / 2;
    const nextView = 1 / nextScale;
    const nextOff = clamp(center - nextView / 2, 0, 1 - nextView);
    svScale.value = nextScale;
    svOffset.value = nextOff;
    runOnJS(updateViewport)(nextScale, nextOff);
  });

  const pan = Gesture.Pan().onChange((e) => {
    "worklet";
    const viewFrac = 1 / svScale.value;
    const dxFrac = (e.changeX / width) * viewFrac;
    const nextOff = clamp(svOffset.value - dxFrac, 0, 1 - viewFrac);
    svOffset.value = nextOff;
    runOnJS(updateViewport)(svScale.value, nextOff);
  });

  const tapDrag = Gesture.Pan()
    .onBegin((e) => {
      "worklet";
      const viewFrac = 1 / svScale.value;
      const left = svOffset.value;
      const xFrac = left + (e.x / width) * viewFrac;
      const idx = Math.round(xFrac * Math.max(0, N - 1));
      runOnJS(setHoverIdx)(clamp(idx, 0, N - 1));
    })
    .onChange((e) => {
      "worklet";
      const viewFrac = 1 / svScale.value;
      const left = svOffset.value;
      const xFrac = left + (e.x / width) * viewFrac;
      const idx = Math.round(xFrac * Math.max(0, N - 1));
      runOnJS(setHoverIdx)(clamp(idx, 0, N - 1));
    });

  const composed = Gesture.Simultaneous(pinch, pan, tapDrag);

  // Build path using *React state* viewport
  const makePath = useCallback(
    (leftFrac: number, viewFrac: number) => {
      if (notEnough) return "";
      const first = Math.floor(leftFrac * (N - 1));
      const last = Math.min(N - 1, Math.ceil((leftFrac + viewFrac) * (N - 1)));
      const count = Math.max(2, last - first + 1);
      const stepX = width / (count - 1);

      let d = "";
      for (let vi = 0; vi < count; vi++) {
        const i = first + vi;
        const y = ys[i];
        if (typeof y !== "number") continue;
        const X = vi * stepX;
        const Y = height - ((y - yMin) / ySpan) * height;
        d += (d ? " L " : "M ") + `${X} ${Y}`;
      }
      return d;
    },
    [ys, N, width, height, yMin, ySpan, notEnough]
  );

  const d = useMemo(
    () => makePath(viewport.offsetX, 1 / viewport.scaleX),
    [viewport, makePath]
  );

  const tooltip = useMemo(() => {
    if (notEnough || hoverIdx == null || typeof ys[hoverIdx] !== "number") return null;

    const viewFrac = 1 / viewport.scaleX;
    const first = Math.floor(viewport.offsetX * (N - 1));
    const last = Math.min(N - 1, Math.ceil((viewport.offsetX + viewFrac) * (N - 1)));
    const count = Math.max(2, last - first + 1);
    const stepX = width / (count - 1);

    const vi = Math.max(0, Math.min(count - 1, hoverIdx - first));
    const X = vi * stepX;
    const y = ys[hoverIdx] as number;
    const Y = height - ((y - yMin) / ySpan) * height;
    return { X, Y, value: y };
  }, [hoverIdx, ys, viewport, N, yMin, ySpan, width, height, notEnough]);

  return (
    <GestureDetector gesture={composed}>
      <View
        style={{
          width,
          height,
          backgroundColor: "#121212",
          borderRadius: 10,
          overflow: "hidden",
          padding: 6,
        }}
      >
        <Svg width={width} height={height}>
          <Line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="#2a2a2a" strokeWidth={1} />
          {!notEnough && <Path d={d} stroke={stroke} strokeWidth={2} fill="none" />}
          {tooltip && (
            <>
              <Line x1={tooltip.X} y1={0} x2={tooltip.X} y2={height} stroke="#888" strokeDasharray="4 4" />
              <Circle cx={tooltip.X} cy={tooltip.Y} r={3} fill={stroke} />
            </>
          )}
        </Svg>
        {notEnough && (
          <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#777" }}>Not enough data</Text>
          </View>
        )}
        {tooltip && (
          <View
            style={{
              position: "absolute",
              right: 6,
              top: 6,
              backgroundColor: "#000000aa",
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 6,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 12 }}>
              {tooltip.value.toFixed(2)}
              {unit}
            </Text>
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

/* ---------------- Screen ---------------- */
export default function PipeDetailScreen() {
  const router = useRouter();
  const { room, pipe } = useLocalSearchParams<{ room: string; pipe: string }>();
  const [latest, setLatest] = useState<Point | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [limit, setLimit] = useState(300);
  const [refreshing, setRefreshing] = useState(false);

  const latestUnsub = useRef<null | (() => void)>(null);
  const historyUnsub = useRef<null | (() => void)>(null);

  const detach = useCallback(() => {
    latestUnsub.current?.(); latestUnsub.current = null;
    historyUnsub.current?.(); historyUnsub.current = null;
  }, []);

  const attach = useCallback(() => {
    if (!room || !pipe) return;
    const latestRef = ref(rtdb, `Devices/${room}/${pipe}/Latest`);
    const u1 = onValue(latestRef, (s) => setLatest(s.val() || null));
    latestUnsub.current = () => off(latestRef, "value", u1);

    const q = query(ref(rtdb, `Devices/${room}/${pipe}/Readings`), limitToLast(limit));
    const u2 = onValue(q, (s) => {
      const val = s.val() || {};
      const rows: Point[] = Object.keys(val).sort().map((k) => ({ ts_key: k, ...(val[k] || {}) }));
      setPoints(rows);
    });
    historyUnsub.current = () => off(q, "value", u2);
  }, [room, pipe, limit]);

  useEffect(() => {
    attach();
    return () => detach();
  }, [attach, detach]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    detach();
    setTimeout(() => {
      attach();
      setTimeout(() => setRefreshing(false), 300);
    }, 50);
  }, [attach, detach]);

  const stats = useMemo(() => {
    const take = <K extends keyof Point>(k: K) =>
      points.map((p) => p[k]).filter((v) => typeof v === "number") as number[];
    const agg = (arr: number[]) => ({
      min: arr.length ? Math.min(...arr) : undefined,
      max: arr.length ? Math.max(...arr) : undefined,
      avg: arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : undefined,
    });
    return { flow: agg(take("flow_Lmin")), temp: agg(take("temp_C")), press: agg(take("pressure_psi")) };
  }, [points]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#111" }}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { detach(); router.back(); }} style={{ padding: 6, marginRight: 8 }}>
            <FontAwesome name="arrow-left" size={20} color="#0bfffe" />
          </TouchableOpacity>
          <Text style={styles.title}>{room ?? "Room"}</Text>
          <Text style={styles.pill}>{pipe ?? "Pipe"}</Text>
        </View>

        {/* Latest snapshot */}
        <View style={styles.latestBox}>
          <Text style={styles.section}>Latest</Text>
          <View style={styles.latestRow}>
            <Text style={styles.latestItem}>Flow: {fmt(latest?.flow_Lmin, " L/min")}</Text>
            <Text style={styles.latestItem}>Temp: {fmt(latest?.temp_C, " °C")}</Text>
            <Text style={styles.latestItem}>Pressure: {fmt(latest?.pressure_psi, " PSI")}</Text>
          </View>
          <Text style={styles.ts}>Updated: {formatTimeWithMs(latest?.t_ms ?? latest?.ts_server_ms)}</Text>
        </View>

        {/* History graphs (zoomable) */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.section}>History (last {points.length} pts)</Text>
            <View style={styles.btnRow}>
              {[60, 120, 300, 600].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setLimit(n)}
                  style={[styles.smallBtn, limit === n && styles.smallBtnActive]}
                >
                  <Text style={[styles.smallBtnText, limit === n && styles.smallBtnTextActive]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Text style={styles.graphLabel}>Flow</Text>
          <ZoomableSpark data={points} accessor={(p) => p.flow_Lmin} unit=" L/min" />

          <Text style={styles.graphLabel}>Pressure</Text>
          <ZoomableSpark data={points} accessor={(p) => p.pressure_psi} unit=" PSI" />

          <Text style={styles.graphLabel}>Temperature</Text>
          <ZoomableSpark data={points} accessor={(p) => p.temp_C} unit=" °C" />
        </View>

        {/* Stats table */}
        <View style={styles.card}>
          <Text style={styles.section}>Stats</Text>
          <View style={styles.tableRowHead}>
            <Text style={styles.thKey}>Metric</Text>
            <Text style={styles.th}>Min</Text>
            <Text style={styles.th}>Avg</Text>
            <Text style={styles.th}>Max</Text>
          </View>
          {[
            ["Flow", stats.flow, " L/m"],
            ["Temp", stats.temp, " °C"],
            ["Pressure", stats.press, " PSI"],
          ].map(([label, s, unit]) => (
            <View key={label as string} style={styles.tableRow}>
              <Text style={styles.tdKey}>{label as string}</Text>
              <Text style={styles.td}>{fmt((s as any).min, unit as string)}</Text>
              <Text style={styles.td}>{fmt((s as any).avg, unit as string)}</Text>
              <Text style={styles.td}>{fmt((s as any).max, unit as string)}</Text>
            </View>
          ))}
        </View>

        {/* Recent log */}
        <View style={styles.card}>
          <Text style={styles.section}>Recent Log</Text>
          {points.slice(-30).reverse().map((p) => (
            <View key={p.ts_key} style={styles.logRow}>
              <Text style={styles.logTs}>{p.ts_key.replace(/T/, " ").replace(/_/g, ":")}</Text>
              <Text style={styles.logVals}>
                F:{fmt(p.flow_Lmin, "", 2)}  P:{fmt(p.pressure_psi, "", 1)}  T:{fmt(p.temp_C, "", 1)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------------- Styles ---------------- */
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginTop: 10 },
  title: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  pill: { color: "#0bfffe", borderColor: "#0bfffe", borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontSize: 12 },

  section: { color: "#0bfffe", fontWeight: "bold", marginBottom: 8, fontSize: 16 },
  latestBox: { backgroundColor: "#181818", margin: 12, padding: 12, borderRadius: 12 },
  latestRow: { flexDirection: "row", justifyContent: "space-between" },
  latestItem: { color: "#ddd", fontSize: 14 },
  ts: { color: "#888", fontSize: 12, marginTop: 6 },

  card: { backgroundColor: "#181818", marginHorizontal: 12, marginTop: 12, padding: 12, borderRadius: 12 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  btnRow: { flexDirection: "row", gap: 6 },
  smallBtn: { borderWidth: 1, borderColor: "#3a3a3a", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  smallBtnActive: { borderColor: "#0bfffe", backgroundColor: "#0bfffe22" },
  smallBtnText: { color: "#aaa", fontSize: 12 },
  smallBtnTextActive: { color: "#0bfffe" },

  graphLabel: { color: "#bbb", fontSize: 12, marginBottom: 6, marginTop: 8 },

  tableRowHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#2a2a2a", paddingVertical: 6 },
  thKey: { color: "#eee", fontWeight: "bold", flex: 1, fontSize: 12 },
  th: { color: "#eee", fontWeight: "bold", flex: 1, fontSize: 12, textAlign: "center" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#2a2a2a", paddingVertical: 6 },
  tdKey: { color: "#ccc", flex: 1, fontSize: 12 },
  td: { color: "#fff", flex: 1, fontSize: 12, textAlign: "center" },

  logRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#1c1c1c", paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, marginTop: 6 },
  logTs: { color: "#ddd", fontSize: 12 },
  logVals: { color: "#aaa", fontSize: 12 },
});
