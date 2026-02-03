/**
 * AudD API integration (official)
 * Requires API token
 */

import axios, { AxiosInstance } from "axios";
import * as fs from "fs";
import { RecognitionService, SongResult, RecognitionError, RecognitionServiceType } from "./types";

export class AudDService implements RecognitionService {
  private api: AxiosInstance;
  private apiToken: string;
  private readonly baseUrl = "https://api.audd.io";
  private readonly timeout = 30000;

  constructor(apiToken: string) {
    this.apiToken = apiToken;

    this.api = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
    });
  }

  async recognize(audioPath: string): Promise<SongResult> {
    try {
      const audioBuffer = await fs.promises.readFile(audioPath);
      console.log("[AudDService] Starting recognition, audio buffer size:", audioBuffer.length, "bytes");

      const formData = new FormData();
      const blob = new Blob([audioBuffer], { type: "audio/wav" });
      formData.append("file", blob);
      formData.append("api_token", this.apiToken);
      formData.append("return", "spotify,itunes,deezer");

      console.log("[AudDService] Sending audio to AudD API...");
      console.log("[AudDService] Blob size:", blob.size, "bytes");

      const response = await this.api.post("/recognize", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      console.log("[AudDService] API response received:", response.data);

      if (response.data?.result) {
        console.log("[AudDService] Match found! Parsing response...");
        return this.parseAudDResponse(response.data.result);
      }

      const errorMsg = response.data?.error || "No matches found";
      console.error("[AudDService] No match:", errorMsg);
      throw new RecognitionError(errorMsg, RecognitionServiceType.AUDD);
    } catch (error) {
      console.error("[AudDService] Recognition error:", error);
      if (error instanceof RecognitionError) {
        throw error;
      }
      throw new RecognitionError(
        `Recognition failed: ${error instanceof Error ? error.message : String(error)}`,
        RecognitionServiceType.AUDD,
        error instanceof Error ? error : undefined
      );
    }
  }

  private parseAudDResponse(result: Record<string, unknown>): SongResult {
    const spotifyData = result.spotify as Record<string, unknown> | undefined;
    const itunesData = result.itunes as Record<string, unknown> | undefined;
    const releaseYear = result.release_date ? new Date(result.release_date as string).getFullYear() : undefined;

    return {
      title: (result.title as string) || "Unknown",
      artist: (result.artist as string) || "Unknown Artist",
      album: (result.album as string) || undefined,
      year: releaseYear ? releaseYear.toString() : undefined,
      releaseYear,
      duration: (result.duration as number) || undefined,
      isrc: (result.isrc as string) || undefined,
      spotifyId: (spotifyData?.id as string) || undefined,
      youtubeUrl: (result.youtube_video as Record<string, unknown>)?.url as string,
      appleMusicUrl: (itunesData?.id as string)
        ? `https://music.apple.com/search?term=${encodeURIComponent(result.title as string)}`
        : undefined,
      confidence: (result.confidence as number) || undefined,
      rawData: result,
    };
  }
}
