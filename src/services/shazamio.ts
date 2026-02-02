/**
 * Shazamio API integration (free, unofficial)
 * Uses the Shazam API through a community endpoint
 */

import axios, { AxiosInstance } from "axios";
import { MusicRecognitionService, SongResult, RecognitionError, RecognitionService } from "./types";

export class ShazamioService implements MusicRecognitionService {
  private api: AxiosInstance;
  private readonly baseUrl = "https://shazam.p.rapidapi.com";
  private readonly timeout = 30000;

  constructor() {
    this.api = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });
  }

  async recognize(audioBuffer: Buffer): Promise<SongResult> {
    console.log("[ShazamioService] Starting recognition, audio buffer size:", audioBuffer.length);
    try {
      // For now, we'll use a simpler approach since the official Shazam API requires authentication
      // This is a placeholder that would need real audio fingerprinting
      console.log("[ShazamioService] Note: Full fingerprinting requires additional setup");
      
      // Since we can't do real recognition without proper API setup,
      // return a demo result or throw informative error
      throw new RecognitionError(
        "Shazamio service requires API authentication setup. For now, using fallback.",
        RecognitionService.SHAZAMIO
      );
    } catch (error) {
      console.error("[ShazamioService] Recognition error:", error);
      if (error instanceof RecognitionError) {
        throw error;
      }
      throw new RecognitionError(
        `Recognition failed: ${error instanceof Error ? error.message : String(error)}`,
        RecognitionService.SHAZAMIO,
        error instanceof Error ? error : undefined
      );
    }
  }

  private async generateFingerprint(audioBuffer: Buffer): Promise<string> {
    // Simplified fingerprint generation
    // In production, this would use a proper audio fingerprinting algorithm
    // like Chromaprint or similar
    const hash = require("crypto").createHash("sha256");
    hash.update(audioBuffer);
    return hash.digest("hex").substring(0, 32);
  }

  private parseShazamResponse(match: Record<string, unknown>): SongResult {
    const metadata = (match.metadata || {}) as Record<string, unknown>;

    return {
      title: (metadata.title as string) || "Unknown",
      artist: (Array.isArray(metadata.artists) ? (metadata.artists[0] as any)?.name : undefined) || "Unknown Artist",
      album: ((metadata.album as any)?.name as string) || undefined,
      releaseYear: metadata.releaseDate
        ? new Date(metadata.releaseDate as string).getFullYear()
        : undefined,
      albumArtUrl: ((metadata.artwork as any)?.url as string) || undefined,
      isrc: (metadata.isrc as string) || undefined,
      confidence: (match.score as number) || undefined,
      rawData: match,
    };
  }
}
