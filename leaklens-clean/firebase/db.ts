// firebase/db.ts
import { getDatabase, ref, onValue } from "firebase/database";
import { firebaseApp } from "./config";

const db = getDatabase(firebaseApp);

export function subscribeReadings(
  deviceId: string,
  cb: (rows: any[]) => void
) {
  const q = ref(db, `devices/${deviceId}/readings`);

  return onValue(q, (snap) => {
    const val = snap.val();
    if (!val) {
      cb([]);
      return;
    }

    // Convert { key: value } → [ { id, ...value } ]
    const rows = Object.entries(val).map(([id, v]: any) => ({
      id,
      ...v,
    }));

    // Sort ascending by timestamp
    rows.sort((a: any, b: any) => a.ts_server_ms - b.ts_server_ms);

    cb(rows);
  });
}

export function subscribeAlerts(
  deviceId: string,
  cb: (rows: any[]) => void
) {
  const q = ref(db, `devices/${deviceId}/alerts`);

  return onValue(q, (snap) => {
    const val = snap.val() || {};
    const rows = Object.entries(val).map(([id, v]: any) => ({
      id,
      ...v,
    }));

    // Sort newest → oldest
    rows.sort((a: any, b: any) => b.startedAt_ms - a.startedAt_ms);

    cb(rows);
  });
}
