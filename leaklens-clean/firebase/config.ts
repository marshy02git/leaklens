// firebase/config.ts
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getDatabase, Database } from "firebase/database";
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
  Auth,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

/**
 * IMPORTANT: Copy these EXACTLY from Firebase console (Project Settings → General → Your apps)
 * - If apiKey is even 1 char off, you'll get auth/api-key-not-valid
 * - storageBucket must match console (often ends with .app or .com depending on region)
 */
const firebaseConfig = {
  apiKey: "AIzaSyBzCIDQMYJhuPM1QgGtvaq2U_VIYfcZoAw",
  authDomain: "leaklens-test.firebaseapp.com",
  databaseURL: "https://leaklens-test-default-rtdb.firebaseio.com",
  projectId: "leaklens-test",
  storageBucket: "leaklens-test.firebasestorage.app",
  messagingSenderId: "194177622011",
  appId: "1:194177622011:web:328c5d493520eba0ef355e",
  measurementId: "G-ENTTCL9YXH"
};

// --- App (init once, safe with fast refresh)
export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// --- Realtime Database
export const rtdb: Database = getDatabase(app);

// --- Auth (single shared instance)
// On native: initializeAuth with RN persistence (AsyncStorage)
// On web: just use getAuth(app) (initializeAuth is RN-only)
let _auth: Auth | undefined;
try {
  _auth = getAuth(app);
} catch {
  // If not initialized yet (native), we'll initialize below.
}

export const auth: Auth =
  _auth ??
  (Platform.OS === "web"
    ? getAuth(app)
    : initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      }));
