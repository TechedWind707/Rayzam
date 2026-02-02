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
    switch (config.service) {
      case RecognitionService.ACRCLOUD:
        if (!config.acrcloudAccessKey || !config.acrcloudAccessSecret) {
          throw new Error("ACRCloud credentials are required");
        }
        return new ACRCloudService(
          config.acrcloudAccessKey,
          config.acrcloudAccessSecret
        );

      case RecognitionService.AUDD:
        if (!config.auddApiToken) {
          throw new Error("AudD API token is required");
        }
        return new AudDService(config.auddApiToken);

      case RecognitionService.SHAZAMIO:
      default:
        return new ShazamioService();
    }
  }
}
