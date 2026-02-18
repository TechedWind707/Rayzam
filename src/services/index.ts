/**
 * ─────────────────────────────────────────────────────────────────
 * index.ts  —  The "front desk receptionist" of the services folder
 * ─────────────────────────────────────────────────────────────────
 *
 * When you walk into a hospital, a receptionist checks your needs
 * and sends you to the right department — cardiology, orthopaedics,
 * whatever fits.  You don't have to know which department exists;
 * the receptionist handles that routing for you.
 *
 * This file does the same thing for music-recognition services.
 * The rest of the app just calls createRecognitionService() and gets
 * back whichever service the user chose in settings.  The caller
 * doesn't need to know how Chromaprint or AudD work internally.
 * ─────────────────────────────────────────────────────────────────
 */

// Import the shared "shape" every service must follow (the contract)
import { RecognitionService, RecognitionServiceType } from "./types";

// Import the three actual service implementations
import { ChromaprintService } from "./chromaprint"; // Free, fingerprint-based
import { AudDService }        from "./audd";         // Freemium API
import { ACRCloudService }    from "./acrcloud";     // Paid, enterprise-grade

// Read the user's settings (which service they picked, their API keys, etc.)
import { getPreferences } from "../utils/preferences";

/**
 * createRecognitionService
 *
 * Reads the user's preferences and hands back the right service object.
 * The returned object always has a .recognize(audioPath) method, no matter
 * which service was chosen — that's the beauty of the RecognitionService
 * contract defined in types.ts.
 */
export function createRecognitionService(): RecognitionService {
  // Load whatever the user has saved in Raycast's "Configure Extension" panel
  const preferences = getPreferences();

  // Default to Chromaprint if nothing was set (it's free and requires no key)
  const service = preferences.service || RecognitionServiceType.CHROMAPRINT;

  console.log("[ServiceFactory] Creating service:", service);

  // A switch is like a series of "if this choice, do that" rules
  switch (service) {

    // ── Chromaprint (free, no sign-up needed) ────────────────────────────────
    case RecognitionServiceType.CHROMAPRINT:
      console.log("[ServiceFactory] Using FREE Chromaprint + AcoustID");
      // Optionally pass the user's own AcoustID API key; if blank we use a shared one
      return new ChromaprintService(preferences.acoustIdApiKey);

    // ── AudD (requires an account and API token) ──────────────────────────────
    case RecognitionServiceType.AUDD:
      if (!preferences.auddApiKey) {
        // Safety net: if the user picked AudD but forgot to enter their key,
        // fall back to the free Chromaprint service instead of crashing
        console.warn("[ServiceFactory] AudD selected but no API key, falling back to Chromaprint");
        return new ChromaprintService(preferences.acoustIdApiKey);
      }
      console.log("[ServiceFactory] Using AudD with API key");
      return new AudDService(preferences.auddApiKey);

    // ── ACRCloud (paid, highest accuracy) ────────────────────────────────────
    case RecognitionServiceType.ACRCLOUD:
      if (!preferences.acrcloudAccessKey || !preferences.acrcloudAccessSecret) {
        // Same safety net: missing credentials → fall back to free Chromaprint
        console.warn("[ServiceFactory] ACRCloud selected but credentials missing, falling back to Chromaprint");
        return new ChromaprintService(preferences.acoustIdApiKey);
      }
      console.log("[ServiceFactory] Using ACRCloud");
      return new ACRCloudService(
        preferences.acrcloudAccessKey,
        preferences.acrcloudAccessSecret,
        // Use the user-configured host, or the default EU endpoint
        preferences.acrcloudHost || "identify-eu-west-1.acrcloud.com"
      );

    // ── Unknown / future services ─────────────────────────────────────────────
    default:
      console.log("[ServiceFactory] Unknown service, defaulting to Chromaprint");
      return new ChromaprintService(preferences.acoustIdApiKey);
  }
}

// Re-export everything from types.ts so other files can import types
// directly from "services" instead of "services/types".
// Think of it like a store that stocks products from multiple suppliers
// but you just go to one address to buy them all.
export * from "./types";
