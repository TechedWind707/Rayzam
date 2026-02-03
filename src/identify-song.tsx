/**
 * Main command: Identify Song
 * Records audio and identifies the currently playing song
 */

import React from "react";
import { Detail, ActionPanel, Action, Icon, Toast, showToast, open } from "@raycast/api";
import { useState, useEffect, useRef } from "react";
import { AudioRecorder } from "./services/recorder";
import { createRecognitionService } from "./services";
import { SongResult, RecognitionError, RecognitionServiceType } from "./services/types";
import { getPreferences, validatePreferences } from "./utils/preferences";
import { HistoryDatabase } from "./storage/database";
import {
  copySongDetails,
  createMarkdownView,
  openInSpotify,
  openInAppleMusic,
  openInYouTube,
} from "./utils/actions";

const ACOUSTID_API_URL = "https://acoustid.org/new-application";

export default function IdentifySongCommand() {
  const [song, setSong] = useState<SongResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(true);
  const isIdentifying = useRef(false);
  const hasShownAcoustIdNudge = useRef(false);

  useEffect(() => {
    if (isIdentifying.current) return;
    console.log("[SongSnap] Command initialized, starting identification...");
    identifySong();
  }, []);

  async function identifySong(): Promise<void> {
    if (isIdentifying.current) {
      console.log("[SongSnap] Identification already in progress, skipping duplicate call");
      return;
    }

    let recorder: AudioRecorder | null = null;
    let audioFilePath: string | null = null;

    try {
      isIdentifying.current = true;
      console.log("[SongSnap] Step 1: Getting preferences...");
      const prefs = getPreferences();
      console.log("[SongSnap] Preferences loaded:", {
        service: prefs.service,
        duration: prefs.recordingDuration,
      });

      const validationError = validatePreferences(prefs);

      if (validationError) {
        console.error("[SongSnap] Preference validation failed:", validationError);
        throw new Error(validationError);
      }

      if (prefs.service === RecognitionServiceType.CHROMAPRINT && !prefs.acoustIdApiKey && !hasShownAcoustIdNudge.current) {
        const toast = await showToast({
          style: Toast.Style.Animated,
          title: "Using shared AcoustID key",
          message: "Get your own at acoustid.org/new-application",
        });
        toast.primaryAction = {
          title: "Get API Key",
          onAction: () => open(ACOUSTID_API_URL),
        };
        hasShownAcoustIdNudge.current = true;
      }

      console.log("[SongSnap] Step 2: Starting audio recording...");
      setRecording(true);
      await showToast({
        style: Toast.Style.Animated,
        title: "🎤 Recording...",
        message: `${prefs.recordingDuration} seconds`,
      });

      recorder = new AudioRecorder();
      console.log("[SongSnap] AudioRecorder created, recording for", prefs.recordingDuration, "seconds");
      audioFilePath = await recorder.recordAudioToFile(prefs.recordingDuration);

      console.log("[SongSnap] Audio recorded successfully, file:", audioFilePath);
      setRecording(false);

      await showToast({
        style: Toast.Style.Animated,
        title: "🔍 Identifying...",
        message: "Sending to recognition service",
      });

      console.log("[SongSnap] Step 3: Creating recognition service...");
      const service = createRecognitionService();

      console.log("[SongSnap] Step 4: Sending audio to recognition service...");
      const result = await service.recognize(audioFilePath);

      console.log("[SongSnap] Song recognized:", {
        title: result.title,
        artist: result.artist,
        confidence: result.confidence,
      });
      setSong(result);

      // Save to history
      console.log("[SongSnap] Step 5: Saving to history database...");
      const db = new HistoryDatabase();
      const historyEntry = await db.addSong(result.title, result.artist, {
        album: result.album ?? undefined,
        releaseYear: result.releaseYear,
        service: prefs.service,
        timestamp: Date.now(),
        confidence: result.confidence,
      });
      db.close();

      console.log("[SongSnap] Song saved to history with ID:", historyEntry.id);

      await showToast({
        style: Toast.Style.Success,
        title: "✓ Song identified!",
        message: `${result.title} by ${result.artist}`,
      });

      console.log("[SongSnap] Identification complete!");
      setLoading(false);
    } catch (err) {
      let errorMessage = "Unknown error occurred";
      let errorDetails = "";

      if (err instanceof RecognitionError) {
        errorMessage = `${err.service}: ${err.message}`;
        errorDetails = err.originalError?.message || "";
      } else if (err instanceof Error) {
        errorMessage = err.message;
        errorDetails = err.stack || "";
      }

      console.error("[SongSnap] ERROR during identification:", errorMessage);
      console.error("[SongSnap] Error details:", errorDetails);
      console.error("[SongSnap] Full error object:", err);

      setError(errorMessage);
      setLoading(false);

      await showToast({
        style: Toast.Style.Failure,
        title: "✗ Failed to identify song",
        message: errorMessage,
      });
    } finally {
      if (recorder && audioFilePath) {
        await recorder.cleanupAudioFile(audioFilePath);
      }
      isIdentifying.current = false;
    }
  }

  if (error) {
    return (
      <Detail
        markdown={`# ✗ Error\n\n${error}`}
        actions={
          <ActionPanel>
            <Action title="Try Again" onAction={identifySong} icon={Icon.RotateClockwise} />
          </ActionPanel>
        }
      />
    );
  }

  if (!song) {
    return (
      <Detail markdown={`# ${recording ? "🎤 Recording" : "🔍 Identifying..."}\n\nPlease wait...`} />
    );
  }

  return (
    <Detail
      markdown={createMarkdownView(song)}
      actions={
        <ActionPanel>
          {song.spotifyId && (
            <Action
              title="Open in Spotify"
              icon={{ source: "https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/spotify.svg" }}
              onAction={() => openInSpotify(song.spotifyId)}
            />
          )}
          <Action
            title="Search on Spotify"
            icon={{ source: "https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/spotify.svg" }}
            onAction={() => openInSpotify(undefined, song.artist, song.title)}
          />
          {song.appleMusicUrl && (
            <Action
              title="Open in Apple Music"
              icon={{ source: "https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/applemusic.svg" }}
              onAction={() => openInAppleMusic(song.appleMusicUrl)}
            />
          )}
          <Action
            title="Search on Apple Music"
            icon={{ source: "https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/applemusic.svg" }}
            onAction={() => openInAppleMusic(undefined, song.artist, song.title)}
          />
          {song.youtubeUrl && (
            <Action
              title="Watch on YouTube"
              icon={{ source: "https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/youtube.svg" }}
              onAction={() => openInYouTube(song.youtubeUrl)}
            />
          )}
          <Action
            title="Search on YouTube"
            icon={{ source: "https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/youtube.svg" }}
            onAction={() => openInYouTube(undefined, song.artist, song.title)}
          />
          <Action title="Copy Song Details" icon={Icon.Clipboard} onAction={() => copySongDetails(song)} />
          <Action title="Identify Another Song" icon={Icon.RotateClockwise} onAction={identifySong} />
        </ActionPanel>
      }
    />
  );
}
