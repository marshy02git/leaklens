// firebase/config.ts
import { initializeApp } from 'firebase/app';

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

export const firebaseApp = initializeApp(firebaseConfig);
