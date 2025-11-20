import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";

export default function LoginScreen() {
  const auth = getAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    try {
      setBusy(true);
      await signInWithEmailAndPassword(auth, email.trim(), pw);
      router.replace("/"); // go to app root (your tabs/index)
    } catch (e: any) {
      Alert.alert("Sign in failed", e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const signUp = async () => {
    try {
      setBusy(true);
      await createUserWithEmailAndPassword(auth, email.trim(), pw);
      router.replace("/");
    } catch (e: any) {
      Alert.alert("Sign up failed", e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const resetPw = async () => {
    try {
      if (!email.trim()) {
        Alert.alert("Reset password", "Enter your email first.");
        return;
      }
      setBusy(true);
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert("Reset email sent", "Check your inbox for a reset link.");
    } catch (e: any) {
      Alert.alert("Reset failed", e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <View style={styles.container}>
        <Text style={styles.title}>LeakLens</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor="#777"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />

        <TextInput
          placeholder="Password (min 6)"
          placeholderTextColor="#777"
          secureTextEntry
          value={pw}
          onChangeText={setPw}
          style={styles.input}
        />

        <TouchableOpacity disabled={busy} style={[styles.btn, busy && { opacity: 0.6 }]} onPress={signIn}>
          {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>Sign In</Text>}
        </TouchableOpacity>

        <TouchableOpacity disabled={busy} style={[styles.btnGhost, busy && { opacity: 0.6 }]} onPress={signUp}>
          <Text style={styles.btnGhostText}>Create Account</Text>
        </TouchableOpacity>

        <TouchableOpacity disabled={busy} onPress={resetPw} style={{ marginTop: 10 }}>
          <Text style={{ color: "#0bfffe" }}>Forgot password?</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  title: { color: "#0bfffe", fontSize: 36, fontWeight: "bold" },
  subtitle: { color: "#aaa", marginTop: 6, marginBottom: 18 },
  input: {
    width: "100%", backgroundColor: "#1f1f1f", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: "#fff", marginTop: 10, borderWidth: 1, borderColor: "#2a2a2a",
  },
  btn: { width: "100%", backgroundColor: "#0bfffe", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 16 },
  btnText: { color: "#000", fontWeight: "bold", fontSize: 16 },
  btnGhost: { width: "100%", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 10, borderWidth: 1, borderColor: "#0bfffe" },
  btnGhostText: { color: "#0bfffe", fontWeight: "bold", fontSize: 16 },
});
