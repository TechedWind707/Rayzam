/**
 * Core types and interfaces for the SongSnap extension
 */

export interface RecognitionResult {
  title: string;
  artist: string;
  album?: string | null;
  year?: string | null;
  genre?: string | null;
  albumArt?: string;
  confidence?: number;
  isrc?: string | null;
  duration?: number;
}

export interface RecognitionService {
  recognize(audioPath: string): Promise<RecognitionResult>;
}

export type SongResult = RecognitionResult & {
  releaseYear?: number;
  albumArtUrl?: string;
  spotifyId?: string;
  youtubeUrl?: string;
  appleMusicUrl?: string;
  rawData?: Record<string, unknown>;
};

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

export enum RecognitionServiceType {
  CHROMAPRINT = "chromaprint",
  ACRCLOUD = "acrcloud",
  AUDD = "audd",
}

export class RecognitionError extends Error {
  constructor(
    message: string,
    public service: RecognitionServiceType,
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
