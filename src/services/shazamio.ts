/**
 * Shazamio API integration (free, unofficial)
 * Uses the reverse-engineered Shazam API
 */

import axios, { AxiosInstance } from "axios";
import { MusicRecognitionService, SongResult, RecognitionError, RecognitionService } from "./types";

export class ShazamioService implements MusicRecognitionService {
  private api: AxiosInstance;
  private readonly baseUrl = "https://identify-eu.music.apple.com";
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
      // Convert audio buffer to base64 for the API
      const audioData = audioBuffer.toString("base64");
      console.log("[ShazamioService] Audio converted to base64");

      // Create the fingerprint from audio
      const fingerprint = await this.generateFingerprint(audioBuffer);
      console.log("[ShazamioService] Fingerprint generated:", fingerprint.substring(0, 16) + "...");

      console.log("[ShazamioService] Sending to Shazamio API...");
      const response = await this.api.post(
        "/WebAPI/ChartGetRanking",
        {
          gn_offset: 0,
          fingerprint: fingerprint,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log("[ShazamioService] API response received");

      if (response.data?.matches?.length > 0) {
        const match = response.data.matches[0];
        console.log("[ShazamioService] Match found, parsing response...");
        const result = this.parseShazamResponse(match);
        console.log("[ShazamioService] Song recognized:", result.title, "by", result.artist);
        return result;
      }

      console.error("[ShazamioService] No matches found in response");
      throw new RecognitionError(
        "No matches found",
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
    // like Chromaprint or a similar technique
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
