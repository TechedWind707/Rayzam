/**
 * ─────────────────────────────────────────────────────────────────
 * identify-song.tsx  —  The main "Identify Song" command
 * ─────────────────────────────────────────────────────────────────
 *
 * This is the first screen users see when they launch SongSnap.
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
  Detail,        // Renders a Markdown-based detail screen
  ActionPanel,   // Container for actions shown in the ⌘K menu
  Action,        // A single action item
  Icon,          // Raycast's built-in icon set
  Toast,         // Type definitions for toast notifications
  showToast,     // Shows a brief notification to the user
  open,          // Opens a URL in the browser or a native app
  LocalStorage,  // Key-value storage used to load the device label
} from "@raycast/api";
import { useState, useEffect, useRef } from "react";
import { AudioRecorder }                from "./services/recorder";
import { createRecognitionService }     from "./services";
import { SongResult, RecognitionError, RecognitionServiceType } from "./services/types";
import { getPreferences, validatePreferences } from "./utils/preferences";
import { HistoryDatabase }              from "./storage/database";
import {
  copySongDetails,
  createMarkdownView,
  openInSpotify,
  openInAppleMusic,
  openInYouTube,
} from "./utils/actions";
// SelectDeviceView is the screen pushed when the user picks "Change Audio Input Device"
import SelectDeviceView, { SELECTED_DEVICE_KEY } from "./components/SelectDeviceView";

// URL shown when nudging the user to get their own AcoustID key
const ACOUSTID_API_URL = "https://acoustid.org/new-application";

// Shape of the device object stored in LocalStorage (used only for display here)
interface StoredDevice {
  id:       string;
  name:     string;
  platform: string;
}

// ─── The main React component ─────────────────────────────────────────────────
export default function IdentifySongCommand() {

  // ── State variables ──────────────────────────────────────────────────────
  // Each useState creates a reactive variable.
  // When you call the setter (e.g. setIdle(false)), the component re-renders.

  const [idle,        setIdle]        = useState(true);   // true = show the ready screen
  const [song,        setSong]        = useState<SongResult | null>(null); // The identified song (or null)
  const [loading,     setLoading]     = useState(false);  // true = recording or identifying
  const [error,       setError]       = useState<string | null>(null); // Error message (or null)
  const [noMatch,     setNoMatch]     = useState(false);  // true = service returned "no match"
  const [recording,   setRecording]   = useState(false);  // true = currently capturing audio
  const [deviceLabel, setDeviceLabel] = useState<string>("Auto-detect"); // Text shown on the ready screen

  // useRef creates a mutable box that persists across renders but does NOT trigger re-renders.
  // We use it to track "is a recognition already in progress?" so we never start two at once.
  const isIdentifying          = useRef(false);
  // Tracks whether we've already shown the AcoustID "get your own key" nudge this session
  const hasShownAcoustIdNudge  = useRef(false);

  // ── On mount: load the saved device name for display ─────────────────────
  //
  // useEffect with an empty [] runs once when the component first appears.
  // We read LocalStorage to find out what device (if any) the user picked,
  // so we can show e.g. "🎤 Input device: Microphone (Realtek Audio)" on the ready screen.
  //
  useEffect(() => {
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
    setIdle(false);    // Leave the ready screen
    identifySong();    // Begin the record → identify workflow
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
      console.log("[SongSnap] Identification already in progress, skipping duplicate call");
      return;
    }

    let recorder:      AudioRecorder | null = null;
    let audioFilePath: string        | null = null;

    try {
      isIdentifying.current = true;

      // Reset all state to a clean "loading" state
      setLoading(true);
      setError(null);
      setNoMatch(false);
      setSong(null);

      // ── Step 1: Load and validate settings ───────────────────────────────
      console.log("[SongSnap] Step 1: Getting preferences...");
      const prefs = getPreferences();
      console.log("[SongSnap] Preferences loaded:", { service: prefs.service, duration: prefs.recordingDuration });

      const validationError = validatePreferences(prefs);
      if (validationError) {
        console.error("[SongSnap] Preference validation failed:", validationError);
        throw new Error(validationError);
      }

      // ── Nudge: suggest getting a personal AcoustID key ───────────────────
      // Only show this toast once per session (hasShownAcoustIdNudge guards it)
      if (prefs.service === RecognitionServiceType.CHROMAPRINT && !prefs.acoustIdApiKey && !hasShownAcoustIdNudge.current) {
        const toast = await showToast({
          style:   Toast.Style.Animated,
          title:   "Using shared AcoustID key",
          message: "Get your own at acoustid.org/new-application",
        });
        // Add a clickable button to the toast that opens the sign-up page
        toast.primaryAction = {
          title:    "Get API Key",
          onAction: () => open(ACOUSTID_API_URL),
        };
        hasShownAcoustIdNudge.current = true;
      }

      // ── Step 2: Record audio ──────────────────────────────────────────────
      console.log("[SongSnap] Step 2: Starting audio recording...");
      setRecording(true);

      // Show a "Recording…" toast so the user knows something is happening
      await showToast({
        style:   Toast.Style.Animated,
        title:   "🎤 Recording...",
        message: `${prefs.recordingDuration} seconds`,
      });

      recorder      = new AudioRecorder();
      audioFilePath = await recorder.recordAudioToFile(prefs.recordingDuration);
      console.log("[SongSnap] Audio recorded successfully, file:", audioFilePath);
      setRecording(false);

      // ── Step 3: Send to recognition service ───────────────────────────────
      await showToast({
        style:   Toast.Style.Animated,
        title:   "🔍 Identifying...",
        message: "Sending to recognition service",
      });

      console.log("[SongSnap] Step 3: Creating recognition service...");
      const service = createRecognitionService(); // Gets the right service based on settings

      console.log("[SongSnap] Step 4: Sending audio to recognition service...");
      // Cast to SongResult — every service implementation returns the richer SongResult type,
      // but the RecognitionService interface only promises the base RecognitionResult.
      const result = await service.recognize(audioFilePath) as SongResult;

      console.log("[SongSnap] Song recognized:", {
        title:      result.title,
        artist:     result.artist,
        confidence: result.confidence,
      });
      setSong(result); // Show the result screen

      // ── Step 4: Save to history ───────────────────────────────────────────
      console.log("[SongSnap] Step 5: Saving to history database...");
      const db           = new HistoryDatabase();
      const historyEntry = await db.addSong(result.title, result.artist, {
        album:       result.album ?? undefined,
        releaseYear: result.releaseYear,
        service:     prefs.service,
        timestamp:   Date.now(),
        confidence:  result.confidence,
      });
      db.close();
      console.log("[SongSnap] Song saved to history with ID:", historyEntry.id);

      await showToast({
        style:   Toast.Style.Success,
        title:   "✓ Song identified!",
        message: `${result.title} by ${result.artist}`,
      });

      console.log("[SongSnap] Identification complete!");
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
      } else if (err instanceof Error) {
        errorMessage = err.message;
        errorDetails = err.stack || "";
      }

      // "No matches" is a normal outcome, not a crash — handle it separately
      const isNoMatch = errorMessage.toLowerCase().includes("no matches");
      if (isNoMatch) {
        console.log("[SongSnap] No matches returned by recognition service");
        setNoMatch(true);
        setLoading(false);
        await showToast({
          style:   Toast.Style.Animated,
          title:   "No matches returned",
          message: "Try another sample",
        });
        return;
      }

      console.error("[SongSnap] ERROR during identification:", errorMessage);
      console.error("[SongSnap] Error details:", errorDetails);
      console.error("[SongSnap] Full error object:", err);

      setError(errorMessage);
      setLoading(false);

      await showToast({
        style:   Toast.Style.Failure,
        title:   "✗ Failed to identify song",
        message: errorMessage,
      });

    } finally {
      // 'finally' always runs — even if an error was thrown above
      // Clean up the temp audio file from disk
      if (recorder && audioFilePath) {
        await recorder.cleanupAudioFile(audioFilePath);
      }
      isIdentifying.current = false; // Allow a new identification to start
    }
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
    const readyMarkdown = `# 🎵 SongSnap\n\nReady to identify what's playing around you.\n\n🎤 Input device: **${deviceLabel}**`;

    return (
      <Detail
        markdown={readyMarkdown}
        actions={
          <ActionPanel>
            {/* Primary action — always visible as "↵ Start Recording" at the bottom of the screen */}
            <Action
              title="Start Recording"
              icon={Icon.Microphone}
              onAction={startRecording}  // Kicks off the record → identify workflow
            />

            {/* Settings section — visible when the user opens Actions with ⌘K */}
            <ActionPanel.Section title="Settings">
              {/* Action.Push navigates to a new screen (SelectDeviceView) without leaving this one */}
              <Action.Push
                title="Change Audio Input Device"
                icon={Icon.Microphone}
                target={<SelectDeviceView />}  // The screen to push onto the navigation stack
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
      <Detail markdown={`# ${recording ? "🎤 Recording" : "🔍 Identifying..."}\n\nPlease wait...`} />
    );
  }

  // ── PHASE 3: Result screen ────────────────────────────────────────────────
  // createMarkdownView(song) builds the Markdown text shown in the Detail pane
  return (
    <Detail
      markdown={createMarkdownView(song)}
      actions={
        <ActionPanel>
          {/* Only show "Open in Spotify" if we have a direct Spotify track ID */}
          {song.spotifyId && (
            <Action
              title="Open in Spotify"
              icon={{ source: "https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/spotify.svg" }}
              onAction={() => openInSpotify(song.spotifyId)}
            />
          )}
          {/* Search Spotify is always available — we build a search URL from title + artist */}
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

          {/* Copies title, artist, album, year, duration, confidence to clipboard */}
          <Action title="Copy Song Details" icon={Icon.Clipboard} onAction={() => copySongDetails(song)} />

          {/* Restarts the whole flow — goes back to recording */}
          <Action title="Identify Another Song" icon={Icon.RotateClockwise} onAction={startRecording} />
        </ActionPanel>
      }
    />
  );
}
