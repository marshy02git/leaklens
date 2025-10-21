// firebase/config.ts
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getDatabase, Database } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBzCIDQMYJhuPM1OgGtvaq2U_VIYfcZoAw",
  authDomain: "leaklens-test.firebaseapp.com",
  databaseURL: "https://leaklens-test-default-rtdb.firebaseio.com",
  projectId: "leaklens-test",
  storageBucket: "leaklens-test.appspot.com",
  messagingSenderId: "194177622011",
  appId: "1:194177622011:web:328c5d493520eba0ef355e",
  measurementId: "G-ENTTCL9YXH",
};

// ✅ Initialize exactly once (works with Expo hot reload too)
export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ✅ Shared Realtime Database instance bound to this app
export const rtdb: Database = getDatabase(app);
