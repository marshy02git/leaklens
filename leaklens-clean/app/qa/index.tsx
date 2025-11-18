// app/qa/index.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function QAHome() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.big}>QA Tools</Text>
      <Text style={styles.sub}>
        Use the overlay controls at the bottom to run the transition test.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },
  big: { color: "#0bfffe", fontSize: 24, fontWeight: "bold" },
  sub: { color: "#aaa", marginTop: 8, textAlign: "center", paddingHorizontal: 24 },
});
