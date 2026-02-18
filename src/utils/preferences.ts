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
import { RecognitionServiceType } from "../services/types";

// ─── The shape of the settings object ────────────────────────────────────────
//
// This interface mirrors what's declared in package.json under "preferences".
// TypeScript uses it to tell us what fields exist and their types.
// The '?' means "this field might be missing / the user left it blank".
//
export interface Preferences {
  service: RecognitionServiceType; // Which recognition engine to use
  recordingDuration: number;       // How many seconds to record (3–15)
  inputDevice?: string;            // Name of a specific mic — blank means auto-detect
  auddApiKey?: string;             // API key for AudD (only needed if using AudD)
  acrcloudAccessKey?: string;      // Access key for ACRCloud
  acrcloudAccessSecret?: string;   // Secret for ACRCloud (like a password paired with the key)
  acrcloudHost?: string;           // ACRCloud server address (varies by region)
  acoustIdApiKey?: string;         // Optional personal AcoustID key (a free shared key is used otherwise)
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
    // If the user never set a service, default to Chromaprint (free)
    service: prefs.service || RecognitionServiceType.CHROMAPRINT,

    // Raycast returns all preference values as strings, even numbers,
    // so we must convert with Number().  If somehow it's empty, default to 15 seconds.
    recordingDuration: Number(prefs.recordingDuration) || 15,

    // Trim any accidental spaces the user may have typed; if blank → undefined (= auto-detect)
    inputDevice: prefs.inputDevice?.trim() || undefined,

    // API keys — pass through as-is; undefined means the user left them blank
    auddApiKey: prefs.auddApiKey,
    acrcloudAccessKey: prefs.acrcloudAccessKey,
    acrcloudAccessSecret: prefs.acrcloudAccessSecret,
    acrcloudHost: prefs.acrcloudHost,
    acoustIdApiKey: prefs.acoustIdApiKey,
  };

  // Log a summary (without logging actual secret keys — security 101)
  console.log("[Preferences] Loaded:", {
    service: preferences.service,
    duration: preferences.recordingDuration,
    inputDevice: preferences.inputDevice || "(auto-detect)",
    hasAuddKey: !!preferences.auddApiKey,          // !! converts a value to true/false
    hasACRCloudKey: !!preferences.acrcloudAccessKey,
    hasACRCloudSecret: !!preferences.acrcloudAccessSecret,
    hasAcoustIdKey: !!preferences.acoustIdApiKey,
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

  // Recording duration must be between 3 and 15 seconds.
  // Too short = not enough audio to fingerprint.
  // Too long = slow and wastes time.
  if (prefs.recordingDuration < 3 || prefs.recordingDuration > 15) {
    console.error("[Preferences] Invalid recording duration:", prefs.recordingDuration);
    return "Recording duration must be between 3 and 15 seconds";
  }

  console.log("[Preferences] Validation passed");
  return null; // null = "no problem found"
}
