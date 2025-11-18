// app/qa/transition-test-b.tsx
import React, { useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { emitArrive } from "./bridge";

export default function TestB() {
  useFocusEffect(
    useCallback(() => {
      console.log("[QA] B -> emitArrive()");
      const t = setTimeout(() => emitArrive(), 0);
      return () => clearTimeout(t);
    }, [])
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.big}>Screen B</Text>
      <Text style={styles.sub}>Measuring…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#161010", alignItems: "center", justifyContent: "center" },
  big: { color: "#0bfffe", fontSize: 32, fontWeight: "bold" },
  sub: { color: "#aaa", marginTop: 8 },
});
