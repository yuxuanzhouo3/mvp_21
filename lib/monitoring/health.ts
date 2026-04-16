// lib/health.ts - Health check utilities
import pkg from "../../package.json";
import { getOAuthReadinessSnapshot } from "@/lib/config/third-party-capabilities";

export function checkHealth() {
  try {
    const uptime = process.uptime();
    const oauth = getOAuthReadinessSnapshot();

    return {
      status: "ok",
      uptime,
      time: new Date().toISOString(),
      version: pkg?.version ?? "unknown",
      readiness: {
        oauth,
      },
    };
  } catch (e) {
    // keep it serializable
    return { status: "error", error: String(e) };
  }
}
