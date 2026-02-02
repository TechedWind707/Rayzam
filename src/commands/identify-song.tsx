/**
 * Main command: Identify Song
 * Records audio and identifies the currently playing song
 */

import React from "react";
import { Detail, ActionPanel, Action, Icon, Toast, showToast, showHUD } from "@raycast/api";
import { useState, useEffect } from "react";
import { AudioRecorder } from "../services/recorder";
import { ServiceFactory } from "../services";
import { SongResult, RecognitionError } from "../services/types";
import { getPreferences, validatePreferences } from "../utils/preferences";
import { HistoryDatabase } from "../storage/database";
import {
  copySongDetails,
  createMarkdownView,
  openInSpotify,
  openInAppleMusic,
  openInYouTube,
} from "../utils/actions";

export default function IdentifySongCommand() {
  const [song, setSong] = useState<SongResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(true);

  useEffect(() => {
    identifySong();
  }, []);

  async function identifySong(): Promise<void> {
    try {
      const prefs = getPreferences();
      const validationError = validatePreferences(prefs);

      if (validationError) {
        throw new Error(validationError);
      }

      setRecording(true);
      await showToast({
        style: Toast.Style.Animated,
        title: "🎤 Recording...",
        message: `${prefs.recordingDuration} seconds`,
      });

      const recorder = new AudioRecorder();
      const audioBuffer = await recorder.recordAudio(prefs.recordingDuration);

      setRecording(false);
      await showToast({
        style: Toast.Style.Animated,
        title: "🔍 Identifying...",
        message: "Sending to recognition service",
      });

      const service = ServiceFactory.createService({
        service: prefs.recognitionService,
        acrcloudAccessKey: prefs.acrcloudAccessKey,
        acrcloudAccessSecret: prefs.acrcloudAccessSecret,
        auddApiToken: prefs.auddApiToken,
      });

      const result = await service.recognize(audioBuffer);
      setSong(result);

      // Save to history
      const db = new HistoryDatabase();
      db.addSong({
        title: result.title,
        artist: result.artist,
        album: result.album,
        releaseYear: result.releaseYear,
        service: prefs.recognitionService,
        timestamp: Date.now(),
        confidence: result.confidence,
      });
      db.close();

      await showToast({
        style: Toast.Style.Success,
        title: "✓ Song identified!",
        message: `${result.title} by ${result.artist}`,
      });

      setLoading(false);
    } catch (err) {
      let errorMessage = "Unknown error occurred";

      if (err instanceof RecognitionError) {
        errorMessage = `${err.service}: ${err.message}`;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setLoading(false);

      await showToast({
        style: Toast.Style.Failure,
        title: "✗ Failed to identify song",
        message: errorMessage,
      });
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
      <Detail
        markdown={`# ${recording ? "🎤 Recording" : "🔍 Identifying..."}\n\nPlease wait...`}
      />
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
          <Action
            title="Copy Song Details"
            icon={Icon.Clipboard}
            onAction={() => copySongDetails(song)}
          />
          <Action title="Identify Another Song" icon={Icon.RotateClockwise} onAction={identifySong} />
        </ActionPanel>
      }
    />
  );
}
