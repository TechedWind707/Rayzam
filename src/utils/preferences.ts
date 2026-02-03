/**
 * Preferences management utilities
 */

import { getPreferenceValues } from "@raycast/api";
import { RecognitionServiceType } from "../services/types";

export interface Preferences {
  service: RecognitionServiceType;
  recordingDuration: number;
  auddApiKey?: string;
  acrcloudAccessKey?: string;
  acrcloudAccessSecret?: string;
  acrcloudHost?: string;
  acoustIdApiKey?: string;
}

export function getPreferences(): Preferences {
  console.log("[Preferences] Loading preferences...");

  const prefs = getPreferenceValues<Preferences>();

  const preferences: Preferences = {
    service: prefs.service || RecognitionServiceType.CHROMAPRINT,
    recordingDuration: Number(prefs.recordingDuration) || 15,
    auddApiKey: prefs.auddApiKey,
    acrcloudAccessKey: prefs.acrcloudAccessKey,
    acrcloudAccessSecret: prefs.acrcloudAccessSecret,
    acrcloudHost: prefs.acrcloudHost,
    acoustIdApiKey: prefs.acoustIdApiKey,
  };

  console.log("[Preferences] Loaded:", {
    service: preferences.service,
    duration: preferences.recordingDuration,
    hasAuddKey: !!preferences.auddApiKey,
    hasACRCloudKey: !!preferences.acrcloudAccessKey,
    hasACRCloudSecret: !!preferences.acrcloudAccessSecret,
    hasAcoustIdKey: !!preferences.acoustIdApiKey,
  });

  return preferences;
}

export function validatePreferences(prefs: Preferences): string | null {
  console.log("[Preferences] Validating preferences...");

  if (prefs.recordingDuration < 3 || prefs.recordingDuration > 15) {
    console.error("[Preferences] Invalid recording duration:", prefs.recordingDuration);
    return "Recording duration must be between 3 and 15 seconds";
  }

  console.log("[Preferences] Validation passed");
  return null;
}
