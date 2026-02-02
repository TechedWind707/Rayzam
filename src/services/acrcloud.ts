/**
 * ACRCloud API integration (official)
 * Requires API key and secret
 */

import axios, { AxiosInstance } from "axios";
import crypto from "crypto-js";
import { MusicRecognitionService, SongResult, RecognitionError, RecognitionService } from "./types";

export class ACRCloudService implements MusicRecognitionService {
  private api: AxiosInstance;
  private accessKey: string;
  private accessSecret: string;
  private readonly baseUrl = "https://identify-us.acrcloud.com";
  private readonly timeout = 30000;

  constructor(accessKey: string, accessSecret: string) {
    this.accessKey = accessKey;
    this.accessSecret = accessSecret;

    this.api = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
  }

  async recognize(audioBuffer: Buffer): Promise<SongResult> {
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = this.generateSignature(audioBuffer, timestamp);

      const formData = new URLSearchParams();
      formData.append("client_id", this.accessKey);
      formData.append("client_secret", this.accessSecret);
      formData.append("timestamp", timestamp);
      formData.append("signature", signature);
      formData.append("data_type", "audio");
      formData.append("audio_format", "wav");
      formData.append("file_fields", "title,artists,album,genres,duration");
      formData.append(
        "access_key",
        this.accessKey
      );

      const response = await this.api.post("/v1/identify", formData);

      if (response.data?.metadata?.music?.length > 0) {
        return this.parseACRCloudResponse(response.data.metadata.music[0]);
      }

      throw new RecognitionError(
        "No matches found",
        RecognitionService.ACRCLOUD
      );
    } catch (error) {
      if (error instanceof RecognitionError) {
        throw error;
      }
      throw new RecognitionError(
        `Recognition failed: ${error instanceof Error ? error.message : String(error)}`,
        RecognitionService.ACRCLOUD,
        error instanceof Error ? error : undefined
      );
    }
  }

  private generateSignature(audioBuffer: Buffer, timestamp: string): string {
    const shaObj = crypto.SHA1(audioBuffer.toString("base64") + timestamp + this.accessSecret);
    return shaObj.toString();
  }

  private parseACRCloudResponse(music: Record<string, unknown>): SongResult {
    const artists = music.artists as Record<string, unknown>[] | undefined;
    const album = music.album as Record<string, unknown> | undefined;

    return {
      title: (music.title as string) || "Unknown",
      artist: artists?.[0]?.name as string || "Unknown Artist",
      album: (album?.name as string) || undefined,
      releaseYear: album?.release_date
        ? new Date(album.release_date as string).getFullYear()
        : undefined,
      duration: (music.duration as number) || undefined,
      isrc: (music.isrc as string) || undefined,
      confidence: (music.score as number) / 100,
      rawData: music,
    };
  }
}
