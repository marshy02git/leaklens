// app/tabs/settings.tsx  (or wherever your Settings screen lives)
import React, { useState } from "react";
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase/config"; // <-- use your singleton

export default function SettingsScreen() {
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [busy, setBusy] = useState(false);

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            setBusy(true);
            await signOut(auth);           // <-- sign out from Firebase
            router.replace("/login");      // <-- send user to login gate
          } catch (e: any) {
            Alert.alert("Logout failed", e?.message ?? String(e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Settings</Text>

      {/* Notifications */}
      <View style={styles.row}>
        <View style={styles.labelContainer}>
          <FontAwesome name="bell" size={20} color="#0bfffe" style={styles.icon} />
          <Text style={styles.label}>Enable Notifications</Text>
        </View>
        <Switch
          value={notificationsEnabled}
          onValueChange={setNotificationsEnabled}
          thumbColor={notificationsEnabled ? "#0bfffe" : "#888"}
        />
      </View>

      {/* Theme Toggle */}
      <View style={styles.row}>
        <View style={styles.labelContainer}>
          <FontAwesome name="moon-o" size={20} color="#0bfffe" style={styles.icon} />
          <Text style={styles.label}>Dark Mode</Text>
        </View>
        <Switch
          value={darkMode}
          onValueChange={setDarkMode}
          thumbColor={darkMode ? "#0bfffe" : "#888"}
        />
      </View>

      {/* Device Management */}
      <TouchableOpacity style={styles.row}>
        <View style={styles.labelContainer}>
          <FontAwesome name="plug" size={20} color="#0bfffe" style={styles.icon} />
          <Text style={styles.label}>Manage Devices</Text>
        </View>
        <FontAwesome name="angle-right" size={18} color="#888" />
      </TouchableOpacity>

      {/* Privacy Policy */}
      <TouchableOpacity style={styles.row}>
        <View style={styles.labelContainer}>
          <FontAwesome name="shield" size={20} color="#0bfffe" style={styles.icon} />
          <Text style={styles.label}>Privacy Policy</Text>
        </View>
        <FontAwesome name="angle-right" size={18} color="#888" />
      </TouchableOpacity>

      {/* Support */}
      <TouchableOpacity style={styles.row}>
        <View style={styles.labelContainer}>
          <FontAwesome name="envelope" size={20} color="#0bfffe" style={styles.icon} />
          <Text style={styles.label}>Support</Text>
        </View>
        <FontAwesome name="angle-right" size={18} color="#888" />
      </TouchableOpacity>

      {/* Version */}
      <View style={styles.row}>
        <View style={styles.labelContainer}>
          <FontAwesome name="info-circle" size={20} color="#0bfffe" style={styles.icon} />
          <Text style={styles.label}>App Version</Text>
        </View>
        <Text style={styles.versionText}>v1.0.0</Text>
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={[styles.logoutButton, busy && { opacity: 0.7 }]}
        onPress={handleLogout}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <FontAwesome name="sign-out" size={20} color="white" style={{ marginRight: 10 }} />
            <Text style={styles.logoutText}>Logout</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#121212", padding: 20, flexGrow: 1 },
  title: { fontSize: 26, fontWeight: "bold", color: "#fff", marginBottom: 30 },
  row: {
    backgroundColor: "#1e1e1e",
    borderRadius: 10,
    padding: 16,
    marginBottom: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  labelContainer: { flexDirection: "row", alignItems: "center" },
  label: { color: "#fff", fontSize: 16, marginLeft: 12 },
  icon: { width: 24 },
  versionText: { color: "gray", fontSize: 14 },
  logoutButton: {
    marginTop: 40,
    backgroundColor: "red",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    minWidth: 140,
    justifyContent: "center",
  },
  logoutText: { color: "white", fontWeight: "bold", fontSize: 16 },
});
