// lib/alerts-notifier.ts
import { rtdb } from "../firebase/config";
import { ref, onChildAdded, off, DataSnapshot } from "firebase/database";
import * as Notifications from "expo-notifications";

type RtdbAlert = {
  level?: string;
  message?: string;
  pipe?: string;
  room?: string;
  ts_server_ms?: number;
};

/**
 * Attach RTDB watchers for the given rooms.
 * Whenever a *new* critical alert is pushed under Alerts/{room},
 * we schedule a local OS notification banner.
 */
export function attachCriticalAlertWatchers(rooms: string[]) {
  console.log("[alerts-notifier] attachCriticalAlertWatchers", rooms);

  const detachFns: Array<() => void> = [];

  rooms.forEach((room) => {
    const alertsRef = ref(rtdb, `Alerts/${room}`);
    const seen = new Set<string>();

    console.log("[alerts-notifier] Attaching watcher for room:", room);

    const handler = async (snap: DataSnapshot) => {
      const id = snap.key;
      if (!id) return;

      // onChildAdded fires once for each existing child at attach time + new ones.
      // Make sure we only handle each key once.
      if (seen.has(id)) return;
      seen.add(id);

      const a = snap.val() as RtdbAlert | null;
      if (!a || a.level !== "critical") return;

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "LeakLens • Critical",
            body: `${room}/${a.pipe ?? "Pipe?"}: ${a.message ?? "Check system"}`,
            data: {
              room,
              pipe: a.pipe ?? "Pipe2",
              ts_server_ms: a.ts_server_ms ?? Date.now(),
            },
          },
          trigger: null, // show immediately
        });
        console.log("[alerts-notifier] Scheduled OS banner for", room, id);
      } catch (err) {
        console.warn("[alerts-notifier] scheduleNotificationAsync failed:", err);
      }
    };

    const unsub = onChildAdded(alertsRef, handler);
    detachFns.push(() => {
      off(alertsRef, "child_added", handler);
      console.log("[alerts-notifier] Detached watcher for room:", room);
    });
  });

  // one combined detach
  return () => {
    detachFns.forEach((fn) => fn());
  };
}
