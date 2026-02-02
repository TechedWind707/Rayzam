/**
 * Quick action handlers for song metadata
 */

import { open, showHUD, Clipboard } from "@raycast/api";
import { SongResult } from "../services/types";

export async function openInSpotify(spotifyId?: string, artist?: string, title?: string): Promise<void> {
  if (spotifyId) {
    await open(`spotify:track:${spotifyId}`);
  } else if (artist && title) {
    const query = encodeURIComponent(`${title} ${artist}`);
    await open(`https://open.spotify.com/search/${query}`);
  }
}

export async function openInAppleMusic(appleMusicUrl?: string, artist?: string, title?: string): Promise<void> {
  if (appleMusicUrl) {
    await open(appleMusicUrl);
  } else if (artist && title) {
    const query = encodeURIComponent(`${title} ${artist}`);
    await open(`https://music.apple.com/search?term=${query}`);
  }
}

export async function openInYouTube(youtubeUrl?: string, artist?: string, title?: string): Promise<void> {
  if (youtubeUrl) {
    await open(youtubeUrl);
  } else if (artist && title) {
    const query = encodeURIComponent(`${title} ${artist}`);
    await open(`https://www.youtube.com/results?search_query=${query}`);
  }
}

export async function copySongDetails(song: SongResult): Promise<void> {
  const details = formatSongDetails(song);
  await Clipboard.copy(details);
  await showHUD("✓ Song details copied to clipboard");
}

export function formatSongDetails(song: SongResult): string {
  const lines = [
    `🎵 ${song.title}`,
    `👤 ${song.artist}`,
  ];

  if (song.album) {
    lines.push(`💿 ${song.album}`);
  }

  if (song.releaseYear) {
    lines.push(`📅 ${song.releaseYear}`);
  }

  if (song.duration) {
    const minutes = Math.floor(song.duration / 60);
    const seconds = song.duration % 60;
    lines.push(`⏱️ ${minutes}:${seconds.toString().padStart(2, "0")}`);
  }

  if (song.confidence !== undefined) {
    lines.push(`🎯 Confidence: ${(song.confidence * 100).toFixed(0)}%`);
  }

  return lines.join("\n");
}

export function createMarkdownView(song: SongResult): string {
  const lines = [
    `# 🎵 ${song.title}`,
    `## 👤 ${song.artist}`,
  ];

  if (song.albumArtUrl) {
    lines.push(`![Album Art](${song.albumArtUrl})`);
  }

  if (song.album) {
    lines.push(`**Album:** ${song.album}`);
  }

  if (song.releaseYear) {
    lines.push(`**Released:** ${song.releaseYear}`);
  }

  if (song.duration) {
    const minutes = Math.floor(song.duration / 60);
    const seconds = song.duration % 60;
    lines.push(`**Duration:** ${minutes}:${seconds.toString().padStart(2, "0")}`);
  }

  if (song.isrc) {
    lines.push(`**ISRC:** ${song.isrc}`);
  }

  if (song.confidence !== undefined) {
    lines.push(`**Match Confidence:** ${(song.confidence * 100).toFixed(1)}%`);
  }

  return lines.join("\n\n");
}
