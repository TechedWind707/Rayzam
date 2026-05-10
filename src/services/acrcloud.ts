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
import FormData from "form-data"; // Node.js multipart form-data handler
import { RecognitionService, SongResult, RecognitionError, RecognitionServiceType } from "./types";
import { findBestArtwork } from "./artwork";
import { saveDebugJson } from "../utils/debug-json";

export class ACRCloudService implements RecognitionService {
  private api: AxiosInstance; // Pre-configured HTTP client
  private accessKey: string; // Our public identifier with ACRCloud
  private accessSecret: string; // Our secret key — never sent to the server directly
  private baseUrl: string; // Which server to talk to
  private metadataToken?: string;
  private metadataBaseUrl: string;
  private readonly timeout = 30000; // Time out after 30 seconds

  /**
   * constructor
   *
   * @param accessKey    From your ACRCloud dashboard
   * @param accessSecret From your ACRCloud dashboard (keep it secret!)
   * @param host         e.g. "identify-eu-west-1.acrcloud.com"
   */
  constructor(
    accessKey: string,
    accessSecret: string,
    host: string = "identify-us.acrcloud.com",
    metadataToken?: string,
    metadataHost: string = "eu-api-v2.acrcloud.com"
  ) {
    this.accessKey = accessKey;
    this.accessSecret = accessSecret;
    this.metadataToken = metadataToken?.trim() || undefined;

    // Make sure the URL starts with "https://" — add it if the user only typed the hostname
    this.baseUrl = host.startsWith("http") ? host : `https://${host}`;
    this.metadataBaseUrl = metadataHost.startsWith("http")
      ? metadataHost
      : `https://${metadataHost}`;

    this.api = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        // Let form-data handle the headers (it sets Content-Type with boundary)
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
      const signatureVersion = "1";
      const signature = this.generateSignature(audioBuffer, timestamp, signatureVersion);

      // Step 4: Build a multipart form using Node.js form-data (required for binary data)
      const formData = new FormData();
      formData.append("access_key", this.accessKey);
      formData.append("timestamp", timestamp);
      formData.append("signature", signature); // The HMAC-SHA1 stamp
      formData.append("signature_version", signatureVersion);
      formData.append("data_type", "audio");
      formData.append("audio_format", "wav");
      // Ask ACRCloud to return these specific metadata fields
      formData.append("file_fields", "title,artists,album,genres,duration");
      // Append the actual audio file — this is critical; without it ACRCloud has nothing to identify
      formData.append("sample", fs.createReadStream(audioPath), "audio.wav");
      // Inform the server of the raw byte size (helpful for some endpoints)
      formData.append("sample_bytes", String(audioBuffer.length));

      // Step 5: Send the request with the form-data
      // form-data automatically sets the correct Content-Type and boundary
      const response = await this.api.post("/v1/identify", formData, {
        headers: formData.getHeaders(),
      });
      await saveDebugJson("acrcloud", "identify", response.data);

      // Step 6: Check the response for a match
      // ACRCloud can return matches under different keys depending on the
      // recognition mode (e.g. `music` for normal identification, `humming`
      // for humming/melody matches). Normalize both into `matches`.
      const metadata = response.data?.metadata as Record<string, unknown> | undefined;
      const musicMatches = metadata?.music;
      const hummingMatches = metadata?.humming;
      const matches: Record<string, unknown>[] = Array.isArray(musicMatches)
        ? musicMatches
        : Array.isArray(hummingMatches)
          ? hummingMatches
          : [];
      if (matches.length > 0) {
        // Take the first (best) match from the list
        const parsedMatches = matches.map((match) => this.parseACRCloudResponse(match));
        const parsed = parsedMatches[0];
        const metadataEnriched = await this.enrichWithMetadataApi(parsed, matches[0]);
        const artworkEnriched = await this.enrichWithFreeArtwork(metadataEnriched, matches[0]);
        return {
          ...artworkEnriched,
          alternatives: parsedMatches.slice(1),
        };
      }

      // ACRCloud returns a status object on every response.
      // We map known error codes to plain-English messages the user can act on.
      const status = response.data?.status as Record<string, unknown> | undefined;
      const statusCode = status?.code as number | undefined;

      // Log technical detail to console for debugging, but show friendly text to user
      console.error(
        "[ACRCloudService] API error, status:",
        JSON.stringify(status),
        "| Full response:",
        JSON.stringify(response.data)
      );

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
          // Code 3006 = invalid arguments (usually a malformed request)
          // Could be signature error, missing fields, or wrong content-type
          friendlyMsg =
            "Invalid request to ACRCloud (code 3006: invalid arguments).\n" +
            "This may indicate incorrect credentials or a request formatting issue.\n" +
            "Please check your Access Key and Secret are correct.";
          break;
        default:
          // status.code === 0 with no matches previously resulted in throwing
          // the raw status.msg (which can be the string "Success"). Map that
          // to a helpful user-facing message instead.
          if (statusCode === 0) {
            friendlyMsg = "No matches found";
          } else {
            friendlyMsg = (status?.msg as string | undefined) || "No matches found";
          }
      }

      throw new RecognitionError(friendlyMsg, RecognitionServiceType.ACRCLOUD);
    } catch (error) {
      if (error instanceof RecognitionError) {
        throw error; // Already our type — pass it through unchanged
      }
      // Network / connection errors — give a clear, actionable message
      const rawMsg = error instanceof Error ? error.message : String(error);
      let friendlyMsg: string;
      if (
        rawMsg.includes("ENOTFOUND") ||
        rawMsg.includes("ECONNREFUSED") ||
        rawMsg.includes("network")
      ) {
        friendlyMsg =
          "Could not reach the ACRCloud server. Please check your internet connection and try again.";
      } else if (rawMsg.includes("timeout") || rawMsg.includes("ETIMEDOUT")) {
        friendlyMsg =
          "The ACRCloud request timed out. Please check your internet connection and try again.";
      } else {
        friendlyMsg =
          "ACRCloud request failed. Please check your credentials and internet connection.";
      }
      console.error("[ACRCloudService] Request error:", rawMsg);
      throw new RecognitionError(
        friendlyMsg,
        RecognitionServiceType.ACRCLOUD,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * generateSignature  (private)
   *
   * Creates an HMAC-SHA1 signature of the audio data + timestamp using the access secret.
   *
   * HMAC (Hash-based Message Authentication Code) uses a secret key to sign the data.
   * ACRCloud runs the same calculation on their end and verifies the signature
   * to prove the request is genuine and hasn't been tampered with.
   */
  private generateSignature(
    audioBuffer: Buffer,
    timestamp: string,
    signatureVersion: string
  ): string {
    // ACRCloud expects a signature calculated over a specific string-to-sign.
    // The common format is:
    //   "POST\n/v1/identify\n{access_key}\n{data_type}\n{signature_version}\n{timestamp}"
    // The signature is HMAC-SHA1(string_to_sign, access_secret) and then base64-encoded.
    const dataType = "audio";
    const method = "POST";
    const uri = "/v1/identify";

    const stringToSign = [method, uri, this.accessKey, dataType, signatureVersion, timestamp].join(
      "\n"
    );
    const hmacObj = crypto.HmacSHA1(stringToSign, this.accessSecret);
    const signature = crypto.enc.Base64.stringify(hmacObj);
    return signature;
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

  private normalizeConfidence(score: unknown): number | undefined {
    const value = this.getNumber(score);

    if (value === undefined) {
      return undefined;
    }

    return value > 1 ? value / 100 : value;
  }

  private parseDurationSeconds(music: Record<string, unknown>): number | undefined {
    const duration = this.getNumber(music.duration);

    if (duration !== undefined) {
      return duration;
    }

    const durationMs = this.getNumber(music.duration_ms);
    return durationMs !== undefined ? Math.round(durationMs / 1000) : undefined;
  }

  private parseReleaseYear(
    music: Record<string, unknown>,
    album?: Record<string, unknown>
  ): number | undefined {
    const releaseDate =
      (music.release_date as string | undefined) || (album?.release_date as string | undefined);

    if (!releaseDate) {
      return undefined;
    }

    const year = new Date(releaseDate).getFullYear();
    return Number.isFinite(year) ? year : undefined;
  }

  private getExternalPlatform(music: Record<string, unknown>, platform: string): unknown {
    const externalMetadata = music.external_metadata as Record<string, unknown> | undefined;
    const platformMetadata = externalMetadata?.[platform];
    return Array.isArray(platformMetadata) ? platformMetadata[0] : platformMetadata;
  }

  private parseSpotifyId(music: Record<string, unknown>): string | undefined {
    const spotify = this.getExternalPlatform(music, "spotify");
    const id =
      this.getNestedString(spotify, ["track", "id"]) || this.getNestedString(spotify, ["id"]);

    if (id) {
      return id;
    }

    const link =
      this.getNestedString(spotify, ["track", "link"]) || this.getNestedString(spotify, ["link"]);
    return link?.match(/open\.spotify\.com\/track\/([^?/#]+)/)?.[1];
  }

  private parseYouTubeUrl(music: Record<string, unknown>): string | undefined {
    const youtube = this.getExternalPlatform(music, "youtube");
    const directUrl =
      this.getNestedString(youtube, ["url"]) ||
      this.getNestedString(youtube, ["link"]) ||
      this.getNestedString(youtube, ["video", "url"]) ||
      this.getNestedString(youtube, ["video", "link"]);

    if (directUrl) {
      return directUrl;
    }

    const videoId =
      this.getNestedString(youtube, ["vid"]) ||
      this.getNestedString(youtube, ["video", "id"]) ||
      this.getNestedString(youtube, ["id"]);

    return videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : undefined;
  }

  private parseYouTubeVideoId(music: Record<string, unknown>): string | undefined {
    const youtube = this.getExternalPlatform(music, "youtube");
    return (
      this.getNestedString(youtube, ["vid"]) ||
      this.getNestedString(youtube, ["video", "id"]) ||
      this.getNestedString(youtube, ["id"])
    );
  }

  private parseDeezerAlbumId(music: Record<string, unknown>): string | undefined {
    const deezer = this.getExternalPlatform(music, "deezer");
    return this.getNestedString(deezer, ["album", "id"]);
  }

  private parseAppleMusicUrl(music: Record<string, unknown>): string | undefined {
    const appleMusic =
      this.getExternalPlatform(music, "applemusic") ||
      this.getExternalPlatform(music, "apple") ||
      this.getExternalPlatform(music, "itunes");

    return (
      this.getNestedString(appleMusic, ["url"]) ||
      this.getNestedString(appleMusic, ["link"]) ||
      this.getNestedString(appleMusic, ["track", "url"]) ||
      this.getNestedString(appleMusic, ["track", "link"])
    );
  }

  private getLargestImageUrl(images: unknown): string | undefined {
    if (!Array.isArray(images)) {
      return undefined;
    }

    const sortedImages = images
      .filter(
        (image): image is Record<string, unknown> =>
          Boolean(image) && typeof image === "object"
      )
      .sort((a, b) => (this.getNumber(b.height) || 0) - (this.getNumber(a.height) || 0));

    return sortedImages
      .map((image) => image.url)
      .find((url): url is string => typeof url === "string" && url.trim().length > 0);
  }

  private parseAlbumArtUrl(
    music: Record<string, unknown>,
    album?: Record<string, unknown>
  ): string | undefined {
    const spotify = this.getExternalPlatform(music, "spotify");
    const spotifyRecord =
      spotify && typeof spotify === "object" ? (spotify as Record<string, unknown>) : undefined;
    const spotifyTrack = spotifyRecord?.track as Record<string, unknown> | undefined;
    const spotifyAlbum =
      (spotifyTrack?.album as Record<string, unknown> | undefined) ||
      (spotifyRecord?.album as Record<string, unknown> | undefined);
    const albumCovers = album?.covers as Record<string, unknown> | undefined;

    return (
      this.getLargestImageUrl(spotifyAlbum?.images) ||
      this.getNestedString(album, ["cover"]) ||
      this.getNestedString(albumCovers, ["large"]) ||
      this.getNestedString(albumCovers, ["medium"]) ||
      this.getNestedString(albumCovers, ["small"]) ||
      this.getNestedString(album, ["image"]) ||
      this.getNestedString(album, ["artwork"]) ||
      this.getNestedString(music, ["album_art"]) ||
      this.getNestedString(music, ["artwork_url"])
    );
  }

  private async enrichWithMetadataApi(
    song: SongResult,
    music: Record<string, unknown>
  ): Promise<SongResult> {
    if (!this.metadataToken) {
      return song;
    }

    const acrid = this.getNestedString(music, ["acrid"]);
    const artists = music.artists as Record<string, unknown>[] | undefined;
    const artistNames = artists
      ?.map((artist) => artist.name)
      .filter((name): name is string => typeof name === "string" && name.trim().length > 0);

    const params: Record<string, string> = {
      platforms: "spotify,deezer,youtube,applemusic",
      format: "json",
    };

    if (acrid) {
      params.acr_id = acrid;
    } else {
      params.query = JSON.stringify({
        track: song.title,
        artists: artistNames?.length ? artistNames : [song.artist],
      });
    }

    try {
      const response = await axios.get(`${this.metadataBaseUrl}/api/external-metadata/tracks`, {
        params,
        timeout: this.timeout,
        headers: {
          Authorization: `Bearer ${this.metadataToken}`,
        },
      });
      await saveDebugJson("acrcloud", "metadata", response.data);

      const data = response.data?.data;
      const metadata = Array.isArray(data) ? data[0] : undefined;
      if (!metadata || typeof metadata !== "object") {
        return song;
      }

      return this.mergeMetadataApiResult(song, metadata as Record<string, unknown>);
    } catch (err) {
      console.warn(
        "[ACRCloudService] Metadata API enrichment failed; using recognition metadata only:",
        err instanceof Error ? err.message : err
      );
      return song;
    }
  }

  private async enrichWithFreeArtwork(
    song: SongResult,
    music: Record<string, unknown>
  ): Promise<SongResult> {
    if (song.albumArtUrl) {
      return song;
    }

    const albumArtUrl = await findBestArtwork({
      title: song.title,
      artist: song.artist,
      album: song.album ?? undefined,
      deezerAlbumId: this.parseDeezerAlbumId(music),
      youtubeVideoId: this.parseYouTubeVideoId(music),
    });

    return albumArtUrl ? { ...song, albumArtUrl } : song;
  }

  private mergeMetadataApiResult(
    song: SongResult,
    metadata: Record<string, unknown>
  ): SongResult {
    const album = metadata.album as Record<string, unknown> | undefined;
    const externalMetadata = metadata.external_metadata as Record<string, unknown> | undefined;
    const spotifyMetadata = externalMetadata?.spotify;
    const appleMusicMetadata =
      externalMetadata?.applemusic || externalMetadata?.apple || externalMetadata?.itunes;
    const youtubeMetadata = externalMetadata?.youtube;

    const spotify =
      Array.isArray(spotifyMetadata) && spotifyMetadata[0]
        ? spotifyMetadata[0]
        : spotifyMetadata;
    const appleMusic =
      Array.isArray(appleMusicMetadata) && appleMusicMetadata[0]
        ? appleMusicMetadata[0]
        : appleMusicMetadata;
    const youtube =
      Array.isArray(youtubeMetadata) && youtubeMetadata[0]
        ? youtubeMetadata[0]
        : youtubeMetadata;
    const albumCovers = album?.covers as Record<string, unknown> | undefined;

    return {
      ...song,
      album: song.album || (album?.name as string | undefined),
      albumArtUrl:
        song.albumArtUrl ||
        this.getNestedString(album, ["cover"]) ||
        this.getNestedString(albumCovers, ["large"]) ||
        this.getNestedString(albumCovers, ["medium"]) ||
        this.getNestedString(albumCovers, ["small"]),
      spotifyId: song.spotifyId || this.parseSpotifyIdFromMetadataApi(spotify),
      appleMusicUrl:
        song.appleMusicUrl ||
        this.getNestedString(appleMusic, ["link"]) ||
        this.getNestedString(appleMusic, ["url"]),
      youtubeUrl:
        song.youtubeUrl ||
        this.getNestedString(youtube, ["link"]) ||
        this.getNestedString(youtube, ["url"]),
      isrc: song.isrc || (metadata.isrc as string | undefined),
      duration: song.duration || this.parseMetadataDuration(metadata),
    };
  }

  private parseSpotifyIdFromMetadataApi(value: unknown): string | undefined {
    const id =
      this.getNestedString(value, ["id"]) ||
      this.getNestedString(value, ["track", "id"]);
    if (id) {
      return id;
    }

    const link =
      this.getNestedString(value, ["link"]) ||
      this.getNestedString(value, ["url"]) ||
      this.getNestedString(value, ["track", "link"]);
    return link?.match(/open\.spotify\.com\/track\/([^?/#]+)/)?.[1];
  }

  private parseMetadataDuration(metadata: Record<string, unknown>): number | undefined {
    const durationMs = this.getNumber(metadata.duration_ms);
    if (durationMs !== undefined) {
      return Math.round(durationMs / 1000);
    }

    return this.getNumber(metadata.duration);
  }

  /**
   * parseACRCloudResponse  (private)
   *
   * Translates ACRCloud's JSON format into our standard SongResult shape.
   */
  private parseACRCloudResponse(music: Record<string, unknown>): SongResult {
    // ACRCloud returns artists as an array — we just want the first one's name
    const artists = music.artists as Record<string, unknown>[] | undefined;
    const album = music.album as Record<string, unknown> | undefined;
    const spotifyId = this.parseSpotifyId(music);
    const youtubeUrl = this.parseYouTubeUrl(music);
    const appleMusicUrl = this.parseAppleMusicUrl(music);
    const albumArtUrl = this.parseAlbumArtUrl(music, album);

    const releaseYear = this.parseReleaseYear(music, album);
    const duration = this.parseDurationSeconds(music);
    const isrc =
      (music.isrc as string | undefined) || this.getNestedString(music.external_ids, ["isrc"]);
    const confidence = this.normalizeConfidence(music.score);

    return {
      title: (music.title as string) || "Unknown",
      artist: (artists?.[0]?.name as string) || "Unknown Artist",
      album: (album?.name as string) || undefined,
      year: releaseYear ? releaseYear.toString() : undefined,
      releaseYear,
      duration,
      isrc,
      spotifyId,
      youtubeUrl,
      appleMusicUrl,
      albumArtUrl,
      confidence,
      rawData: music, // Keep raw data for debugging
    };
  }
}
