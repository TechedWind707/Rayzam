/**
 * ─────────────────────────────────────────────────────────────────
 * recorder.ts  —  Recording audio from the microphone
 * ─────────────────────────────────────────────────────────────────
 *
 * This file's job is simple: press "record", wait, stop, hand back
 * a .wav audio file.
 *
 * Under the hood it uses FFMPEG — a free, powerful command-line tool
 * for working with audio and video.  Think of ffmpeg like a pro
 * audio engineer you're shouting instructions to through a terminal.
 *
 * CROSS-PLATFORM CHALLENGE
 * Every OS has its own audio system:
 *   • Windows  → DirectShow (dshow)   — devices named like "Microphone (Realtek)"
 *   • macOS    → AVFoundation         — devices referenced by index numbers (0, 1, 2…)
 *   • Linux    → PulseAudio / ALSA    — devices named like "alsa_input.pci-0000..."
 *
 * This file detects which OS we're on and runs the right ffmpeg command.
 *
 * DEVICE SELECTION PRIORITY
 * We check three places for a preferred microphone, in this order:
 *   1. The in-app device picker (stored in Raycast's LocalStorage)
 *   2. The "Audio Input Device" textfield in Configure Extension
 *   3. Auto-detect (let ffmpeg pick the system default)
 * ─────────────────────────────────────────────────────────────────
 */

import { exec, type ExecOptions } from "child_process"; // Runs shell commands (like typing in a terminal)
import { promisify } from "util"; // Wraps callback functions in Promises
import * as fs from "fs"; // File system — read, write, delete files
import * as path from "path"; // Build file paths that work on any OS
import * as os from "os"; // Get info about the operating system
import { environment, LocalStorage } from "@raycast/api"; // Raycast paths and key-value storage
import { AudioRecordingError } from "./types";
import { getPreferences } from "../utils/preferences";

const execAsync = promisify(exec); // Now we can "await" exec() instead of using callbacks

// This key must match the one used in SelectDeviceView.tsx
// Think of it like a locker number — both files use the same number to access the same locker
const SELECTED_DEVICE_KEY = "selectedAudioDevice";

export interface RecordingSession {
  filePath: string;
  finished: Promise<string>;
  stop: () => Promise<void>;
}

// Shape of the device object stored in LocalStorage
interface StoredDevice {
  id: string; // The device identifier (name on Windows, index on macOS)
  name: string; // Human-readable name shown in the UI
  platform: string; // "win32", "darwin", or "linux" — ensures we only use the right platform's value
}

export class AudioRecorder {
  private platform: string; // Current OS: "win32", "darwin", "linux"
  private tempDir: string; // Folder where we write the temporary audio file
  private cachedAudioDevice: string | null = null; // Saves the auto-detected device so we don't re-run detection every time

  constructor() {
    this.platform = process.platform; // e.g. "win32"
    this.tempDir = os.tmpdir(); // e.g. "C:\Users\You\AppData\Local\Temp" on Windows
  }

  /**
   * getPreferredDevice  (private, async)
   *
   * Checks for a saved device preference and returns the device ID,
   * or null if none is set (= auto-detect).
   *
   * Priority:
   *   1. LocalStorage (set via the "Change Audio Input Device" action in-app)
   *   2. Preferences textfield (set manually in Configure Extension)
   *   3. null → auto-detect
   */
  private async getPreferredDevice(): Promise<string | null> {
    // ── Check LocalStorage first ──────────────────────────────────────────
    try {
      const stored = await LocalStorage.getItem<string>(SELECTED_DEVICE_KEY);
      if (stored) {
        const parsed: StoredDevice = JSON.parse(stored);
        // Only use the stored value if it's for the current platform
        // (prevents using a Windows device name when running on macOS)
        if (parsed.platform === process.platform && parsed.id) {
          console.log(
            "[AudioRecorder] Using device from in-app picker:",
            parsed.id,
            `(${parsed.name})`
          );
          return parsed.id;
        }
      }
    } catch {
      // Silently ignore — corrupted data, parse failure, etc.
    }

    // ── Fall back to preferences textfield ───────────────────────────────
    try {
      const prefs = getPreferences();
      if (prefs.inputDevice) {
        console.log("[AudioRecorder] Using device from preferences:", prefs.inputDevice);
        return prefs.inputDevice;
      }
    } catch {
      // Silently ignore
    }

    return null; // Nothing set → use auto-detect
  }

  /**
   * detectWindowsAudioDevice  (private, async)
   *
   * Runs "ffmpeg -list_devices" to ask Windows what audio input
   * devices are available, then picks the first one.
   *
   * We cache the result so we only run this once per AudioRecorder
   * instance, not on every recording.
   */
  private async detectWindowsAudioDevice(): Promise<string> {
    if (this.cachedAudioDevice) {
      console.log("[AudioRecorder] Using cached audio device:", this.cachedAudioDevice);
      return this.cachedAudioDevice;
    }

    console.log("[AudioRecorder] Detecting available audio devices...");
    try {
      // This command asks ffmpeg to list all DirectShow devices and then exits
      // It always "fails" (non-zero exit code) because we didn't give it a real input,
      // so we use .catch() to capture the output anyway
      const result = await execAsync(`ffmpeg -list_devices true -f dshow -i dummy`, {
        shell: "cmd.exe",
        maxBuffer: 10 * 1024 * 1024,
      }).catch((err) => err);

      // ffmpeg writes its output to stderr, not stdout, so we combine both
      const output = String(result.stdout || "") + String(result.stderr || "");
      const audioDevices: string[] = [];

      // Look for lines like: "Microphone (Realtek Audio)" (audio)
      // The regex matches text inside quotes followed by "(audio)"
      const matches = output.match(/"([^"]+)"\s*\(audio\)/g);
      if (matches) {
        for (const match of matches) {
          const deviceName = match.match(/"([^"]+)"/)?.[1];
          if (deviceName) {
            audioDevices.push(deviceName);
            console.log("[AudioRecorder] Found audio device:", deviceName);
          }
        }
      }

      if (audioDevices.length === 0) {
        throw new Error("No audio input devices found. Please check your audio settings.");
      }

      this.cachedAudioDevice = audioDevices[0]; // Use the first device found
      console.log("[AudioRecorder] Selected audio device:", this.cachedAudioDevice);
      // Invalidate cached device after 5 minutes to handle hardware changes
      setTimeout(
        () => {
          try {
            if (this.cachedAudioDevice === audioDevices[0]) {
              console.log("[AudioRecorder] Invalidating cached audio device due to timeout");
              this.cachedAudioDevice = null;
            }
          } catch {
            // ignore
          }
        },
        5 * 60 * 1000
      );
      return this.cachedAudioDevice;
    } catch (err) {
      console.error("[AudioRecorder] Failed to detect audio devices:", err);
      console.log("[AudioRecorder] Falling back to generic device name...");
      return "Microphone"; // Last resort
    }
  }

  /**
   * recordAudio
   *
   * Records audio and returns the raw bytes as a Buffer.
   * The temp file is deleted automatically when done.
   *
   * @param duration  How many seconds to record
   */
  async recordAudio(duration: number = 5): Promise<Buffer> {
    const audioFile = await this.recordAudioToFile(duration);
    try {
      console.log("[AudioRecorder] Recording completed, reading file...");
      const audioBuffer = await fs.promises.readFile(audioFile);
      console.log(
        "[AudioRecorder] Audio file read successfully, size:",
        audioBuffer.length,
        "bytes"
      );
      return audioBuffer;
    } finally {
      // 'finally' runs whether the read succeeded or failed
      await this.cleanupAudioFile(audioFile);
    }
  }

  /**
   * recordAudioToFile
   *
   * Records audio and saves it to a temp .wav file.
   * Returns the file path so the caller can use the file before deletion.
   *
   * @param duration  How many seconds to record
   * @returns         Path to the saved .wav file
   */
  async recordAudioToFile(duration: number = 5): Promise<string> {
    const session = await this.startRecordingSession(duration);
    return session.finished;
  }

  private async saveDebugAudioCopy(audioFile: string): Promise<void> {
    const prefs = getPreferences();
    if (!prefs.enableDebugAudio) {
      return;
    }

    const fallbackDir = path.join(environment.supportPath, "debug-audio");
    const preferredDir = prefs.debugAudioDirectory;
    let debugDir = fallbackDir;

    if (preferredDir) {
      try {
        const stats = await fs.promises.stat(preferredDir);
        if (stats.isDirectory()) {
          debugDir = preferredDir;
        } else {
          console.warn(
            "[AudioRecorder] Debug audio path is not a directory, using fallback:",
            preferredDir
          );
        }
      } catch (err) {
        console.warn("[AudioRecorder] Debug audio directory unavailable, using fallback:", err);
      }
    }

    try {
      await fs.promises.mkdir(debugDir, { recursive: true });
      const debugFile = path.join(debugDir, `rayzam-${Date.now()}.wav`);
      await fs.promises.copyFile(audioFile, debugFile);
      console.log("[AudioRecorder] Debug audio saved to:", debugFile);
    } catch (debugErr) {
      console.warn("[AudioRecorder] Failed to save debug audio copy:", debugErr);
    }
  }

  private withDebugAudioCopy(session: RecordingSession): RecordingSession {
    return {
      ...session,
      finished: session.finished.then(async (audioFile) => {
        await this.saveDebugAudioCopy(audioFile);
        return audioFile;
      }),
    };
  }

  private async isUsableAudioFile(audioFile: string): Promise<boolean> {
    try {
      const stats = await fs.promises.stat(audioFile);
      return stats.isFile() && stats.size > 44;
    } catch {
      return false;
    }
  }

  private createFriendlyRecordingError(error: unknown): AudioRecordingError {
    const rawMsg = error instanceof Error ? error.message : String(error);

    let friendlyMsg: string;
    if (
      rawMsg.includes("not recognized") ||
      rawMsg.includes("not found") ||
      rawMsg.includes("No such file") ||
      rawMsg.includes("ENOENT")
    ) {
      friendlyMsg =
        "ffmpeg is not installed or could not be found.\n" +
        "Please install ffmpeg and make sure it is in your system PATH, then try again.";
    } else if (
      rawMsg.includes("No such audio input device") ||
      rawMsg.includes("Could not find audio only device") ||
      rawMsg.includes("audio=") ||
      rawMsg.includes("avfoundation") ||
      rawMsg.includes("pulse") ||
      rawMsg.includes("dshow")
    ) {
      friendlyMsg =
        "The selected audio input device could not be found.\n" +
        "Try changing the input device in the Rayzam actions menu, or reset to auto-detect.";
    } else if (
      rawMsg.includes("Permission denied") ||
      rawMsg.includes("EACCES") ||
      rawMsg.includes("access denied")
    ) {
      friendlyMsg =
        "Microphone access was denied.\n" +
        "Please grant microphone permission to Raycast in System Settings -> Privacy & Security -> Microphone.";
    } else if (
      rawMsg.includes("timeout") ||
      rawMsg.includes("ETIMEDOUT") ||
      rawMsg.includes("timed out")
    ) {
      friendlyMsg =
        "Recording timed out.\n" +
        "Make sure your microphone is connected and working, then try again.";
    } else if (rawMsg.includes("Unsupported platform")) {
      friendlyMsg = `Your operating system (${this.platform}) is not supported by Rayzam.`;
    } else {
      friendlyMsg =
        "Recording failed.\n" +
        "Please check that your microphone is connected and that ffmpeg is installed.";
    }

    return new AudioRecordingError(friendlyMsg, error instanceof Error ? error : undefined);
  }

  /**
   * startRecordingSession
   *
   * Starts recording and returns a session object the UI can stop early.
   */
  async startRecordingSession(duration: number = 5): Promise<RecordingSession> {
    // Build a unique filename using the current timestamp so multiple recordings
    // don't overwrite each other — e.g. "C:\Temp\rayzam-1708234567890.wav"
    const audioFile = path.join(this.tempDir, `rayzam-${Date.now()}.wav`);

    console.log("[AudioRecorder] Starting recording for", duration, "seconds");
    console.log(process.cwd());
    console.log("[AudioRecorder] Platform:", this.platform);
    console.log("[AudioRecorder] Output file:", audioFile);

    try {
      // Route to the correct OS-specific recording method
      if (this.platform === "darwin") {
        console.log("[AudioRecorder] Using macOS recording mode");
        return this.withDebugAudioCopy(await this.recordMacOS(audioFile, duration));
      } else if (this.platform === "win32") {
        console.log("[AudioRecorder] Using Windows recording mode");
        return this.withDebugAudioCopy(await this.recordWindows(audioFile, duration));
      } else if (this.platform === "linux") {
        console.log("[AudioRecorder] Using Linux recording mode");
        return this.withDebugAudioCopy(await this.recordLinux(audioFile, duration));
      } else {
        throw new AudioRecordingError(`Unsupported platform: ${this.platform}`);
      }
    } catch (error) {
      const rawMsg = error instanceof Error ? error.message : String(error);
      console.error("[AudioRecorder] Recording error:", rawMsg);
      await this.cleanupAudioFile(audioFile); // Clean up the partial/broken file

      // Re-throw our own errors unchanged
      if (error instanceof AudioRecordingError) throw error;

      throw this.createFriendlyRecordingError(error);
    }
  }

  private createRecordingSession(
    command: string,
    options: ExecOptions,
    outputFile: string
  ): RecordingSession {
    let child: ReturnType<typeof exec> | null = null;
    let stopRequested = false;
    let settled = false;

    const finished = new Promise<string>((resolve, reject) => {
      child = exec(command, options, async (error) => {
        if (settled) {
          return;
        }

        settled = true;

        if (!error || stopRequested || (await this.isUsableAudioFile(outputFile))) {
          resolve(outputFile);
          return;
        }

        reject(this.createFriendlyRecordingError(error));
      });
    });

    return {
      filePath: outputFile,
      finished,
      stop: async () => {
        if (settled || stopRequested) {
          return;
        }

        stopRequested = true;
        child?.kill("SIGINT");
        await finished.catch(() => undefined);
      },
    };
  }

  /**
   * cleanupAudioFile
   *
   * Deletes the temporary audio file.  Called after we're done with it.
   * Silently ignores errors — if deletion fails it's not critical.
   */
  async cleanupAudioFile(audioFile: string): Promise<void> {
    await fs.promises.unlink(audioFile).catch((err) => {
      console.warn("[AudioRecorder] Failed to clean up temp file:", err);
    });
  }

  // ─── Platform-specific recording methods ─────────────────────────────────

  /**
   * recordMacOS  (private)
   *
   * On macOS we first try "sox" (a simpler audio tool that just works
   * with the system default mic), and fall back to ffmpeg if sox isn't installed.
   */
  private async recordMacOS(outputFile: string, duration: number): Promise<RecordingSession> {
    const preferredDevice = await this.getPreferredDevice();

    // If no specific device was selected, try sox first — it picks the system default
    if (!preferredDevice) {
      console.log("[AudioRecorder] Attempting sox recording...");
      const soxAvailable = await execAsync(`sox --version`, { timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      if (soxAvailable) {
        // sox -d = use default device
        // -t wav = output as WAV
        // trim 0 N = record from second 0 to second N
        const cmd = `sox -d -t wav "${outputFile}" trim 0 ${duration}`;
        console.log("[AudioRecorder] Executing command:", cmd);
        console.log("[AudioRecorder] Sox recording started");
        return this.createRecordingSession(cmd, { timeout: (duration + 5) * 1000 }, outputFile);
      } else {
        console.log("[AudioRecorder] Sox failed, falling back to ffmpeg...");
      }
    }

    // ffmpeg with AVFoundation:
    // On macOS the device ID is an index number shown by: ffmpeg -f avfoundation -list_devices true -i ""
    // ":0" means "audio device 0", ":1" means "audio device 1", etc.
    // ":default" works when nothing is specified
    const audioInput = preferredDevice ? `:${preferredDevice}` : ":default";
    console.log(
      "[AudioRecorder] Using avfoundation input:",
      audioInput,
      preferredDevice ? "(user-selected)" : "(system default)"
    );

    const cmd = `ffmpeg -f avfoundation -i "${audioInput}" -t ${duration} "${outputFile}" -y`;
    console.log("[AudioRecorder] Executing ffmpeg command:", cmd);
    console.log("[AudioRecorder] FFmpeg recording started");
    return this.createRecordingSession(cmd, { timeout: (duration + 5) * 1000 }, outputFile);
  }

  /**
   * recordWindows  (private)
   *
   * Uses ffmpeg with the DirectShow (dshow) input system.
   * DirectShow is Windows' built-in audio/video API.
   *
   * The device name must match exactly what Windows calls it, e.g.:
   *   audio="Microphone (Realtek Audio)"
   */
  private async recordWindows(outputFile: string, duration: number): Promise<RecordingSession> {
    console.log("[AudioRecorder] Recording on Windows with ffmpeg...");

    // Windows paths use backslashes, but we need to double them inside a string
    // e.g. "C:\Temp\file.wav" → "C:\\Temp\\file.wav"
    const escapedPath = outputFile.replace(/\\/g, "\\\\");

    // Get user-selected device, or auto-detect if none
    const preferredDevice = await this.getPreferredDevice();
    const audioDevice = preferredDevice ?? (await this.detectWindowsAudioDevice());
    console.log(
      "[AudioRecorder] Using audio device:",
      audioDevice,
      preferredDevice ? "(user-selected)" : "(auto-detected)"
    );

    // Build the ffmpeg command:
    //   -f dshow           = use DirectShow (Windows audio)
    //   -i audio="NAME"    = the microphone to record from
    //   -t DURATION        = stop after N seconds
    //   -acodec pcm_s16le  = uncompressed 16-bit audio (WAV standard)
    //   -ar 44100          = 44,100 samples/second (CD quality)
    //   -ac 1              = 1 channel (mono — saves file size, fine for fingerprinting)
    //   -y                 = overwrite output file if it already exists
    const cmd = `ffmpeg -f dshow -i audio="${audioDevice}" -t ${duration} -acodec pcm_s16le -ar 44100 -ac 1 -y "${escapedPath}"`;
    console.log("[AudioRecorder] Executing command:", cmd);

    console.log("[AudioRecorder] Windows recording started");
    return this.createRecordingSession(
      cmd,
      {
        timeout: (duration + 5) * 1000,
        shell: "cmd.exe", // Use the classic Windows command prompt
        maxBuffer: 10 * 1024 * 1024, // Allow up to 10 MB of output from ffmpeg
      },
      outputFile
    );
  }

  /**
   * recordLinux  (private)
   *
   * On Linux we first try PulseAudio (the modern audio system found on
   * most desktop distros), and fall back to ALSA (the lower-level system)
   * if PulseAudio isn't available.
   */
  private async recordLinux(outputFile: string, duration: number): Promise<RecordingSession> {
    const preferredDevice = await this.getPreferredDevice();
    const deviceId = preferredDevice || "default"; // PulseAudio's "default" = system default mic

    console.log(
      "[AudioRecorder] Attempting pulse audio recording...",
      preferredDevice ? `(user-selected: ${deviceId})` : "(default)"
    );

    try {
      // -f pulse = PulseAudio input
      const cmd = `ffmpeg -f pulse -i "${deviceId}" -t ${duration} "${outputFile}" -y`;
      console.log("[AudioRecorder] Executing command:", cmd);
      console.log("[AudioRecorder] Pulse audio recording started");
      return this.createRecordingSession(cmd, { timeout: (duration + 5) * 1000 }, outputFile);
    } catch {
      // PulseAudio failed — try ALSA instead
      console.log("[AudioRecorder] Pulse failed, trying ALSA...");

      // -f alsa = ALSA input (Advanced Linux Sound Architecture)
      const cmd = `ffmpeg -f alsa -i "${deviceId}" -t ${duration} "${outputFile}" -y`;
      console.log("[AudioRecorder] Executing ALSA command:", cmd);
      console.log("[AudioRecorder] ALSA recording started");
      return this.createRecordingSession(cmd, { timeout: (duration + 5) * 1000 }, outputFile);
    }
  }
}
