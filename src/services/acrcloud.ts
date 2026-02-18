/**
 * ─────────────────────────────────────────────────────────────────
 * acrcloud.ts  —  Song recognition via ACRCloud
 * ─────────────────────────────────────────────────────────────────
 *
 * ACRCloud (acrcloud.com) is a professional, paid music-recognition
 * service used by broadcast companies and streaming platforms.
 * It's more expensive than AudD but has higher accuracy.
 *
 * The extra complexity here vs. AudD is AUTHENTICATION:
 * ACRCloud requires a cryptographic signature on every request.
 * Think of it like sealing an envelope with a wax stamp — the
 * server can verify the stamp is genuine and hasn't been tampered with.
 *
 * Credentials needed:
 *   • accessKey    — your public identifier (like a username)
 *   • accessSecret — your private key used to create the stamp
 *   • host         — which ACRCloud server to use (varies by region)
 * ─────────────────────────────────────────────────────────────────
 */

import axios, { AxiosInstance } from "axios";
import crypto from "crypto-js"; // Library for cryptographic operations (hashing, signing)
import * as fs from "fs";
import { RecognitionService, SongResult, RecognitionError, RecognitionServiceType } from "./types";

export class ACRCloudService implements RecognitionService {
  private api: AxiosInstance;       // Pre-configured HTTP client
  private accessKey: string;        // Our public identifier with ACRCloud
  private accessSecret: string;     // Our secret key — never sent to the server directly
  private baseUrl: string;          // Which server to talk to
  private readonly timeout = 30000; // Time out after 30 seconds

  /**
   * constructor
   *
   * @param accessKey    From your ACRCloud dashboard
   * @param accessSecret From your ACRCloud dashboard (keep it secret!)
   * @param host         e.g. "identify-eu-west-1.acrcloud.com"
   */
  constructor(accessKey: string, accessSecret: string, host: string = "identify-us.acrcloud.com") {
    this.accessKey    = accessKey;
    this.accessSecret = accessSecret;

    // Make sure the URL starts with "https://" — add it if the user only typed the hostname
    this.baseUrl = host.startsWith("http") ? host : `https://${host}`;

    this.api = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        // URL-encoded form data — like a web form submission, but simpler than multipart
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
  }

  /**
   * recognize
   *
   * Reads the audio file, signs the request, sends it to ACRCloud,
   * and returns the identified song.
   */
  async recognize(audioPath: string): Promise<SongResult> {
    try {
      // Step 1: Read the audio file into memory
      const audioBuffer = await fs.promises.readFile(audioPath);

      // Step 2: Get the current time in "Unix timestamp" format
      // Unix timestamp = seconds elapsed since midnight, 1 Jan 1970
      // (Every computer in the world counts time this way — it's universal)
      const timestamp = Math.floor(Date.now() / 1000).toString();

      // Step 3: Create a cryptographic signature
      // This proves the request is genuinely from us and hasn't been altered
      const signature = this.generateSignature(audioBuffer, timestamp);

      // Step 4: Build a URL-encoded form with all required fields
      // URLSearchParams works like a query string: "key1=val1&key2=val2"
      const formData = new URLSearchParams();
      formData.append("client_id",     this.accessKey);
      formData.append("client_secret", this.accessSecret);
      formData.append("timestamp",     timestamp);
      formData.append("signature",     signature);  // The wax stamp
      formData.append("data_type",     "audio");
      formData.append("audio_format",  "wav");
      // Ask ACRCloud to return these specific metadata fields
      formData.append("file_fields",   "title,artists,album,genres,duration");
      formData.append("access_key",    this.accessKey);

      // Step 5: Send the request
      const response = await this.api.post("/v1/identify", formData);

      // Step 6: Check the response for a match
      if (response.data?.metadata?.music?.length > 0) {
        // Take the first (best) match from the list
        return this.parseACRCloudResponse(response.data.metadata.music[0]);
      }

      // ACRCloud returns a status object on every response.
      // We map known error codes to plain-English messages the user can act on.
      const status     = response.data?.status as Record<string, unknown> | undefined;
      const statusCode = status?.code as number | undefined;

      // Log technical detail to console for debugging, but show friendly text to user
      console.error("[ACRCloudService] API error, status:", JSON.stringify(status), "| Full response:", JSON.stringify(response.data));

      let friendlyMsg: string;
      switch (statusCode) {
        case 1001:
          friendlyMsg = "No matches found";
          break;
        case 2000:
          friendlyMsg = "The recording was too short to identify. Try recording for longer.";
          break;
        case 2001:
          friendlyMsg = "The recording was too long. Try a shorter clip.";
          break;
        case 3000:
        case 3001:
          friendlyMsg =
            "Your ACRCloud access key or secret is incorrect or has expired.\n" +
            "Please check your credentials in Configure Extension → ACRCloud Access Key / Secret.";
          break;
        case 3003:
          friendlyMsg =
            "Your ACRCloud account has reached its recognition limit.\n" +
            "Please check your usage quota at console.acrcloud.com.";
          break;
        case 3006:
          friendlyMsg = "Too many requests sent to ACRCloud. Please wait a moment and try again.";
          break;
        default:
          friendlyMsg = (status?.msg as string | undefined) || "No matches found";
      }

      throw new RecognitionError(friendlyMsg, RecognitionServiceType.ACRCLOUD);

    } catch (error) {
      if (error instanceof RecognitionError) {
        throw error; // Already our type — pass it through unchanged
      }
      // Network / connection errors — give a clear, actionable message
      const rawMsg = error instanceof Error ? error.message : String(error);
      let friendlyMsg: string;
      if (rawMsg.includes("ENOTFOUND") || rawMsg.includes("ECONNREFUSED") || rawMsg.includes("network")) {
        friendlyMsg = "Could not reach the ACRCloud server. Please check your internet connection and try again.";
      } else if (rawMsg.includes("timeout") || rawMsg.includes("ETIMEDOUT")) {
        friendlyMsg = "The ACRCloud request timed out. Please check your internet connection and try again.";
      } else {
        friendlyMsg = "ACRCloud request failed. Please check your credentials and internet connection.";
      }
      console.error("[ACRCloudService] Request error:", rawMsg);
      throw new RecognitionError(friendlyMsg, RecognitionServiceType.ACRCLOUD, error instanceof Error ? error : undefined);
    }
  }

  /**
   * generateSignature  (private)
   *
   * Creates an SHA-1 hash of the audio data + timestamp + secret.
   *
   * SHA-1 is a one-way function: given the inputs you can always
   * produce the same hash, but you can't reverse the hash to get
   * the inputs back.  ACRCloud runs the same calculation on their
   * end and checks that our hash matches — like a secret handshake.
   */
  private generateSignature(audioBuffer: Buffer, timestamp: string): string {
    // Combine: base64-encoded audio + timestamp + secret, then hash everything together
    // base64 converts raw binary bytes into a safe text string
    const shaObj = crypto.SHA1(audioBuffer.toString("base64") + timestamp + this.accessSecret);
    return shaObj.toString();
  }

  /**
   * parseACRCloudResponse  (private)
   *
   * Translates ACRCloud's JSON format into our standard SongResult shape.
   */
  private parseACRCloudResponse(music: Record<string, unknown>): SongResult {
    // ACRCloud returns artists as an array — we just want the first one's name
    const artists = music.artists as Record<string, unknown>[] | undefined;
    const album   = music.album   as Record<string, unknown> | undefined;

    // Parse release year from the album's date string if available
    const releaseYear = album?.release_date
      ? new Date(album.release_date as string).getFullYear()
      : undefined;

    return {
      title:    (music.title       as string) || "Unknown",
      artist:   (artists?.[0]?.name as string) || "Unknown Artist",
      album:    (album?.name        as string) || undefined,
      year:     releaseYear ? releaseYear.toString() : undefined,
      releaseYear,
      duration: (music.duration    as number) || undefined,
      isrc:     (music.isrc        as string) || undefined,
      // ACRCloud scores are 0–100; divide by 100 to get 0.0–1.0 (our standard)
      confidence: (music.score as number) / 100,
      rawData: music, // Keep raw data for debugging
    };
  }
}
