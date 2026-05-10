/**
 * ─────────────────────────────────────────────────────────────────
 * identify-song.tsx  —  The main "Identify Song" command for Rayzam
 * ─────────────────────────────────────────────────────────────────
 *
 * This is the first screen users see when they launch Rayzam.
 * It walks through three phases:
 *
 *   PHASE 1 — READY (idle)
 *   Show a "ready" screen with the selected microphone name.
 *   The user presses ↵ to start, or ⌘K to open the Actions menu
 *   where they can change the audio input device.
 *
 *   PHASE 2 — RECORDING + IDENTIFYING
 *   The app records audio for the configured duration (default 15s),
 *   then sends it to the chosen recognition service.
 *   A toast notification keeps the user updated on progress.
 *
 *   PHASE 3 — RESULT
 *   The identified song is displayed with links to Spotify, Apple
 *   Music, YouTube, and a copy-to-clipboard action.
 *
 * If the song can't be found, or if an error occurs, we show a
 * simple screen with a "Try Again" button.
 * ─────────────────────────────────────────────────────────────────
 */

import React from "react";
import {
  Detail, // Renders a Markdown-based detail screen
  ActionPanel, // Container for actions shown in the ⌘K menu
  Action, // A single action item
  Icon, // Raycast's built-in icon set
  Toast, // Type definitions for toast notifications
  showToast, // Shows a brief notification to the user
  LocalStorage, // Key-value storage used to load the device label
  environment, // Gives us the bundled assets folder path
} from "@raycast/api";
import * as path from "path";
import { pathToFileURL } from "url";
import { useState, useEffect, useRef } from "react";
import { AudioRecorder } from "./services/recorder";
import { createRecognitionService } from "./services";
import { SongResult, RecognitionError, AudioRecordingError, RecognitionServiceType } from "./services/types";
import { getPreferences, validatePreferences } from "./utils/preferences";
import { HistoryDatabase } from "./storage/database";
import {
  copySongDetails,
  openInSpotify,
  openInAppleMusic,
  openInYouTube,
  openInYouTubeMusic,
  runPostMatchAction,
} from "./utils/actions";
// SelectDeviceView is the screen pushed when the user picks "Change Audio Input Device"
import SelectDeviceView, { SELECTED_DEVICE_KEY } from "./components/SelectDeviceView";

const MIN_RECORDING_SECONDS = 10;
const SELECTED_SERVICE_KEY = "selectedRecognitionService";
const RAYZAM_ICON_MARKDOWN = `<img src="${pathToFileURL(path.join(environment.assetsPath, "icon.png")).href}" width="72" />`;

function getServiceLabel(service: RecognitionServiceType): string {
  switch (service) {
    case RecognitionServiceType.AUDD:
      return "AudD";
    case RecognitionServiceType.ACRCLOUD:
    default:
      return "ACRCloud";
  }
}

function formatDuration(seconds?: number): string | undefined {
  if (!seconds) return undefined;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function formatConfidence(confidence?: number): string | undefined {
  if (confidence === undefined) return undefined;

  return `${Math.round(confidence * 100)}%`;
}

function createResultMarkdown(song: SongResult): string {
  const lines = [`# ${song.title}`, `## ${song.artist}`];

  if (song.albumArtUrl) {
    lines.push(`<img src="${song.albumArtUrl}" width="180" />`);
  }

  return lines.join("\n\n");
}

function SongResultMetadata({
  song,
  service,
}: {
  song: SongResult;
  service: RecognitionServiceType;
}) {
  const duration = formatDuration(song.duration);
  const confidence = formatConfidence(song.confidence);

  return (
    <Detail.Metadata>
      <Detail.Metadata.Label title="Recognition Service" text={getServiceLabel(service)} />
      {confidence && <Detail.Metadata.Label title="Confidence" text={confidence} />}
      {song.album && <Detail.Metadata.Label title="Album" text={song.album} />}
      {song.releaseYear && <Detail.Metadata.Label title="Release Year" text={`${song.releaseYear}`} />}
      {duration && <Detail.Metadata.Label title="Duration" text={duration} />}
      {song.isrc && <Detail.Metadata.Label title="ISRC" text={song.isrc} />}
      {(song.spotifyId || song.youtubeUrl || song.appleMusicUrl) && <Detail.Metadata.Separator />}
      {song.spotifyId && <Detail.Metadata.Label title="Spotify ID" text={song.spotifyId} />}
      {song.youtubeUrl && <Detail.Metadata.Link title="YouTube" text="Open Video" target={song.youtubeUrl} />}
      {song.appleMusicUrl && (
        <Detail.Metadata.Link title="Apple Music" text="Open Track" target={song.appleMusicUrl} />
      )}
    </Detail.Metadata>
  );
}

// Shape of the device object stored in LocalStorage (used only for display here)
interface StoredDevice {
  id: string;
  name: string;
  platform: string;
}

// ─── The main React component ─────────────────────────────────────────────────
export default function IdentifySongCommand() {
  // ── State variables ──────────────────────────────────────────────────────
  // Each useState creates a reactive variable.
  // When you call the setter (e.g. setIdle(false)), the component re-renders.

  const [idle, setIdle] = useState(true); // true = show the ready screen
  const [song, setSong] = useState<SongResult | null>(null); // The identified song (or null)
  const [, setLoading] = useState(false); // true = recording or identifying
  const [error, setError] = useState<string | null>(null); // Error message (or null)
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const [noMatch, setNoMatch] = useState(false); // true = service returned "no match"
  const [recording, setRecording] = useState(false); // true = currently capturing audio
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [recordingLimit, setRecordingLimit] = useState(15);
  const [deviceLabel, setDeviceLabel] = useState<string>("Auto-detect"); // Text shown on the ready screen
  const [selectedService, setSelectedService] = useState<RecognitionServiceType>(
    RecognitionServiceType.ACRCLOUD
  );

  // useRef creates a mutable box that persists across renders but does NOT trigger re-renders.
  // We use it to track "is a recognition already in progress?" so we never start two at once.
  const isIdentifying = useRef(false);
  const recordingSessionRef = useRef<null | { stop: () => Promise<void> }>(null);

  useEffect(() => {
    if (!recording) {
      setRecordingElapsed(0);
      return;
    }

    const startedAt = Date.now();
    setRecordingElapsed(0);
    const interval = setInterval(() => {
      setRecordingElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [recording]);

  // ── On mount: load the saved device name for display ─────────────────────
  //
  // useEffect with an empty [] runs once when the component first appears.
  // We read LocalStorage to find out what device (if any) the user picked,
  // so we can show e.g. "🎤 Input device: Microphone (Realtek Audio)" on the ready screen.
  //
  useEffect(() => {
    try {
      const prefs = getPreferences();
      setSelectedService(prefs.service);
      setRecordingLimit(prefs.recordingDuration);
    } catch {
      // Raycast will surface missing required preferences through onboarding.
    }

    LocalStorage.getItem<string>(SELECTED_SERVICE_KEY).then((stored) => {
      if (
        stored === RecognitionServiceType.ACRCLOUD ||
        stored === RecognitionServiceType.AUDD
      ) {
        setSelectedService(stored);
      }
    });

    LocalStorage.getItem<string>(SELECTED_DEVICE_KEY).then((stored) => {
      if (!stored) return; // Nothing saved — keep the "Auto-detect" default
      try {
        const parsed: StoredDevice = JSON.parse(stored);
        // Only use the saved name if it's for the OS we're currently on
        if (parsed.platform === process.platform && parsed.name) {
          setDeviceLabel(parsed.name);
        }
      } catch {
        // Ignore parse errors — stale or corrupted data in storage
      }
    });
  }, []);

  // ── startRecording ────────────────────────────────────────────────────────
  //
  // Called when the user presses ↵ on the ready screen, or "Try Again" /
  // "Identify Another Song" after a previous result.
  //
  function startRecording() {
    setIdle(false); // Leave the ready screen
    identifySong(); // Begin the record → identify workflow
  }

  async function chooseRecognitionService(service: RecognitionServiceType): Promise<void> {
    setSelectedService(service);
    await LocalStorage.setItem(SELECTED_SERVICE_KEY, service);
    await showToast({
      style: Toast.Style.Success,
      title: `Using ${getServiceLabel(service)}`,
    });
  }

  // ── identifySong ─────────────────────────────────────────────────────────
  //
  // The core async workflow:
  //   1. Validate settings
  //   2. Record audio to a temp .wav file
  //   3. Send it to the recognition service
  //   4. Display the result and save it to history
  //
  async function identifySong(): Promise<void> {
    // Guard against accidental double-invocation
    if (isIdentifying.current) {
      console.log("[Rayzam] Identification already in progress, skipping duplicate call");
      return;
    }

    let recorder: AudioRecorder | null = null;
    let audioFilePath: string | null = null;

    try {
      isIdentifying.current = true;

      // Reset all state to a clean "loading" state
      setLoading(true);
      setError(null);
      setSetupMessage(null);
      setNoMatch(false);
      setSong(null);

      // ── Step 1: Load and validate settings ───────────────────────────────
      console.log("[Rayzam] Step 1: Getting preferences...");
      const prefs = getPreferences();
      console.log("[Rayzam] Preferences loaded:", {
        service: prefs.service,
        selectedService,
        duration: prefs.recordingDuration,
      });
      setRecordingLimit(prefs.recordingDuration);

      const validationError = validatePreferences(prefs);
      if (validationError) {
        console.error("[Rayzam] Preference validation failed:", validationError);
        throw new Error(validationError);
      }

      console.log("[Rayzam] Step 2: Checking selected recognition service setup...");
      const service = createRecognitionService(selectedService);

      // ── Step 2: Record audio ──────────────────────────────────────────────
      console.log("[Rayzam] Step 3: Starting audio recording...");
      setRecording(true);

      // Show a "Recording…" toast so the user knows something is happening
      await showToast({
        style: Toast.Style.Animated,
        title: "🎤 Recording...",
        message: `Stop available after ${MIN_RECORDING_SECONDS}s`,
      });

      recorder = new AudioRecorder();
      const recordingSession = await recorder.startRecordingSession(prefs.recordingDuration);
      recordingSessionRef.current = recordingSession;
      audioFilePath = await recordingSession.finished;
      console.log("[Rayzam] Audio recorded successfully, file:", audioFilePath);
      setRecording(false);
      recordingSessionRef.current = null;

      // ── Step 3: Send to recognition service ───────────────────────────────
      await showToast({
        style: Toast.Style.Animated,
        title: "🔍 Identifying...",
        message: "Sending to recognition service",
      });

      console.log("[Rayzam] Step 4: Sending audio to recognition service...");
      // Cast to SongResult — every service implementation returns the richer SongResult type,
      // but the RecognitionService interface only promises the base RecognitionResult.
      const result = (await service.recognize(audioFilePath)) as SongResult;

      console.log("[Rayzam] Song recognized:", {
        title: result.title,
        artist: result.artist,
        confidence: result.confidence,
        spotifyId: result.spotifyId,
        youtubeUrl: result.youtubeUrl,
        appleMusicUrl: result.appleMusicUrl,
        albumArtUrl: result.albumArtUrl,
        alternatives: prefs.saveAlternativeMatches ? result.alternatives : undefined,
      });
      setSong(result); // Show the result screen

      // ── Step 4: Save to history ───────────────────────────────────────────
      console.log("[Rayzam] Step 5: Saving to history database...");
      const db = new HistoryDatabase();
      const historyEntry = await db.addSong(result.title, result.artist, {
        album: result.album ?? undefined,
        releaseYear: result.releaseYear,
        service: selectedService,
        timestamp: Date.now(),
        confidence: result.confidence,
        spotifyId: result.spotifyId,
        youtubeUrl: result.youtubeUrl,
        appleMusicUrl: result.appleMusicUrl,
        albumArtUrl: result.albumArtUrl,
      });
      db.close();
      console.log("[Rayzam] Song saved to history with ID:", historyEntry.id);

      await runPostMatchAction(result, prefs.postMatchAction);

      await showToast({
        style: Toast.Style.Success,
        title: "✓ Song identified!",
        message: `${result.title} by ${result.artist}`,
      });

      console.log("[Rayzam] Identification complete!");
      setLoading(false);
    } catch (err) {
      // ── Error handling ────────────────────────────────────────────────────
      let errorMessage = "Unknown error occurred";
      let errorDetails = "";

      if (err instanceof RecognitionError) {
        // RecognitionError.message is "[service] detail" — strip the "[service] " prefix
        // so the user sees only the clean message, e.g.:
        //   "Your AudD API key is incorrect, invalid, or inactive.\n..."
        // instead of "[audd] Your AudD API key is incorrect..."
        errorMessage = err.message.replace(/^\[[^\]]+\]\s*/, "");
        errorDetails = err.originalError?.message || "";
      } else if (err instanceof AudioRecordingError) {
        errorMessage = err.message;
        errorDetails = err.originalError?.message || "";
      } else if (err instanceof Error) {
        errorMessage = err.message;
        errorDetails = err.stack || "";
      }

      const isMissingSetup =
        errorMessage.includes("[AudD Configuration Missing]") ||
        errorMessage.includes("[ACRCloud Configuration Missing]");

      if (isMissingSetup) {
        const cleanMessage = errorMessage
          .replace("[AudD Configuration Missing]\n", "")
          .replace("[ACRCloud Configuration Missing]\n", "");
        console.log("[Rayzam] Selected provider setup is incomplete:", cleanMessage);
        setSetupMessage(cleanMessage);
        setRecording(false);
        setLoading(false);
        await showToast({
          style: Toast.Style.Animated,
          title: "Setup Needed",
          message: "Add the credentials for your selected provider",
        });
        return;
      }

      // "No matches" is a normal outcome, not a crash — handle it separately
      const isNoMatch = errorMessage.toLowerCase().includes("no matches");
      if (isNoMatch) {
        console.log("[Rayzam] No matches returned by recognition service");
        setNoMatch(true);
        setLoading(false);
        await showToast({
          style: Toast.Style.Animated,
          title: "No matches returned",
          message: "Try another sample",
        });
        return;
      }

      console.error("[Rayzam] ERROR during identification:", errorMessage);
      console.error("[Rayzam] Error details:", errorDetails);
      console.error("[Rayzam] Full error object:", err);

      setRecording(false);
      setError(errorMessage);
      setLoading(false);

      await showToast({
        style: Toast.Style.Failure,
        title: "✗ Failed to identify song",
        message: errorMessage.split("\n")[0],
      });
    } finally {
      // 'finally' always runs — even if an error was thrown above
      // Clean up the temp audio file from disk
      if (recorder && audioFilePath) {
        await recorder.cleanupAudioFile(audioFilePath);
      }
      recordingSessionRef.current = null;
      isIdentifying.current = false; // Allow a new identification to start
    }
  }

  async function stopRecording(): Promise<void> {
    if (!recordingSessionRef.current) {
      return;
    }

    if (recordingElapsed < MIN_RECORDING_SECONDS) {
      await showToast({
        style: Toast.Style.Failure,
        title: `Wait ${MIN_RECORDING_SECONDS - recordingElapsed}s before stopping`,
        message: `Recording can be stopped after ${MIN_RECORDING_SECONDS} seconds`,
      });
      return;
    }

    await showToast({
      style: Toast.Style.Animated,
      title: "Stopping recording...",
    });

    await recordingSessionRef.current.stop();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER LOGIC
  //
  // React components return UI.  We use early returns for each state so only
  // one screen is ever rendered at a time.
  //
  // Order matters — check the most specific states first.
  // ════════════════════════════════════════════════════════════════════════════

  // ── PHASE 1: Ready screen ────────────────────────────────────────────────
  if (idle) {
    // Template literals (backticks + ${}) let us embed variables inside strings.
    // \n\n in Markdown = a blank line (paragraph break).
    const readyMarkdown = `${RAYZAM_ICON_MARKDOWN}\n\n# Identify Song\n\nRecognize music from your microphone.\n\n**Recognition service:** ${getServiceLabel(selectedService)}\n\n**Recording length:** ${recordingLimit}s\n\n **Input device**: _${deviceLabel}_`;

    return (
      <Detail
        markdown={readyMarkdown}
        actions={
          <ActionPanel>
            {/* Primary action — always visible as "↵ Start Recording" at the bottom of the screen */}
            <Action
              title="Start Recording"
              icon={Icon.Microphone}
              onAction={startRecording} // Kicks off the record → identify workflow
            />

            {/* Settings section — visible when the user opens Actions with ⌘K */}
            <ActionPanel.Section title="Settings">
              <Action
                title="Use ACRCloud"
                icon={selectedService === RecognitionServiceType.ACRCLOUD ? Icon.CheckCircle : Icon.Circle}
                onAction={() => chooseRecognitionService(RecognitionServiceType.ACRCLOUD)}
              />
              <Action
                title="Use AudD"
                icon={selectedService === RecognitionServiceType.AUDD ? Icon.CheckCircle : Icon.Circle}
                onAction={() => chooseRecognitionService(RecognitionServiceType.AUDD)}
              />
              {/* Action.Push navigates to a new screen (SelectDeviceView) without leaving this one */}
              <Action.Push
                title="Change Audio Input Device"
                icon={Icon.Microphone}
                target={<SelectDeviceView />} // The screen to push onto the navigation stack
              />
            </ActionPanel.Section>
          </ActionPanel>
        }
      />
    );
  }

  // ── No match ─────────────────────────────────────────────────────────────
  if (noMatch) {
    return (
      <Detail
        markdown={`# No matches returned\n\nWe couldn't find a match for this recording.`}
        actions={
          <ActionPanel>
            <Action title="Try Again" onAction={startRecording} icon={Icon.RotateClockwise} />
          </ActionPanel>
        }
      />
    );
  }

  // ── Setup needed ─────────────────────────────────────────────────────────
  if (setupMessage) {
    return (
      <Detail
        markdown={`# Setup Needed\n\n${setupMessage}`}
        actions={
          <ActionPanel>
            <Action title="Try Again" onAction={startRecording} icon={Icon.RotateClockwise} />
          </ActionPanel>
        }
      />
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <Detail
        markdown={`# ✗ Error\n\n${error}`}
        actions={
          <ActionPanel>
            <Action title="Try Again" onAction={startRecording} icon={Icon.RotateClockwise} />
          </ActionPanel>
        }
      />
    );
  }

  // ── Recording / identifying spinner ──────────────────────────────────────
  // 'song' is null while we're still working.
  // We show a different heading depending on whether we're recording or identifying.
  if (!song) {
    return (
      <Detail
        markdown={`# ${recording ? "🎤 Recording" : "🔍 Identifying..."}\n\n**Recognition service:** ${getServiceLabel(selectedService)}\n\n${recording ? `Elapsed: **${recordingElapsed}s**\n\nMinimum stop time: **${MIN_RECORDING_SECONDS}s**\n\nAuto stop: **${Math.max(MIN_RECORDING_SECONDS, recordingLimit)}s**` : "Please wait..."}`}
        actions={
          recording ? (
            <ActionPanel>
              <Action title="Stop Recording" icon={Icon.Stop} onAction={stopRecording} />
            </ActionPanel>
          ) : undefined
        }
      />
    );
  }

  // ── PHASE 3: Result screen ────────────────────────────────────────────────
  return (
    <Detail
      markdown={createResultMarkdown(song)}
      metadata={<SongResultMetadata song={song} service={selectedService} />}
      actions={
        <ActionPanel>
          {/* Only show "Open in Spotify" if we have a direct Spotify track ID */}
          {song.spotifyId && (
            <Action
              title="Open in Spotify"
              icon={{
                source:
                  "https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/spotify.svg",
              }}
              onAction={() => openInSpotify(song.spotifyId)}
            />
          )}
          {/* Search Spotify is always available — we build a search URL from title + artist */}
          <Action
            title="Search on Spotify"
            icon={{
              source:
                "https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/spotify.svg",
            }}
            onAction={() => openInSpotify(undefined, song.artist, song.title)}
          />
          {song.appleMusicUrl && (
            <Action
              title="Open in Apple Music"
              icon={{
                source:
                  "https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/applemusic.svg",
              }}
              onAction={() => openInAppleMusic(song.appleMusicUrl)}
            />
          )}
          <Action
            title="Search on Apple Music"
            icon={{
              source:
                "https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/applemusic.svg",
            }}
            onAction={() => openInAppleMusic(undefined, song.artist, song.title)}
          />
          {song.youtubeUrl && (
            <Action
              title="Watch on Youtube"
              icon={{
                source:
                  "https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/youtube.svg",
              }}
              onAction={() => openInYouTube(song.youtubeUrl)}
            />
          )}
          <Action
            title="Search on Youtube Music"
            icon={{
              source:
                "https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/youtube.svg",
            }}
            onAction={() => openInYouTubeMusic(song.artist, song.title)}
          />
          <Action
            title="Search on Youtube"
            icon={{
              source:
                "https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/youtube.svg",
            }}
            onAction={() => openInYouTube(undefined, song.artist, song.title)}
          />
          {/* Copies title, artist, album, year, duration, confidence to clipboard */}
          <Action
            title="Copy Song Details"
            icon={Icon.Clipboard}
            onAction={() => copySongDetails(song)}
          />
          {/* Restarts the whole flow — goes back to recording */}
          <Action
            title="Identify Another Song"
            icon={Icon.RotateClockwise}
            onAction={startRecording}
          />
        </ActionPanel>
      }
    />
  );
}
