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
  const prefs = getPreferenceValues<Record<string, unknown>>();

  return {
    recognitionService: (prefs.recognitionService as RecognitionService) || RecognitionService.SHAZAMIO,
    acrcloudAccessKey: (prefs.acrcloudAccessKey as string) || undefined,
    acrcloudAccessSecret: (prefs.acrcloudAccessSecret as string) || undefined,
    auddApiToken: (prefs.auddApiToken as string) || undefined,
    recordingDuration: parseInt(prefs.recordingDuration as string) || 5,
  };
}

export function validatePreferences(prefs: Preferences): string | null {
  if (prefs.recordingDuration < 3 || prefs.recordingDuration > 15) {
    return "Recording duration must be between 3 and 15 seconds";
  }

  if (prefs.recognitionService === RecognitionService.ACRCLOUD) {
    if (!prefs.acrcloudAccessKey || !prefs.acrcloudAccessSecret) {
      return "ACRCloud Access Key and Secret are required when using ACRCloud service";
    }
  }

  if (prefs.recognitionService === RecognitionService.AUDD) {
    if (!prefs.auddApiToken) {
      return "AudD API Token is required when using AudD service";
    }
  }

  return null;
}
