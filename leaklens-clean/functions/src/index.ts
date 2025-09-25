// functions/src/index.ts

import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

initializeApp();
const db = getDatabase();

// Set this once with: firebase functions:secrets:set INGEST_KEY
const INGEST_KEY = defineSecret("INGEST_KEY");

export const ingestReading = onRequest({ secrets: [INGEST_KEY] }, async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).send("POST only");
      return;
    }

    // Simple header auth
    const key = req.get("x-ingest-key");
    if (key !== INGEST_KEY.value()) {
      res.status(401).send("bad key");
      return;
    }

    const { deviceId, t_ms, flow_Lmin, temp_C, pressure_psi } = req.body || {};
    if (!deviceId || t_ms == null) {
      res.status(400).send("missing deviceId or t_ms");
      return;
    }

    const reading = {
      t_ms: Number(t_ms),
      flow_Lmin: toNum(flow_Lmin),
      temp_C: toNum(temp_C),
      pressure_psi: toNum(pressure_psi),
      ts_server_ms: Date.now(),
    };

    // 1) Save the reading
    await db.ref(`devices/${deviceId}/readings/${t_ms}`).set(reading);

    // 2) Simple leak heuristics
    const flags: string[] = [];
    if (reading.flow_Lmin != null && reading.flow_Lmin > 0.1 && isQuietHours()) flags.push("night_flow");
    if (reading.pressure_psi != null && reading.pressure_psi < 30) flags.push("low_pressure");
    if (reading.pressure_psi != null && reading.flow_Lmin != null && reading.flow_Lmin > 5) flags.push("burst_flow");

    if (flags.length) {
      await db.ref(`devices/${deviceId}/alerts`).push({
        type: "heuristic",
        flags,
        score: Math.min(100, flags.length * 34),
        startedAt_ms: Date.now(),
        reading,
      });
    }

    res.status(200).send("ok");
  } catch (err) {
    console.error("ingestReading error:", err);
    res.status(500).send("server error");
  }
});

// --- helpers ---
function toNum(x: any): number | null {
  if (x === null || x === undefined) return null;
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  const s = String(x).trim();
  if (!s || s.toLowerCase() === "null") return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

function isQuietHours(): boolean {
  const h = new Date().getHours();
  return h >= 23 || h < 5; // 11pm–5am
}
