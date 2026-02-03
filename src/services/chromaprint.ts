/**
 * Chromaprint + AcoustID recognition service (free)
 */

import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";
import fetch from "node-fetch";
import fs from "fs";
import { RecognitionService, SongResult, RecognitionError, RecognitionServiceType } from "./types";

const execFileAsync = promisify(execFile);
const DEFAULT_ACOUSTID_API_KEY = "6Ch2a1vGSl";
const LOG_FILE_CANDIDATES = [path.resolve(process.cwd(), "songsnap.log"), path.resolve(__dirname, "songsnap.log")];

const logToFile = (message: string): void => {
  const timestamp = new Date().toISOString();
  for (const logPath of LOG_FILE_CANDIDATES) {
    try {
      fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
      return;
    } catch {
      // Try next candidate
    }
  }
};

export class ChromaprintService implements RecognitionService {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || DEFAULT_ACOUSTID_API_KEY;
  }

  private getBinaryPath(): string {
    const platform = os.platform();
    let binaryName: string;

    switch (platform) {
      case "win32":
        binaryName = "fpcalc.exe";
        break;
      case "darwin":
        binaryName = "fpcalc-mac";
        break;
      case "linux":
        binaryName = "fpcalc-linux";
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    const candidates = [
      path.resolve(__dirname, "bin", binaryName),
      path.resolve(__dirname, "..", "bin", binaryName),
      path.resolve(__dirname, "..", "..", "bin", binaryName),
      path.resolve(__dirname, "..", "..", "..", "bin", binaryName),
      path.resolve(process.cwd(), "bin", binaryName),
    ];

    const resolved = candidates.find((candidate) => fs.existsSync(candidate));
    if (!resolved) {
      logToFile(`[ChromaprintService] fpcalc not found. Candidates: ${candidates.join(", ")}`);
      throw new Error(`fpcalc binary not found. Looked in: ${candidates.join(", ")}`);
    }

    return resolved;
  }

  async recognize(audioPath: string): Promise<SongResult> {
    console.log("[ChromaprintService] Starting recognition for:", audioPath);
    logToFile(`[ChromaprintService] Starting recognition for: ${audioPath}`);

    try {
      const fpcalcPath = this.getBinaryPath();
      console.log("[ChromaprintService] Using binary:", fpcalcPath);
      logToFile(`[ChromaprintService] Using binary: ${fpcalcPath}`);

      const { stdout } = await execFileAsync(fpcalcPath, ["-json", audioPath], {
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
      });
      const fpData = JSON.parse(stdout) as { duration: number; fingerprint: string };

      console.log("[ChromaprintService] Fingerprint generated, duration:", fpData.duration);
      logToFile(`[ChromaprintService] Fingerprint generated, duration: ${fpData.duration}`);

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
      logToFile("[ChromaprintService] API response received.");

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
      logToFile(`[ChromaprintService] Match found: ${recording.title} by ${artist}`);

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
      logToFile(
        `[ChromaprintService] Recognition failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw new RecognitionError(
        `Chromaprint recognition failed: ${error instanceof Error ? error.message : String(error)}`,
        RecognitionServiceType.CHROMAPRINT,
        error instanceof Error ? error : undefined
      );
    }
  }
}
