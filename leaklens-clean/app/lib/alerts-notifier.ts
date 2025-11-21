// app/lib/alerts-notifier.ts
import { rtdb } from "../../firebase/config";
import { ref, onChildAdded, off } from "firebase/database";
import * as Notifications from "expo-notifications";

/**
 * Watch RTDB Alerts/{room} and fire a local OS notification
 * whenever a NEW critical alert is added.
 *
 * Returns an unsubscribe function.
 */
export function watchCriticalAlerts(room: string) {
  const alertsRef = ref(rtdb, `Alerts/${room}`);
  const seen = new Set<string>();

  console.log("[alerts-notifier] Attaching watcher for room:", room);

  const handleChild = async (snap: any) => {
    const id = snap.key as string | null;
    if (!id) return;

    // Don't double-fire within this session:
    if (seen.has(id)) {
      return;
    }
    seen.add(id);

    const a = snap.val() || {};
    const level = a.level ?? a.severity ?? "info";
    const pipe = a.pipe ?? "Pipe?";
    const message = a.message ?? "Check system";

    console.log(
      "[alerts-notifier] onChildAdded",
      room,
      "id=",
      id,
      "level=",
      level,
      "pipe=",
      pipe,
      "msg=",
      message
    );

    // Only fire banners for criticals
    if (level !== "critical") {
      return;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "LeakLens • Critical Alert",
          body: `${room}/${pipe}: ${message}`,
          data: { room, pipe, alertId: id },
        },
        trigger: null, // show immediately
      });
      console.log("[alerts-notifier] Scheduled local notification for", room, id);
    } catch (err) {
      console.warn("[alerts-notifier] Failed to schedule notification:", err);
    }
  };

  const unsub = onChildAdded(alertsRef, handleChild);

  return () => {
    console.log("[alerts-notifier] Detaching watcher for room:", room);
    off(alertsRef, "child_added", handleChild);
  };
}
