/**
 * Preferences management utilities
 */

import { getPreferenceValues } from "@raycast/api";
import { RecognitionService } from "../services/types";

export interface Preferences {
  recognitionService: RecognitionService;
  acrcloudAccessKey?: string;
  acrcloudAccessSecret?: string;
  auddApiToken?: string;
  recordingDuration: number;
}

export function getPreferences(): Preferences {
  console.log("[Preferences] Loading preferences...");
  const prefs = getPreferenceValues<Record<string, unknown>>();

  const result: Preferences = {
    recognitionService: (prefs.recognitionService as RecognitionService) || RecognitionService.SHAZAMIO,
    acrcloudAccessKey: (prefs.acrcloudAccessKey as string) || undefined,
    acrcloudAccessSecret: (prefs.acrcloudAccessSecret as string) || undefined,
    auddApiToken: (prefs.auddApiToken as string) || undefined,
    recordingDuration: parseInt(prefs.recordingDuration as string) || 5,
  };

  console.log("[Preferences] Loaded preferences:", {
    recognitionService: result.recognitionService,
    recordingDuration: result.recordingDuration,
    hasAcrCloudKey: !!result.acrcloudAccessKey,
    hasAcrCloudSecret: !!result.acrcloudAccessSecret,
    hasAudDToken: !!result.auddApiToken,
  });

  return result;
}

export function validatePreferences(prefs: Preferences): string | null {
  console.log("[Preferences] Validating preferences...");

  if (prefs.recordingDuration < 3 || prefs.recordingDuration > 15) {
    console.error("[Preferences] Invalid recording duration:", prefs.recordingDuration);
    return "Recording duration must be between 3 and 15 seconds";
  }

  if (prefs.recognitionService === RecognitionService.ACRCLOUD) {
    if (!prefs.acrcloudAccessKey || !prefs.acrcloudAccessSecret) {
      console.error("[Preferences] ACRCloud selected but credentials missing");
      return "ACRCloud Access Key and Secret are required when using ACRCloud service";
    }
    console.log("[Preferences] ACRCloud credentials present");
  }

  if (prefs.recognitionService === RecognitionService.AUDD) {
    if (!prefs.auddApiToken) {
      console.error("[Preferences] AudD selected but token missing");
      return "AudD API Token is required when using AudD service";
    }
    console.log("[Preferences] AudD token present");
  }

  console.log("[Preferences] Validation passed");
  return null;
}
