/**
 * Service factory - creates the appropriate recognition service based on user preferences
 */

import { RecognitionService, RecognitionServiceType } from "./types";
import { ChromaprintService } from "./chromaprint";
import { AudDService } from "./audd";
import { ACRCloudService } from "./acrcloud";
import { getPreferences } from "../utils/preferences";

export function createRecognitionService(): RecognitionService {
  const preferences = getPreferences();
  const service = preferences.service || RecognitionServiceType.CHROMAPRINT;

  console.log("[ServiceFactory] Creating service:", service);

  switch (service) {
    case RecognitionServiceType.CHROMAPRINT:
      console.log("[ServiceFactory] Using FREE Chromaprint + AcoustID");
      return new ChromaprintService(preferences.acoustIdApiKey);

    case RecognitionServiceType.AUDD:
      if (!preferences.auddApiKey) {
        console.warn("[ServiceFactory] AudD selected but no API key, falling back to Chromaprint");
        return new ChromaprintService(preferences.acoustIdApiKey);
      }
      console.log("[ServiceFactory] Using AudD with API key");
      return new AudDService(preferences.auddApiKey);

    case RecognitionServiceType.ACRCLOUD:
      if (!preferences.acrcloudAccessKey || !preferences.acrcloudAccessSecret) {
        console.warn("[ServiceFactory] ACRCloud selected but credentials missing, falling back to Chromaprint");
        return new ChromaprintService(preferences.acoustIdApiKey);
      }
      console.log("[ServiceFactory] Using ACRCloud");
      return new ACRCloudService(
        preferences.acrcloudAccessKey,
        preferences.acrcloudAccessSecret,
        preferences.acrcloudHost || "identify-eu-west-1.acrcloud.com"
      );

    default:
      console.log("[ServiceFactory] Unknown service, defaulting to Chromaprint");
      return new ChromaprintService(preferences.acoustIdApiKey);
  }
}

export * from "./types";
