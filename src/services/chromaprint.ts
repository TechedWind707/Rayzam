/**
 * ─────────────────────────────────────────────────────────────────
 * chromaprint.ts  —  FREE song recognition using audio fingerprinting
 * ─────────────────────────────────────────────────────────────────
 *
 * This is the default (and free!) recognition service.  It works in
 * two steps:
 *
 *   STEP 1 — FINGERPRINTING (fpcalc)
 *   We run a small helper program called "fpcalc" on the recorded
 *   audio.  fpcalc listens to the audio and produces a "fingerprint"
 *   — a short string of numbers that uniquely describes the melody
 *   and rhythm.  Think of it like a DNA profile: two recordings of
 *   the same song will produce almost identical fingerprints.
 *
 *   STEP 2 — DATABASE LOOKUP (AcoustID)
 *   We send that fingerprint to AcoustID (acoustid.org), a free,
 *   community-maintained database that matches fingerprints to
 *   song titles.  Think of it like a reverse phone book: you give
 *   the "number" (fingerprint) and get back the "name" (song info).
 *
 * No API key needed for basic usage — a shared key is included.
 * Users can register for their own free key at acoustid.org.
 * ─────────────────────────────────────────────────────────────────
 */

// execFile runs an external program (fpcalc) and captures its output
import { execFile } from "child_process";
import { promisify } from "util"; // Converts callback-based functions to Promise-based
import path from "path";          // Helps build file paths that work on any OS
import os from "os";              // Gives us info about the current operating system
import fetch from "node-fetch";   // fetch() for Node.js — makes HTTP requests like a browser would
import fs from "fs";              // File system — read, write, check if files exist
import { environment } from "@raycast/api"; // Raycast's info about the current extension (paths, etc.)
import { RecognitionService, SongResult, RecognitionError, RecognitionServiceType } from "./types";

// promisify turns execFile (which uses old-style callbacks) into an async function
const execFileAsync = promisify(execFile);

// A built-in shared AcoustID key — it works but has rate limits shared among all SongSnap users
const DEFAULT_ACOUSTID_API_KEY = "6Ch2a1vGSl";

// Two places we try to write log files — Raycast's own support folder, then the project folder
const LOG_FILE_PATHS = [
  path.join(environment.supportPath, "songsnap.log"),
  path.resolve(process.cwd(), "songsnap.log"),
];

/**
 * logToFile
 *
 * Appends a timestamped message to a log file on disk.
 * Useful for debugging issues that don't show up in the console.
 * We try multiple paths and silently ignore errors — logging failure
 * should never crash the app.
 */
const logToFile = (message: string): void => {
  const timestamp = new Date().toISOString(); // e.g. "2026-02-18T01:00:00.000Z"
  for (const logPath of LOG_FILE_PATHS) {
    try {
      // Create the folder if it doesn't exist yet (recursive = create parent folders too)
      fs.mkdirSync(path.dirname(logPath), { recursive: true });
      // Append to the file (creates it if it doesn't exist)
      fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
    } catch {
      // Ignore — if we can't log, we carry on regardless
    }
  }
};

export class ChromaprintService implements RecognitionService {
  private apiKey: string; // The AcoustID API key to use for lookups

  constructor(apiKey?: string) {
    // Use the provided key, or fall back to the shared default
    this.apiKey = apiKey || DEFAULT_ACOUSTID_API_KEY;
  }

  /**
   * getBinaryPath  (private)
   *
   * Finds the fpcalc binary (the audio fingerprinting program) for
   * the current operating system.
   *
   * We ship three versions of fpcalc inside the extension's assets:
   *   assets/bin/fpcalc.exe       (Windows)
   *   assets/bin/fpcalc-mac       (macOS)
   *   assets/bin/fpcalc-linux     (Linux)
   *
   * This method figures out which one to use and confirms it exists on disk.
   */
  private getBinaryPath(): string {
    const platform = os.platform(); // "win32", "darwin", or "linux"

    // Pick the right filename for this OS
    let binaryName: string;
    switch (platform) {
      case "win32":  binaryName = "fpcalc.exe";   break;
      case "darwin": binaryName = "fpcalc-mac";   break;
      case "linux":  binaryName = "fpcalc-linux"; break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    // List of places to look for the binary — we try them in order
    // because Raycast can run extensions from different locations depending on
    // whether you're developing locally or using the published extension
    const candidates = [
      path.join(environment.assetsPath, "bin", binaryName),
      path.join(environment.assetsPath, binaryName),
      path.resolve(process.cwd(), "assets", "bin", binaryName),
      path.resolve(process.cwd(), "bin", binaryName),
      path.resolve(__dirname, "..", "..", "assets", "bin", binaryName),
      path.resolve(__dirname, "..", "..", "..", "assets", "bin", binaryName),
    ];

    // fs.existsSync returns true if the path exists on disk right now
    const resolved = candidates.find((candidate) => fs.existsSync(candidate));

      if (!resolved) {
        logToFile(`[ChromaprintService] fpcalc not found. Candidates: ${candidates.join(", ")}`);
        throw new Error("fpcalc_not_found");
      }

    return resolved;
  }

  /**
   * recognize
   *
   * The main method.  Given a path to a recorded .wav file,
   * fingerprints it and looks it up in AcoustID.
   */
  async recognize(audioPath: string): Promise<SongResult> {
    console.log("[ChromaprintService] Starting recognition for:", audioPath);
    logToFile(`[ChromaprintService] Starting recognition for: ${audioPath}`);

    try {
      // ── Step 1: Run fpcalc to generate a fingerprint ─────────────────────
      const fpcalcPath = this.getBinaryPath();
      console.log("[ChromaprintService] Using binary:", fpcalcPath);
      logToFile(`[ChromaprintService] Using binary: ${fpcalcPath}`);

      // Run fpcalc with the audio file.  "-json" makes it output JSON.
      // The result looks like: { "duration": 214.5, "fingerprint": "AQAAjk..." }
      const { stdout } = await execFileAsync(fpcalcPath, ["-json", audioPath], {
        maxBuffer: 10 * 1024 * 1024, // Allow up to 10 MB of output (fingerprints can be large)
        windowsHide: true,           // Don't flash a command-prompt window on Windows
      });

      // Parse the JSON text output into a JavaScript object
      const fpData = JSON.parse(stdout) as { duration: number; fingerprint: string };
      console.log("[ChromaprintService] Fingerprint generated, duration:", fpData.duration);
      logToFile(`[ChromaprintService] Fingerprint generated, duration: ${fpData.duration}`);

      // ── Step 2: Look up the fingerprint on AcoustID ───────────────────────
      // URLSearchParams builds a query string: "?client=KEY&duration=214&fingerprint=AQ..."
      const params = new URLSearchParams({
        client:      this.apiKey,
        duration:    fpData.duration.toString(),
        fingerprint: fpData.fingerprint,
        // "meta" tells AcoustID what extra info to include in the response
        meta: "recordings releasegroups compress",
      });

      // Send an HTTP GET request to AcoustID
      const response = await fetch(`https://api.acoustid.org/v2/lookup?${params.toString()}`);

      // Parse the JSON response body
      // The 'as {...}' part is TypeScript type assertion — we're telling TypeScript
      // the exact shape of the response so it can help us access fields safely
      const data = (await response.json()) as {
        results?: Array<{
          score: number; // How confident AcoustID is (0.0–1.0)
          recordings?: Array<{
            title: string;
            artists?:       Array<{ name: string }>;
            releasegroups?: Array<{ title: string; date?: string }>;
            isrcs?:         string[];
          }>;
        }>;
      };

      console.log("[ChromaprintService] API response:", JSON.stringify(data, null, 2));
      logToFile("[ChromaprintService] API response received.");

      // ── Step 3: Extract the best match ───────────────────────────────────
      if (!data.results || data.results.length === 0) {
        throw new Error("No matches found");
      }

      const result = data.results[0]; // First result = best score

      if (!result.recordings || result.recordings.length === 0) {
        throw new Error("No recording metadata found");
      }

      const recording = result.recordings[0]; // First recording for this fingerprint

      // Pull out individual fields, with fallbacks if the data is missing
      const artist = recording.artists?.[0]?.name || "Unknown Artist";
      const album  = recording.releasegroups?.[0]?.title || null;
      // AcoustID dates look like "1975-10-31"; we just want "1975"
      const year   = recording.releasegroups?.[0]?.date?.split("-")[0] || null;

      console.log("[ChromaprintService] Match found:", recording.title, "by", artist);
      logToFile(`[ChromaprintService] Match found: ${recording.title} by ${artist}`);

      // Build and return a SongResult in our standard shape
      return {
        title:       recording.title,
        artist,
        album,
        year,
        releaseYear: year ? Number(year) : undefined,
        genre:       null,
        confidence:  result.score,
        isrc:        recording.isrcs?.[0] || null, // ISRC = international recording code
        duration:    fpData.duration,
        rawData:     data as Record<string, unknown>, // Kept for debugging
      };

    } catch (error) {
      const rawMsg = error instanceof Error ? error.message : String(error);
      console.error("[ChromaprintService] Recognition failed:", rawMsg);
      logToFile(`[ChromaprintService] Recognition failed: ${rawMsg}`);

      // Re-throw our own errors unchanged
      if (error instanceof RecognitionError) throw error;

      // Map internal sentinel strings and known patterns to plain-English messages
      let friendlyMsg: string;
      if (rawMsg === "fpcalc_not_found") {
        friendlyMsg =
          "The audio fingerprinting tool (fpcalc) could not be found.\n" +
          "Try reinstalling the SongSnap extension.";
      } else if (rawMsg === "No matches found") {
        // Propagate as-is — identify-song.tsx handles "no matches" as a separate state
        friendlyMsg = "No matches found";
      } else if (rawMsg === "No recording metadata found") {
        friendlyMsg = "The audio was fingerprinted but no song information was found. Try a longer recording.";
      } else if (rawMsg.includes("ENOTFOUND") || rawMsg.includes("ECONNREFUSED") || rawMsg.includes("fetch")) {
        friendlyMsg = "Could not reach the AcoustID server. Please check your internet connection and try again.";
      } else if (rawMsg.includes("timeout") || rawMsg.includes("ETIMEDOUT")) {
        friendlyMsg = "The AcoustID request timed out. Please check your internet connection and try again.";
      } else if (rawMsg.includes("Unsupported platform")) {
        friendlyMsg = `Your operating system is not supported (${os.platform()}).`;
      } else if (rawMsg.includes("Permission denied") || rawMsg.includes("EACCES")) {
        friendlyMsg = "Permission was denied when trying to run fpcalc. Try reinstalling the SongSnap extension.";
      } else {
        friendlyMsg = "Song recognition failed. Please try again.";
      }

      throw new RecognitionError(friendlyMsg, RecognitionServiceType.CHROMAPRINT, error instanceof Error ? error : undefined);
    }
  }
}
