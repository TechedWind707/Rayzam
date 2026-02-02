/**
 * Service factory - creates the appropriate recognition service based on user preferences
 */

import { MusicRecognitionService, RecognitionService } from "./types";
import { ShazamioService } from "./shazamio";
import { ACRCloudService } from "./acrcloud";
import { AudDService } from "./audd";

export interface ServiceConfig {
  service: RecognitionService;
  acrcloudAccessKey?: string;
  acrcloudAccessSecret?: string;
  auddApiToken?: string;
}

export class ServiceFactory {
  static createService(config: ServiceConfig): MusicRecognitionService {
    console.log("[ServiceFactory] Creating service for:", config.service);

    switch (config.service) {
      case RecognitionService.ACRCLOUD:
        console.log("[ServiceFactory] Validating ACRCloud credentials...");
        if (!config.acrcloudAccessKey || !config.acrcloudAccessSecret) {
          console.error("[ServiceFactory] Missing ACRCloud credentials");
          throw new Error("ACRCloud credentials are required");
        }
        console.log("[ServiceFactory] ACRCloud service created");
        return new ACRCloudService(
          config.acrcloudAccessKey,
          config.acrcloudAccessSecret
        );

      case RecognitionService.AUDD:
        console.log("[ServiceFactory] Validating AudD credentials...");
        if (!config.auddApiToken) {
          console.error("[ServiceFactory] Missing AudD API token");
          throw new Error("AudD API token is required");
        }
        console.log("[ServiceFactory] AudD service created");
        return new AudDService(config.auddApiToken);

      case RecognitionService.SHAZAMIO:
      default:
        console.log("[ServiceFactory] Shazamio service created (default)");
        return new ShazamioService();
    }
  }
}
