/**
 * ─────────────────────────────────────────────────────────────────
 * shazamio.ts  —  A placeholder for a Shazam-style service
 * ─────────────────────────────────────────────────────────────────
 *
 * Originally this was going to integrate with an unofficial Shazam
 * API.  That approach was eventually dropped in favour of Chromaprint
 * (which is free and open-source).
 *
 * The class is kept here as a "stub" — it exists, it compiles, it
 * satisfies TypeScript's type requirements, but under the hood it
 * simply delegates everything to ChromaprintService.
 *
 * Real-world analogy: imagine a store says "we accept PayPal" on the
 * door, but when you try to pay with PayPal the cashier says "we
 * actually just process it through Visa for you."  The interface is
 * preserved even though the implementation changed.
 * ─────────────────────────────────────────────────────────────────
 */

// Import the shared contract (interface) and the SongResult type
import { RecognitionService, SongResult } from "./types";

// Import Chromaprint — the service we actually delegate to
import { ChromaprintService } from "./chromaprint";

export class ShazamioService implements RecognitionService {
  // Create an internal instance of ChromaprintService.
  // 'private' means only code inside this class can use it.
  private chromaprint = new ChromaprintService();

  /**
   * recognize
   *
   * The only method required by the RecognitionService contract.
   * We just forward the call straight to Chromaprint.
   *
   * @param audioPath  Path to the recorded audio file on disk
   * @returns          Song info (title, artist, album, etc.)
   */
  async recognize(audioPath: string): Promise<SongResult> {
    console.log("[ShazamioService] Redirecting to Chromaprint (Shazamio not implemented)");
    return this.chromaprint.recognize(audioPath);
  }
}
