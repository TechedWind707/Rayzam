/**
 * Chromaprint + AcoustID recognition service (free)
 */

import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";
import fetch from "node-fetch";
import { RecognitionService, SongResult, RecognitionError, RecognitionServiceType } from "./types";

const execAsync = promisify(exec);
const DEFAULT_ACOUSTID_API_KEY = "6Ch2a1vGSl";

export class ChromaprintService implements RecognitionService {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || DEFAULT_ACOUSTID_API_KEY;
  }

  private getBinaryPath(): string {
    const platform = os.platform();
    const binDir = path.join(__dirname, "../../bin");

    switch (platform) {
      case "win32":
        return path.join(binDir, "fpcalc.exe");
      case "darwin":
        return path.join(binDir, "fpcalc-mac");
      case "linux":
        return path.join(binDir, "fpcalc-linux");
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  async recognize(audioPath: string): Promise<SongResult> {
    console.log("[ChromaprintService] Starting recognition for:", audioPath);

    try {
      const fpcalcPath = this.getBinaryPath();
      console.log("[ChromaprintService] Using binary:", fpcalcPath);

      const { stdout } = await execAsync(`"${fpcalcPath}" -json "${audioPath}"`);
      const fpData = JSON.parse(stdout) as { duration: number; fingerprint: string };

      console.log("[ChromaprintService] Fingerprint generated, duration:", fpData.duration);

      const params = new URLSearchParams({
        client: this.apiKey,
        duration: fpData.duration.toString(),
        fingerprint: fpData.fingerprint,
        meta: "recordings releasegroups compress",
      });

      const response = await fetch(`https://api.acoustid.org/v2/lookup?${params.toString()}`);
      const data = (await response.json()) as {
        results?: Array<{
          score: number;
          recordings?: Array<{
            title: string;
            artists?: Array<{ name: string }>;
            releasegroups?: Array<{ title: string; date?: string }>;
            isrcs?: string[];
          }>;
        }>;
      };

      console.log("[ChromaprintService] API response:", JSON.stringify(data, null, 2));

      if (!data.results || data.results.length === 0) {
        throw new Error("No matches found");
      }

      const result = data.results[0];

      if (!result.recordings || result.recordings.length === 0) {
        throw new Error("No recording metadata found");
      }

      const recording = result.recordings[0];
      const artist = recording.artists?.[0]?.name || "Unknown Artist";
      const album = recording.releasegroups?.[0]?.title || null;
      const year = recording.releasegroups?.[0]?.date?.split("-")[0] || null;

      console.log("[ChromaprintService] Match found:", recording.title, "by", artist);

      return {
        title: recording.title,
        artist,
        album,
        year,
        releaseYear: year ? Number(year) : undefined,
        genre: null,
        confidence: result.score,
        isrc: recording.isrcs?.[0] || null,
        duration: fpData.duration,
        rawData: data as Record<string, unknown>,
      };
    } catch (error) {
      console.error("[ChromaprintService] Recognition failed:", error);
      throw new RecognitionError(
        `Chromaprint recognition failed: ${error instanceof Error ? error.message : String(error)}`,
        RecognitionServiceType.CHROMAPRINT,
        error instanceof Error ? error : undefined
      );
    }
  }
}
