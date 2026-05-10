/**
 * Recognition service factory.
 *
 * Rayzam supports API-backed recognition services suitable for short
 * microphone recordings.
 */

import { RecognitionService, RecognitionServiceType } from "./types";
import { AudDService } from "./audd";
import { ACRCloudService } from "./acrcloud";
import { getPreferences } from "../utils/preferences";

export function createRecognitionService(serviceOverride?: RecognitionServiceType): RecognitionService {
  const preferences = getPreferences();
  const service = serviceOverride || preferences.service || RecognitionServiceType.ACRCLOUD;

  console.log("[ServiceFactory] Creating service:", service);

  switch (service) {
    case RecognitionServiceType.AUDD:
      if (!preferences.auddApiKey) {
        throw new Error(
          "[AudD Configuration Missing]\n" +
            "You selected AudD as your recognition service but didn't enter an API key.\n\n" +
            "Get an API key at audd.io, then paste it in:\n" +
            "Raycast → Configure Rayzam → AudD API Key",
        );
      }
      console.log("[ServiceFactory] Using AudD with API key");
      return new AudDService(preferences.auddApiKey);

    case RecognitionServiceType.ACRCLOUD:
    default:
      if (
        !preferences.acrcloudHost ||
        !preferences.acrcloudAccessKey ||
        !preferences.acrcloudAccessSecret
      ) {
        throw new Error(
          "[ACRCloud Configuration Missing]\n" +
            "You selected ACRCloud, but its setup is incomplete.\n\n" +
            "Create an ACRCloud Audio & Video Recognition project, then paste these values in Raycast -> Configure Rayzam:\n" +
            "Host, Access Key, and Secret Key",
        );
      }
      console.log("[ServiceFactory] Using ACRCloud");
      return new ACRCloudService(
        preferences.acrcloudAccessKey,
        preferences.acrcloudAccessSecret,
        preferences.acrcloudHost,
        preferences.acrcloudMetadataToken,
        preferences.acrcloudMetadataHost,
      );
  }
}

export * from "./types";
