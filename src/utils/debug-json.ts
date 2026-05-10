import { environment } from "@raycast/api";
import * as fs from "fs";
import * as path from "path";
import { getPreferences } from "./preferences";

function formatTimestamp(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

async function getDebugJsonDirectory(): Promise<string> {
  const prefs = getPreferences();
  const fallbackDir = path.join(environment.supportPath, "debug-json");
  const preferredDir = prefs.debugJsonDirectory;

  if (!preferredDir) {
    return fallbackDir;
  }

  try {
    const stats = await fs.promises.stat(preferredDir);
    if (stats.isDirectory()) {
      return preferredDir;
    }

    console.warn("[DebugJson] Debug JSON path is not a directory, using fallback:", preferredDir);
  } catch (err) {
    console.warn("[DebugJson] Debug JSON directory unavailable, using fallback:", err);
  }

  return fallbackDir;
}

export async function saveDebugJson(
  service: string,
  label: string,
  payload: unknown
): Promise<void> {
  const prefs = getPreferences();
  if (!prefs.enableDebugJson) {
    return;
  }

  try {
    const debugDir = await getDebugJsonDirectory();
    await fs.promises.mkdir(debugDir, { recursive: true });

    const fileName = `rayzam-${formatTimestamp()}-${service}-${label}.json`;
    const filePath = path.join(debugDir, fileName);
    await fs.promises.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
    console.log("[DebugJson] Provider response saved to:", filePath);
  } catch (err) {
    console.warn("[DebugJson] Failed to save provider response:", err);
  }
}
