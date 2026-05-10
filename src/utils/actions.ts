/**
 * ─────────────────────────────────────────────────────────────────
 * actions.ts  —  "What can you DO with a song result?"
 * ─────────────────────────────────────────────────────────────────
 *
 * Once we've identified a song, the user might want to:
 *   • Open it in Spotify
 *   • Open it in Apple Music
 *   • Watch it on YouTube
 *   • Copy the details to the clipboard
 *   • See a nicely formatted summary in the app
 *
 * All of those actions live here — small, reusable helper functions
 * that both the Identify Song screen and the Song History screen
 * can share without duplicating code.
 *
 * Think of this file like a TV remote control: each button does one
 * specific thing, and the remote is used in multiple rooms.
 * ─────────────────────────────────────────────────────────────────
 */

// 'open' tells the operating system to open a URL (browser / app)
// 'showHUD' shows a quick notification at the top of the screen
// 'Clipboard' lets us copy text to the system clipboard
import { open, showHUD, Clipboard } from "@raycast/api";
import { exec } from "child_process";
import { promisify } from "util";

// Import the SongResult type so TypeScript knows what shape of data we expect
import { PostMatchAction, SongResult } from "../services/types";

const execAsync = promisify(exec);

async function openWithFallback(primaryUrl: string, fallbackUrl: string): Promise<void> {
  try {
    await open(primaryUrl);
  } catch {
    await open(fallbackUrl);
  }
}

function normalizeSearchPart(part: string): string {
  try {
    return decodeURIComponent(part.replace(/\+/g, " "));
  } catch {
    return part.replace(/\+/g, " ");
  }
}

function createSearchTerm(...parts: Array<string | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part))
    .map(normalizeSearchPart)
    .join(" ")
    .replace(/\+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createSearchQuery(...parts: Array<string | undefined>): string {
  return encodeURIComponent(createSearchTerm(...parts));
}

function removeAppleMusicStorefront(url: string): string {
  return url.replace(/music\.apple\.com\/[a-z]{2}\//i, "music.apple.com/");
}

async function findAppleMusicTrackUrl(title: string, artist: string): Promise<string | undefined> {
  try {
    const query = createSearchQuery(title, artist);
    const response = await fetch(
      `https://itunes.apple.com/search?term=${query}&entity=song&limit=1`
    );
    const data = (await response.json()) as {
      results?: Array<{
        trackViewUrl?: string;
      }>;
    };
    const trackViewUrl = data.results?.[0]?.trackViewUrl;
    return trackViewUrl ? removeAppleMusicStorefront(trackViewUrl) : undefined;
  } catch (err) {
    console.warn("[Actions] Failed to look up Apple Music track URL:", err);
    return undefined;
  }
}

async function openAppleMusicUrl(webUrl: string): Promise<void> {
  if (process.platform !== "darwin") {
    await open(webUrl);
    return;
  }

  try {
    await execAsync(`osascript -e 'id of app "Music"'`);
    await open(webUrl.replace("https://", "music://"));
  } catch {
    await open(webUrl);
  }
}

// ─── Open in Spotify ─────────────────────────────────────────────────────────

/**
 * openInSpotify
 *
 * Two modes:
 *   1. If we have Spotify's internal track ID (e.g. "4uLU6hMCjMI75M1A2tKUQC"),
 *      open that exact song directly — like clicking a bookmark.
 *   2. Otherwise, search Spotify using the artist and title — like
 *      typing into Spotify's search bar for you.
 */
export async function openInSpotify(
  spotifyId?: string,
  artist?: string,
  title?: string
): Promise<void> {
  if (spotifyId) {
    // "spotify:track:ID" is a special Spotify URI that opens the app straight to that track
    await open(`spotify:track:${spotifyId}`);
  } else if (artist && title) {
    // encodeURIComponent makes the search term safe for a URL
    // (e.g. spaces become %20, & becomes %26, etc.)
    const query = createSearchQuery(title, artist);
    await openWithFallback(`spotify:search:${query}`, `https://open.spotify.com/search/${query}`);
  }
}

// ─── Open in Apple Music ──────────────────────────────────────────────────────

/**
 * openInAppleMusic
 *
 * Same two-mode pattern as Spotify:
 *   1. We have a direct Apple Music URL → open it.
 *   2. We don't → build a search URL using artist + title.
 */
export async function openInAppleMusic(
  appleMusicUrl?: string,
  artist?: string,
  title?: string
): Promise<void> {
  if (appleMusicUrl) {
    if (appleMusicUrl.includes("music.apple.com") && appleMusicUrl.includes("/search")) {
      try {
        const url = new URL(appleMusicUrl);
        const term = url.searchParams.get("term");
        if (term) {
          url.pathname = "/search";
          url.searchParams.set("term", normalizeSearchPart(term));
          await openAppleMusicUrl(removeAppleMusicStorefront(url.toString()).replace(/\+/g, "%20"));
          return;
        }
      } catch {
        // Fall through to opening the original provider URL.
      }
    }

    await openAppleMusicUrl(removeAppleMusicStorefront(appleMusicUrl));
  } else if (artist && title) {
    const trackUrl = await findAppleMusicTrackUrl(title, artist);
    const fallbackUrl = `https://music.apple.com/search?term=${createSearchQuery(title, artist)}`;
    await openAppleMusicUrl(trackUrl ?? fallbackUrl);
  }
}

// ─── Open on YouTube ─────────────────────────────────────────────────────────

/**
 * openInYouTube
 *
 * Same two-mode pattern:
 *   1. Direct YouTube URL → open it.
 *   2. No URL → search YouTube.
 */
export async function openInYouTube(
  youtubeUrl?: string,
  artist?: string,
  title?: string
): Promise<void> {
  if (youtubeUrl) {
    await open(youtubeUrl);
  } else if (artist && title) {
    const query = createSearchQuery(title, artist);
    await open(`https://www.youtube.com/results?search_query=${query}`);
  }
}

// ─── Open in YouTube Music ──────────────────────────────────────────────────

export async function openInYouTubeMusic(artist?: string, title?: string): Promise<void> {
  if (artist && title) {
    const query = createSearchQuery(title, artist);
    await open(`https://music.youtube.com/search?q=${query}`);
  }
}

// ─── Auto action after recognition ──────────────────────────────────────────

export async function runPostMatchAction(song: SongResult, action: PostMatchAction): Promise<void> {
  switch (action) {
    case PostMatchAction.SPOTIFY:
      await openInSpotify(song.spotifyId, song.artist, song.title);
      break;
    case PostMatchAction.APPLE_MUSIC:
      await openInAppleMusic(song.appleMusicUrl, song.artist, song.title);
      break;
    case PostMatchAction.YOUTUBE:
      await openInYouTube(song.youtubeUrl, song.artist, song.title);
      break;
    case PostMatchAction.YOUTUBE_MUSIC:
      await openInYouTubeMusic(song.artist, song.title);
      break;
    case PostMatchAction.DETAILS:
    default:
      break;
  }
}

// ─── Copy song details to clipboard ──────────────────────────────────────────

/**
 * copySongDetails
 *
 * Formats the song info as a readable block of text and copies it.
 * Example output:
 *   🎵 Bohemian Rhapsody
 *   👤 Queen
 *   💿 A Night at the Opera
 *   📅 1975
 *   ⏱️ 5:54
 *   🎯 Confidence: 97%
 */
export async function copySongDetails(song: SongResult): Promise<void> {
  const details = formatSongDetails(song); // Build the text block
  await Clipboard.copy(details); // Put it in the clipboard
  await showHUD("✓ Song details copied to clipboard"); // Show a brief confirmation
}

// ─── Build plain-text song details ───────────────────────────────────────────

/**
 * formatSongDetails
 *
 * Builds the song info as a multi-line plain-text string.
 * Used by copySongDetails above and could be reused elsewhere.
 *
 * We start with an array of lines, only push optional ones if the
 * data actually exists, then join with newlines at the end.
 */
export function formatSongDetails(song: SongResult): string {
  // Start with the required fields
  const lines = [`🎵 ${song.title}`, `👤 ${song.artist}`];

  // Optional fields — only add them if the data is present
  if (song.album) {
    lines.push(`💿 ${song.album}`);
  }

  if (song.releaseYear) {
    lines.push(`📅 ${song.releaseYear}`);
  }

  if (song.duration) {
    // Convert total seconds into MM:SS format
    // e.g. 354 seconds → "5:54"
    const minutes = Math.floor(song.duration / 60);
    const seconds = song.duration % 60; // remainder after removing full minutes
    // padStart(2, "0") makes "4" → "04" so it looks like a clock
    lines.push(`⏱️ ${minutes}:${seconds.toString().padStart(2, "0")}`);
  }

  if (song.confidence !== undefined) {
    // Confidence is 0.0–1.0; multiply by 100 to get a percentage
    // toFixed(0) rounds to the nearest whole number
    lines.push(`🎯 Confidence: ${(song.confidence * 100).toFixed(0)}%`);
  }

  // Join all lines with a newline character between each
  return lines.join("\n");
}

// ─── Build a Markdown-formatted view ─────────────────────────────────────────

/**
 * createMarkdownView
 *
 * Builds a Markdown string that Raycast's <Detail> component renders
 * as a nicely formatted article with headings, bold labels, and images.
 *
 * Markdown is a simple text format: # = big heading, ** text ** = bold, etc.
 * Raycast converts it to a polished visual layout automatically.
 */
export function createMarkdownView(song: SongResult): string {
  // Use # for a large title and ## for a slightly smaller sub-title
  const lines = [`# 🎵 ${song.title}`, `## 👤 ${song.artist}`];

  if (song.albumArtUrl) {
    lines.push(`<img src="${song.albumArtUrl}" width="180" />`);
  }

  // Join lines with a BLANK LINE between each so Markdown renders them as separate paragraphs
  return lines.join("\n\n");
}
