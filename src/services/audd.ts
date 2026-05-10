/**
 * ─────────────────────────────────────────────────────────────────
 * audd.ts  —  Song recognition via the AudD API
 * ─────────────────────────────────────────────────────────────────
 *
 * AudD (audd.io) is an online service that listens to an audio clip
 * and tells you the song.  Think of it like emailing a short voice
 * memo to an expert who replies "That's Bohemian Rhapsody by Queen."
 *
 * How it works:
 *   1. We read the audio file from disk into memory.
 *   2. We package it into a "form" (like a web form with file upload).
 *   3. We POST that form to AudD's server over the internet.
 *   4. AudD replies with song info as JSON.
 *   5. We translate that JSON into our standard SongResult shape.
 *
 * AudD requires an API token. Account limits and pricing are controlled
 * by AudD and can change over time.
 * ─────────────────────────────────────────────────────────────────
 */

// axios is a popular library for making HTTP requests (like fetch but richer)
import axios, { AxiosInstance } from "axios";
import * as fs from "fs"; // fs = Node's built-in "file system" module

// Import our shared types
import { RecognitionService, SongResult, RecognitionError, RecognitionServiceType } from "./types";
import { findBestArtwork } from "./artwork";
import { saveDebugJson } from "../utils/debug-json";

export class AudDService implements RecognitionService {
  // 'private' fields can only be accessed inside this class — like a locked drawer
  private api: AxiosInstance; // The pre-configured HTTP client (like a phone dialled to AudD)
  private apiToken: string; // The secret token that proves we're allowed to use AudD's API
  private readonly baseUrl = "https://api.audd.io"; // AudD's server address (readonly = never changes)
  private readonly timeout = 30000; // Give up after 30 seconds (30,000 milliseconds)

  /**
   * constructor  —  runs automatically when you write: new AudDService(token)
   *
   * Sets up the HTTP client once so every recognize() call reuses it,
   * like having a printer already plugged in rather than plugging it in
   * every time you want to print.
   */
  constructor(apiToken: string) {
    this.apiToken = apiToken;

    // axios.create() builds a configured HTTP client.
    // baseURL means every request starts at this address.
    this.api = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
    });
  }

  /**
   * recognize
   *
   * The main method — takes an audio file path, sends it to AudD,
   * and returns a SongResult.
   *
   * @param audioPath  Full path to the .wav file on disk, e.g. "C:\Temp\rayzam-123.wav"
   */
  async recognize(audioPath: string): Promise<SongResult> {
    try {
      // Step 1: Read the audio file into memory as a Buffer (raw binary data)
      // Think of a Buffer like a cardboard box containing the file's bytes
      const audioBuffer = await fs.promises.readFile(audioPath);
      console.log(
        "[AudDService] Starting recognition, audio buffer size:",
        audioBuffer.length,
        "bytes"
      );

      // Step 2: Build a FormData object — this is what web browsers use when
      // you click "Choose File" and then "Upload".  We're doing that programmatically.
      const formData = new FormData();

      // Blob wraps our raw bytes and tells the server it's a WAV audio file
      const blob = new Blob([audioBuffer], { type: "audio/wav" });
      formData.append("file", blob); // The audio clip
      formData.append("api_token", this.apiToken); // Our credentials
      // Ask AudD to also return links/artwork from Spotify, Apple Music, and Deezer.
      formData.append("return", "spotify,apple_music,deezer");

      console.log("[AudDService] Sending audio to AudD API...");
      console.log("[AudDService] Blob size:", blob.size, "bytes");

      // Step 3: POST the form to AudD's /recognize endpoint
      // POST = "I'm sending you data" (contrast with GET = "give me data")
      const response = await this.api.post("/recognize", formData, {
        headers: {
          "Content-Type": "multipart/form-data", // Tell the server how the data is packaged
        },
      });
      await saveDebugJson("audd", "recognize", response.data);

      console.log("[AudDService] API response received:", response.data);

      // Step 4: Check if AudD found a match
      if (response.data?.result) {
        console.log("[AudDService] Match found! Parsing response...");
        // Translate AudD's raw JSON into our standard SongResult shape
        const parsed = this.parseAudDResponse(response.data.result);
        return this.enrichWithFreeArtwork(parsed, response.data.result);
      }

      // AudD replied but found no match OR returned an error.
      // response.data.error can be:
      //   • a plain string  — "No result"
      //   • an object       — { error_code: 900, error_message: "authorization failed..." }
      const errorData = response.data?.error;
      let errorMsg: string;

      if (!errorData) {
        errorMsg =
          "No matches found. AudD is best for original playback and may not identify singing or humming. Try ACRCloud for humming.";
      } else if (typeof errorData === "object" && errorData !== null) {
        // Pull out AudD's error code and map it to a clean, plain-English message.
        // AudD's own error_message is verbose and technical — we replace it with
        // something a non-developer can understand and act on.
        const code = (errorData as Record<string, unknown>).error_code as number | undefined;

        switch (code) {
          case 900:
            errorMsg =
              "Your AudD API key is incorrect, invalid, or inactive.\n" +
              "Please check your account status at dashboard.audd.io — " +
              "it needs either a trial or an active subscription.";
            break;
          case 901:
            errorMsg =
              "Your AudD account has run out of recognitions.\n" +
              "Please upgrade your plan at dashboard.audd.io.";
            break;
          case 300:
            errorMsg =
              "No song was found for this recording. Try a longer sample or hold the mic closer to the speaker.";
            break;
          default: {
            // Unknown code — use AudD's own message if it's a plain string, otherwise show the code
            const rawMsg = (errorData as Record<string, unknown>).error_message;
            errorMsg =
              typeof rawMsg === "string"
                ? rawMsg
                : code != null
                  ? `AudD returned an unexpected error (code ${code}).`
                  : "An unknown error occurred with the AudD service.";
          }
        }
      } else {
        errorMsg = String(errorData);
      }

      console.error("[AudDService] API error:", errorMsg);
      throw new RecognitionError(errorMsg, RecognitionServiceType.AUDD);
    } catch (error) {
      console.error("[AudDService] Recognition error:", error);
      // If it's already our custom error type, re-throw it as-is
      if (error instanceof RecognitionError) {
        throw error;
      }
      // For network errors, axios puts detail in error.response.data — extract it
      const axiosData = (error as { response?: { data?: unknown } }).response?.data;
      const detail = axiosData
        ? typeof axiosData === "object"
          ? JSON.stringify(axiosData)
          : String(axiosData)
        : error instanceof Error
          ? error.message
          : String(error);
      throw new RecognitionError(
        `Request failed: ${detail}`,
        RecognitionServiceType.AUDD,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * parseAudDResponse  (private — only called inside this class)
   *
   * AudD sends back a big JSON object with lots of fields.
   * This method picks out the bits we care about and puts them
   * into our standard SongResult shape.
   *
   * It's like reading a foreign-language menu and translating the
   * relevant parts into English for the kitchen.
   */
  private parseAudDResponse(result: Record<string, unknown>): SongResult {
    // Pull out the nested Spotify sub-object if AudD provided one.
    const spotifyData = result.spotify as Record<string, unknown> | undefined;
    const appleMusicData = result.apple_music as Record<string, unknown> | undefined;

    // Convert the release date string (e.g. "1975-10-31") to just the year number
    const releaseYear = result.release_date
      ? new Date(result.release_date as string).getFullYear()
      : undefined;
    const spotifyDurationMs = this.getNumber(spotifyData?.duration_ms);
    const appleMusicDurationMs = this.getNumber(appleMusicData?.durationInMillis);
    const duration =
      this.getNumber(result.duration) ??
      (spotifyDurationMs !== undefined ? Math.round(spotifyDurationMs / 1000) : undefined) ??
      (appleMusicDurationMs !== undefined ? Math.round(appleMusicDurationMs / 1000) : undefined);

    return {
      title: (result.title as string) || "Unknown",
      artist: (result.artist as string) || "Unknown Artist",
      album: (result.album as string) || undefined,
      year: releaseYear ? releaseYear.toString() : undefined,
      releaseYear,
      duration,
      isrc:
        (result.isrc as string | undefined) ||
        (appleMusicData?.isrc as string | undefined) ||
        ((spotifyData?.external_ids as Record<string, unknown> | undefined)?.isrc as
          | string
          | undefined),

      // Spotify's internal track ID — used to build a deep-link into the Spotify app
      spotifyId: (spotifyData?.id as string) || undefined,

      albumArtUrl: this.parseAlbumArtUrl(result, spotifyData, appleMusicData),

      // YouTube video URL if AudD provides one
      youtubeUrl: (result.youtube_video as Record<string, unknown>)?.url as string,

      // Keep Apple Music searches in the shared action helper so provider formatting is normalized consistently.
      appleMusicUrl: (appleMusicData?.url as string | undefined) || undefined,

      confidence: (result.confidence as number) || undefined,

      // Keep the original raw response for debugging purposes
      rawData: result,
    };
  }

  private parseAlbumArtUrl(
    result: Record<string, unknown>,
    spotifyData?: Record<string, unknown>,
    appleMusicData?: Record<string, unknown>
  ): string | undefined {
    const spotifyAlbum = spotifyData?.album as Record<string, unknown> | undefined;
    const spotifyImages = spotifyAlbum?.images;

    const spotifyImageUrl = Array.isArray(spotifyImages)
      ? spotifyImages
          .filter(
            (image): image is Record<string, unknown> =>
              Boolean(image) && typeof image === "object"
          )
          .sort((a, b) => Number(b.height || 0) - Number(a.height || 0))
          .map((image) => image.url)
          .find((url): url is string => typeof url === "string" && url.trim().length > 0)
      : undefined;

    const appleMusicArtworkObject = appleMusicData?.artwork as Record<string, unknown> | undefined;
    const appleMusicArtwork =
      (appleMusicArtworkObject?.url as string | undefined) ||
      (appleMusicData?.artworkUrl100 as string | undefined) ||
      (appleMusicData?.artworkUrl60 as string | undefined);

    const upgradedAppleMusicArtwork = appleMusicArtwork
      ?.replace("{w}", "600")
      .replace("{h}", "600")
      .replace(/100x100bb\.(jpg|jpeg|png)$/i, "600x600bb.$1");

    return (
      spotifyImageUrl ||
      upgradedAppleMusicArtwork ||
      (result.album_art as string | undefined) ||
      (result.artwork_url as string | undefined)
    );
  }

  private async enrichWithFreeArtwork(
    song: SongResult,
    result: Record<string, unknown>
  ): Promise<SongResult> {
    if (song.albumArtUrl) {
      return song;
    }

    const deezerData = result.deezer as Record<string, unknown> | undefined;
    const albumArtUrl = await findBestArtwork({
      title: song.title,
      artist: song.artist,
      album: song.album ?? undefined,
      deezerAlbumId: this.getNestedString(deezerData, ["album", "id"]),
    });

    return albumArtUrl ? { ...song, albumArtUrl } : song;
  }

  private getNestedString(value: unknown, path: string[]): string | undefined {
    let current: unknown = value;

    for (const key of path) {
      if (!current || typeof current !== "object") {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }

    return typeof current === "string" && current.trim() ? current : undefined;
  }

  private getNumber(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  }
}
