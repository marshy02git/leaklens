// app/qa/_layout.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Stack, router } from "expo-router";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { onArrive } from "./bridge";

type Result = { n: number; ms: number };
const THRESHOLD_MS = 300;
const A = "/qa/transition-test-a";
const B = "/qa/transition-test-b";

const now = () =>
  globalThis.performance && typeof globalThis.performance.now === "function"
    ? performance.now()
    : Date.now();

/** Persistent controller that runs the test and stays mounted while A/B swap */
function QAControllerOverlay() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Result[]>([]);

  const startMark = useRef<number | null>(null);
  const currentRoute = useRef<"A" | "B">("A");
  const iteration = useRef(0);
  const total = useRef(20);
  const awaitingPingRef = useRef(false);

  const handleArrive = useCallback(() => {
    if (!awaitingPingRef.current) return;
    awaitingPingRef.current = false;

    if (startMark.current != null) {
      const dt = now() - startMark.current;
      setResults((r) => [...r, { n: iteration.current, ms: dt }]);
      startMark.current = null;
    }

    if (!running) return;
    if (iteration.current >= total.current) {
      setRunning(false);
      return;
    }

    setTimeout(() => {
      if (!running) return;
      currentRoute.current = currentRoute.current === "A" ? "B" : "A";
      iteration.current += 1;
      startMark.current = now();
      awaitingPingRef.current = true;
      router.replace(currentRoute.current === "A" ? A : B);
    }, 60);
  }, [running]);

  useEffect(() => onArrive(handleArrive), [handleArrive]);

  const start = useCallback((count = 20) => {
    if (running) return;
    setResults([]);
    iteration.current = 1;
    total.current = count;
    currentRoute.current = "A";
    setRunning(true);
    startMark.current = now();
    awaitingPingRef.current = true;
    router.replace(A);
  }, [running]);

  const passRate = results.length
    ? Math.round(100 * results.filter(r => r.ms <= THRESHOLD_MS).length / results.length)
    : 0;

  const avgMs = results.length
    ? (results.reduce((a, b) => a + b.ms, 0) / results.length).toFixed(1)
    : "—";

  const exportCSV = async () => {
    const header = "Iteration,Duration_ms,Pass(<=threshold)\n";
    const rows = results.map(r => `${r.n},${r.ms.toFixed(1)},${r.ms <= THRESHOLD_MS ? "YES" : "NO"}`).join("\n");
    const body = [
      `Threshold_ms,${THRESHOLD_MS}`,
      `Total,${results.length}`,
      `PassRate,${passRate}%`,
      `Average_ms,${avgMs}`,
      "",
      header + rows,
    ].join("\n");

    const cacheDir = (FileSystem as any).cacheDirectory ?? (FileSystem as any).documentDirectory ?? "";
    const path = `${cacheDir}transition_results_${Date.now()}.csv`;
    await FileSystem.writeAsStringAsync(path, body, { encoding: "utf8" });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, { mimeType: "text/csv", dialogTitle: "Export Transition Results" });
    } else {
      alert(`Saved CSV:\n${path}`);
    }
  };

  return (
    <View style={styles.overlay}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.panel}>
          <Text style={styles.title}>Transition QA • ≤ {THRESHOLD_MS} ms</Text>
          <TouchableOpacity style={styles.btn} onPress={() => start(20)} disabled={running}>
            <Text style={styles.btnText}>{running ? "Running…" : "Run 20 tests"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { opacity: results.length ? 1 : 0.4 }]}
            onPress={exportCSV}
            disabled={!results.length}
          >
            <Text style={styles.btnText}>Export CSV</Text>
          </TouchableOpacity>

          <View style={styles.table}>
            <View style={[styles.tr, styles.th]}>
              <Text style={[styles.td, styles.bold]}>Tests</Text>
              <Text style={[styles.td, styles.bold]}>Pass Rate</Text>
              <Text style={[styles.td, styles.bold]}>Average</Text>
            </View>
            <View style={styles.tr}>
              <Text style={styles.td}>{results.length}</Text>
              <Text style={styles.td}>{passRate}%</Text>
              <Text style={styles.td}>{avgMs} ms</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export default function QALayout() {
  // IMPORTANT: render a Stack so child routes resolve; keep overlay mounted as sibling
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="transition-test-a" />
        <Stack.Screen name="transition-test-b" />
      </Stack>
      <QAControllerOverlay />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 8 },
  panel: { backgroundColor: "#181818", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#2a2a2a", marginHorizontal: 8 },
  title: { color: "#fff", fontWeight: "bold", marginBottom: 8 },
  btn: { backgroundColor: "#0bfffe33", borderColor: "#0bfffe", borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, marginRight: 8, marginBottom: 8 },
  btnText: { color: "#0bfffe", fontWeight: "600" },
  table: { marginTop: 6, borderWidth: 1, borderColor: "#2a2a2a", borderRadius: 6 },
  tr: { flexDirection: "row" },
  th: { backgroundColor: "#151515" },
  td: { flex: 1, color: "#ddd", padding: 6, borderRightWidth: 1, borderRightColor: "#2a2a2a", textAlign: "center" },
  bold: { fontWeight: "700", color: "#fff" },
});
