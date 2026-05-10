/**
 * ─────────────────────────────────────────────────────────────────
 * preferences.ts  —  Reading the user's saved settings
 * ─────────────────────────────────────────────────────────────────
 *
 * In Raycast, every extension has a "Configure Extension" panel
 * where users fill in things like API keys, recording duration, etc.
 * Those settings are stored by Raycast behind the scenes.
 *
 * This file is the single place where we READ those settings.
 * Think of it like opening a specific drawer in a filing cabinet —
 * all the other parts of the app just call getPreferences() and
 * get back a tidy object instead of digging into Raycast internals.
 * ─────────────────────────────────────────────────────────────────
 */

// getPreferenceValues is Raycast's built-in function for reading settings
import { getPreferenceValues } from "@raycast/api";

// Import the enum so we can refer to services by name, not raw strings
import { PostMatchAction, RecognitionServiceType } from "../services/types";

// ─── The shape of the settings object ────────────────────────────────────────
//
// This interface mirrors what's declared in package.json under "preferences".
// TypeScript uses it to tell us what fields exist and their types.
// The '?' means "this field might be missing / the user left it blank".
//
export interface Preferences {
  service: RecognitionServiceType; // Which recognition engine to use
  recordingDuration: number; // How many seconds to record (10–30)
  postMatchAction: PostMatchAction; // What to do after a song is found
  enableDebugAudio: boolean; // Whether to keep a debug copy of recordings
  debugAudioDirectory?: string; // Folder for optional debug recordings
  enableDebugJson: boolean; // Whether to save raw provider JSON responses
  debugJsonDirectory?: string; // Folder for optional provider JSON responses
  saveAlternativeMatches: boolean; // Whether to store secondary provider candidates
  inputDevice?: string; // Name of a specific mic — blank means auto-detect
  auddApiKey?: string; // API key for AudD (only needed if using AudD)
  acrcloudAccessKey?: string; // Access key for ACRCloud
  acrcloudAccessSecret?: string; // Secret for ACRCloud (like a password paired with the key)
  acrcloudHost?: string; // ACRCloud server address (varies by region)
  acrcloudMetadataToken?: string; // Optional Bearer token for ACRCloud's Metadata API
  acrcloudMetadataHost?: string; // Optional Metadata API host
}

/**
 * getPreferences
 *
 * Call this anywhere in the app to get the user's current settings.
 * It always returns a complete Preferences object with sensible defaults
 * so the rest of the code never has to worry about missing values.
 */
export function getPreferences(): Preferences {
  console.log("[Preferences] Loading preferences...");

  // Ask Raycast for the raw values the user saved.
  // The generic <Preferences> tells TypeScript what shape to expect back.
  const prefs = getPreferenceValues<Preferences>();

  // Build a clean, normalised copy with defaults applied
  const preferences: Preferences = {
    // If the user never set a service, default to ACRCloud
    service: prefs.service || RecognitionServiceType.ACRCLOUD,

    // Raycast returns all preference values as strings, even numbers,
    // so we must convert with Number().  If somehow it's empty, default to 15 seconds.
    recordingDuration: Number(prefs.recordingDuration) || 15,

    // Default to showing the result details, which matches the current behavior.
    postMatchAction: prefs.postMatchAction || PostMatchAction.DETAILS,

    // Debug audio is opt-in because recordings may contain private ambient audio.
    enableDebugAudio: Boolean(prefs.enableDebugAudio),
    debugAudioDirectory: prefs.debugAudioDirectory?.trim() || undefined,
    enableDebugJson: Boolean(prefs.enableDebugJson),
    debugJsonDirectory: prefs.debugJsonDirectory?.trim() || undefined,
    saveAlternativeMatches: Boolean(prefs.saveAlternativeMatches),

    // Trim any accidental spaces the user may have typed; if blank → undefined (= auto-detect)
    inputDevice: prefs.inputDevice?.trim() || undefined,

    // API keys — pass through as-is; undefined means the user left them blank
    auddApiKey: prefs.auddApiKey,
    acrcloudAccessKey: prefs.acrcloudAccessKey,
    acrcloudAccessSecret: prefs.acrcloudAccessSecret,
    acrcloudHost: prefs.acrcloudHost?.trim() || undefined,
    acrcloudMetadataToken: prefs.acrcloudMetadataToken,
    acrcloudMetadataHost: prefs.acrcloudMetadataHost?.trim() || undefined,
  };

  // Log a summary (without logging actual secret keys — security 101)
  console.log("[Preferences] Loaded:", {
    service: preferences.service,
    duration: preferences.recordingDuration,
    postMatchAction: preferences.postMatchAction,
    enableDebugAudio: preferences.enableDebugAudio,
    debugAudioDirectory: preferences.debugAudioDirectory || "(Raycast support folder)",
    enableDebugJson: preferences.enableDebugJson,
    debugJsonDirectory: preferences.debugJsonDirectory || "(Raycast support folder)",
    saveAlternativeMatches: preferences.saveAlternativeMatches,
    inputDevice: preferences.inputDevice || "(auto-detect)",
    hasAuddKey: !!preferences.auddApiKey, // !! converts a value to true/false
    hasACRCloudKey: !!preferences.acrcloudAccessKey,
    hasACRCloudSecret: !!preferences.acrcloudAccessSecret,
    hasACRCloudMetadataToken: !!preferences.acrcloudMetadataToken,
  });

  return preferences;
}

/**
 * validatePreferences
 *
 * A simple sanity check.  Before we start recording, we call this
 * to catch obviously wrong values — like a recording duration of 999 seconds.
 *
 * Returns null if everything looks fine, or an error message string if not.
 * The caller decides whether to show that message to the user.
 */
export function validatePreferences(prefs: Preferences): string | null {
  console.log("[Preferences] Validating preferences...");

  // Recording duration must be between 10 and 30 seconds.
  // Too short = not enough audio to fingerprint.
  // Too long = slow and wastes time.
  if (prefs.recordingDuration < 10 || prefs.recordingDuration > 30) {
    console.error("[Preferences] Invalid recording duration:", prefs.recordingDuration);
    return "Recording duration must be between 10 and 30 seconds";
  }

  console.log("[Preferences] Validation passed");
  return null; // null = "no problem found"
}
