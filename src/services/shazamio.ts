/**
 * Shazamio API integration (free, unofficial)
 * Redirected to Chromaprint + AcoustID
 */

import { RecognitionService, SongResult } from "./types";
import { ChromaprintService } from "./chromaprint";

export class ShazamioService implements RecognitionService {
  private chromaprint = new ChromaprintService();

  async recognize(audioPath: string): Promise<SongResult> {
    console.log("[ShazamioService] Redirecting to Chromaprint (Shazamio not implemented)");
    return this.chromaprint.recognize(audioPath);
  }
}
