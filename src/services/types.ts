/**
 * Core types and interfaces for the SongSnap extension
 */

export interface SongResult {
  title: string;
  artist: string;
  album?: string;
  releaseYear?: number;
  albumArtUrl?: string;
  isrc?: string;
  spotifyId?: string;
  youtubeUrl?: string;
  appleMusicUrl?: string;
  duration?: number;
  confidence?: number;
  rawData?: Record<string, unknown>;
}

export interface MusicRecognitionService {
  recognize(audioBuffer: Buffer): Promise<SongResult>;
}

export interface RecognitionOptions {
  duration: number;
  microphone?: string;
}

export interface HistoryEntry {
  id: string;
  title: string;
  artist: string;
  album?: string;
  releaseYear?: number;
  service: string;
  timestamp: number;
  confidence?: number;
}

export enum RecognitionService {
  SHAZAMIO = "shazamio",
  ACRCLOUD = "acrcloud",
  AUDD = "audd",
}

export class RecognitionError extends Error {
  constructor(
    message: string,
    public service: RecognitionService,
    public originalError?: Error
  ) {
    super(`[${service}] ${message}`);
    this.name = "RecognitionError";
  }
}

export class AudioRecordingError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = "AudioRecordingError";
  }
}
