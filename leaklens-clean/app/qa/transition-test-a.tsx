// app/qa/transition-test-a.tsx
import React, { useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { emitArrive } from "./bridge";

export default function TestA() {
  useFocusEffect(
    useCallback(() => {
      console.log("[QA] A -> emitArrive()");
      // fire on next tick to ensure first frame painted
      const t = setTimeout(() => emitArrive(), 0);
      return () => clearTimeout(t);
    }, [])
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.big}>Screen A</Text>
      <Text style={styles.sub}>Measuring…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#101016", alignItems: "center", justifyContent: "center" },
  big: { color: "#0bfffe", fontSize: 32, fontWeight: "bold" },
  sub: { color: "#aaa", marginTop: 8 },
});
