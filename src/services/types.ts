/**
 * ─────────────────────────────────────────────────────────────────
 * types.ts  —  The "dictionary" of the whole project
 * ─────────────────────────────────────────────────────────────────
 *
 * Think of this file like a blueprint or a form that every other
 * part of the app must fill in correctly.
 *
 * When you order a pizza, the restaurant uses a standard order-form:
 * size, toppings, address, etc.  Everyone — the cashier, the cook,
 * the delivery driver — reads the same form so nobody gets confused.
 *
 * This file is that shared form for SongSnap.  It says:
 *   "When you identify a song, the result MUST contain a title and
 *    artist.  It MAY also contain an album, a year, etc."
 *
 * TypeScript uses these definitions to catch mistakes at compile
 * time.  If a service returns a number where a string is expected,
 * TypeScript screams before the app even runs.
 * ─────────────────────────────────────────────────────────────────
 */

// ─── What a "just-identified" song looks like ────────────────────────────────
//
// RecognitionResult is the raw information that comes back from a
// music-recognition service (AcoustID, AudD, ACRCloud, etc.).
//
// The '?' after a field name means it is optional — like a bonus
// field on the pizza form that you don't have to fill in.
//
export interface RecognitionResult {
  title: string;           // Song name — always required ("Bohemian Rhapsody")
  artist: string;          // Who made it — always required ("Queen")
  album?: string | null;   // Which album it belongs to (optional)
  year?: string | null;    // Release year as text, e.g. "1975" (optional)
  genre?: string | null;   // Music genre, e.g. "Rock" (optional)
  albumArt?: string;       // A web link to the album-cover image (optional)
  confidence?: number;     // How sure the service is — 0.0 (no idea) to 1.0 (certain)
  isrc?: string | null;    // A global music ID code, like a song's passport number (optional)
  duration?: number;       // Length of the song in seconds (optional)
}

// ─── The contract every recognition service must follow ──────────────────────
//
// This is like a job description.  Any service that wants to
// identify songs (Chromaprint, AudD, ACRCloud) MUST have a
// 'recognize' function that takes a path to an audio file and
// gives back a RecognitionResult.
//
// If a service doesn't have this function, TypeScript won't let
// it pretend to be a RecognitionService.
//
export interface RecognitionService {
  // audioPath = the location on disk of the recorded audio file
  // Promise<RecognitionResult> = "I'll give you the result later (async)"
  recognize(audioPath: string): Promise<RecognitionResult>;
}

// ─── A richer song object (used inside the app's UI) ─────────────────────────
//
// SongResult = RecognitionResult PLUS extra bonus fields.
// The "&" means "everything in RecognitionResult, plus the new stuff below".
//
// This is like the pizza order form after the delivery driver added
// "delivered at 7:32 pm" and "left at front door" — the base info
// is still there, but extra details were attached along the way.
//
export type SongResult = RecognitionResult & {
  releaseYear?: number;       // Release year as a number (easier to do math with than a string)
  albumArtUrl?: string;       // URL to the album cover image
  spotifyId?: string;         // Spotify's internal ID for this track (used to deep-link into Spotify)
  youtubeUrl?: string;        // A direct link to the song on YouTube
  appleMusicUrl?: string;     // A direct link to the song on Apple Music
  rawData?: Record<string, unknown>; // The raw, unprocessed response from the API — kept for debugging
};

// ─── Options you can pass when starting a recording ──────────────────────────
export interface RecognitionOptions {
  duration: number;       // How many seconds to record
  microphone?: string;    // Which microphone to use (optional — blank = use the default)
}

// ─── What a song in the "Song History" list looks like ───────────────────────
//
// Every time you identify a song, we store a HistoryEntry so you
// can look it up later in the Song History command.
//
export interface HistoryEntry {
  id: string;           // A unique ID we generate for each entry (like a receipt number)
  title: string;        // Song title
  artist: string;       // Artist name
  album?: string;       // Album (optional)
  releaseYear?: number; // Year released (optional)
  service: string;      // Which service recognised it ("chromaprint", "audd", etc.)
  timestamp: number;    // When it was identified — stored as milliseconds since 1970 (Unix time)
  confidence?: number;  // How confident the service was (optional)
}

// ─── The list of available recognition services ──────────────────────────────
//
// An enum is like a dropdown menu with fixed choices.
// Instead of typing the string "chromaprint" everywhere and risking
// a typo, we use RecognitionServiceType.CHROMAPRINT — TypeScript
// then checks that it's one of the allowed values.
//
export enum RecognitionServiceType {
  CHROMAPRINT = "chromaprint", // Free, uses AcoustID database
  ACRCLOUD    = "acrcloud",    // Paid, very accurate
  AUDD        = "audd",        // Freemium, 600 free identifications/day
}

// ─── A custom error for when song recognition fails ──────────────────────────
//
// Instead of a generic "Error", we create a specialised error that
// also remembers WHICH service failed and what the original error was.
//
// Think of it like a detailed incident report vs. just saying "it broke".
//
export class RecognitionError extends Error {
  constructor(
    message: string,                        // Human-readable description of what went wrong
    public service: RecognitionServiceType, // Which service was being used
    public originalError?: Error            // The underlying technical error (for debugging)
  ) {
    // Call the parent Error class so this behaves like a normal error
    super(`[${service}] ${message}`);
    this.name = "RecognitionError";
  }
}

// ─── A custom error specifically for audio recording problems ─────────────────
//
// Separate from RecognitionError so we know whether the problem
// happened WHILE RECORDING (microphone issue, ffmpeg not found)
// vs. DURING IDENTIFICATION (bad API key, no internet, no match).
//
export class AudioRecordingError extends Error {
  constructor(
    message: string,             // What went wrong
    public originalError?: Error // The underlying technical error
  ) {
    super(message);
    this.name = "AudioRecordingError";
  }
}
