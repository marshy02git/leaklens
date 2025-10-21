// firebase/db.ts
import { rtdb } from "./config";
import { ref, onValue } from "firebase/database";

export type AlertRow = {
  id: string;            // unique key we assemble (room[/pipe]/alertId)
  room: string;
  pipe?: string;
  level?: string;        // e.g., "critical" | "warning"
  message?: string;
  code?: string | number;
  ts_ms?: number;        // from DB if present
  ts_server_ms: number;  // when we received it
};

/**
 * Streams alerts for a room from:
 *   1) Alerts/{room}/{alertId}
 *   2) Devices/{room}/{pipe}/Alerts/{alertId}
 * Calls cb with a flat, de-duplicated array of AlertRow.
 */
export function subscribeAlerts(room: string, cb: (rows: AlertRow[]) => void) {
  const roomAlertsRef = ref(rtdb, `Alerts/${room}`);
  const devicesRoomRef = ref(rtdb, `Devices/${room}`);

  // Keep a local map so we can update incrementally
  const alertsMap: Record<string, AlertRow> = {};

  // 1) Room-level alerts
  const unsubRoomLevel = onValue(
    roomAlertsRef,
    (snap) => {
      const val = snap.val() || {};

      // (Optional) you can clear previous room-level entries first if you want strict sync:
      // Object.keys(alertsMap).forEach((k) => { if (!k.includes("/")) delete alertsMap[k]; });

      Object.keys(val).forEach((alertId) => {
        const a = val[alertId] || {};
        const key = `${room}/${alertId}`;
        alertsMap[key] = {
          id: key,
          room,
          level: a.level,
          message: a.message,
          code: a.code,
          ts_ms: typeof a.ts_ms === "number" ? a.ts_ms : undefined,
          ts_server_ms: Date.now(),
        };
      });

      cb(Object.values(alertsMap));
    },
    (err) => console.warn("subscribeAlerts room-level error:", err?.message)
  );

  // 2) Per-pipe alerts under Devices/{room}/{pipe}/Alerts
  const perPipeUnsubs: Array<() => void> = [];
  const unsubPipes = onValue(
    devicesRoomRef,
    (snap) => {
      // clear previous per-pipe listeners when the set of pipes changes
      perPipeUnsubs.forEach((u) => u());
      perPipeUnsubs.length = 0;

      const roomVal = snap.val() || {};
      Object.keys(roomVal).forEach((pipeKey) => {
        const perPipeAlertsRef = ref(rtdb, `Devices/${room}/${pipeKey}/Alerts`);
        const u = onValue(
          perPipeAlertsRef,
          (asnap) => {
            const aval = asnap.val() || {};

            // (Optional) clear this pipe's old entries before re-adding to keep strict sync:
            // Object.keys(alertsMap).forEach((k) => { if (k.startsWith(`${room}/${pipeKey}/`)) delete alertsMap[k]; });

            Object.keys(aval).forEach((alertId) => {
              const a = aval[alertId] || {};
              const key = `${room}/${pipeKey}/${alertId}`;
              alertsMap[key] = {
                id: key,
                room,
                pipe: pipeKey,
                level: a.level,
                message: a.message,
                code: a.code,
                ts_ms: typeof a.ts_ms === "number" ? a.ts_ms : undefined,
                ts_server_ms: Date.now(),
              };
            });

            cb(Object.values(alertsMap));
          },
          (err) => console.warn("subscribeAlerts per-pipe error:", err?.message)
        );

        // Store the unsubscribe function returned by onValue
        perPipeUnsubs.push(u);
      });
    },
    (err) => console.warn("subscribeAlerts devices room error:", err?.message)
  );

  // unified unsubscribe
  return () => {
    unsubRoomLevel();     // ✅ call the function returned by onValue
    unsubPipes();         // ✅ call the function returned by onValue
    perPipeUnsubs.forEach((u) => u()); // ✅ detach all per-pipe listeners
  };
}
