/**
 * Cross-platform audio recording module
 * Handles audio capture on macOS and Windows
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { AudioRecordingError } from "./types";

const execAsync = promisify(exec);

export class AudioRecorder {
  private platform: string;
  private tempDir: string;
  private cachedAudioDevice: string | null = null;

  constructor() {
    this.platform = process.platform;
    this.tempDir = os.tmpdir();
  }

  /**
   * Auto-detect available audio input devices on Windows
   */
  private async detectWindowsAudioDevice(): Promise<string> {
    // Return cached device if already found
    if (this.cachedAudioDevice) {
      console.log("[AudioRecorder] Using cached audio device:", this.cachedAudioDevice);
      return this.cachedAudioDevice;
    }

    console.log("[AudioRecorder] Detecting available audio devices...");
    try {
      const { stdout, stderr } = await execAsync(`ffmpeg -list_devices true -f dshow -i dummy 2>&1`, {
        shell: true,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for device list
      });

      const output = stdout + stderr;
      const audioDevices: string[] = [];

      // Parse ffmpeg output to find audio devices
      // Format: [dshow @ ...] "Device Name" (audio)
      const matches = output.match(/"([^"]+)"\s*\(audio\)/g);

      if (matches) {
        for (const match of matches) {
          // Extract device name from "Device Name" (audio)
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

      // Use the first available device
      this.cachedAudioDevice = audioDevices[0];
      console.log("[AudioRecorder] Selected audio device:", this.cachedAudioDevice);
      return this.cachedAudioDevice;
    } catch (err) {
      console.error("[AudioRecorder] Failed to detect audio devices:", err);
      // Fallback: try generic device names
      console.log("[AudioRecorder] Falling back to generic device names...");
      return "Microphone";
    }
  }

  /**
   * Record audio from the default microphone
   */
  async recordAudio(duration: number = 5): Promise<Buffer> {
    const audioFile = await this.recordAudioToFile(duration);

    try {
      console.log("[AudioRecorder] Recording completed, reading file...");
      const audioBuffer = await fs.promises.readFile(audioFile);
      console.log("[AudioRecorder] Audio file read successfully, size:", audioBuffer.length, "bytes");
      return audioBuffer;
    } finally {
      await this.cleanupAudioFile(audioFile);
    }
  }

  /**
   * Record audio and return the path to the temp file
   */
  async recordAudioToFile(duration: number = 5): Promise<string> {
    const audioFile = path.join(this.tempDir, `songsnap-${Date.now()}.wav`);
    console.log("[AudioRecorder] Starting recording for", duration, "seconds");
    console.log("[AudioRecorder] Platform:", this.platform);
    console.log("[AudioRecorder] Output file:", audioFile);

    try {
      if (this.platform === "darwin") {
        console.log("[AudioRecorder] Using macOS recording mode");
        await this.recordMacOS(audioFile, duration);
      } else if (this.platform === "win32") {
        console.log("[AudioRecorder] Using Windows recording mode");
        await this.recordWindows(audioFile, duration);
      } else if (this.platform === "linux") {
        console.log("[AudioRecorder] Using Linux recording mode");
        await this.recordLinux(audioFile, duration);
      } else {
        throw new AudioRecordingError(`Unsupported platform: ${this.platform}`);
      }

      // Save a debug copy for user inspection
      try {
        const debugDir = path.join(os.homedir(), "songsnap-debug");
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true });
        }
        const debugFile = path.join(debugDir, `songsnap-${Date.now()}.wav`);
        await fs.promises.copyFile(audioFile, debugFile);
        console.log("[AudioRecorder] ✓ DEBUG: Saved audio copy to:", debugFile);
        console.log("[AudioRecorder] ✓ DEBUG: You can listen to this file to verify audio is being captured");
      } catch (debugErr) {
        console.warn("[AudioRecorder] Failed to save debug copy:", debugErr);
      }

      return audioFile;
    } catch (error) {
      console.error("[AudioRecorder] Recording error:", error);
      await this.cleanupAudioFile(audioFile);
      throw new AudioRecordingError(
        `Failed to record audio: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async cleanupAudioFile(audioFile: string): Promise<void> {
    await fs.promises.unlink(audioFile).catch((err) => {
      console.warn("[AudioRecorder] Failed to clean up temp file:", err);
    });
  }

  private async recordMacOS(outputFile: string, duration: number): Promise<void> {
    // Try sox first, fall back to ffmpeg
    console.log("[AudioRecorder] Attempting sox recording...");
    try {
      const cmd = `sox -d -t wav "${outputFile}" trim 0 ${duration}`;
      console.log("[AudioRecorder] Executing command:", cmd);
      await execAsync(cmd, { timeout: (duration + 5) * 1000 });
      console.log("[AudioRecorder] Sox recording successful");
    } catch (err) {
      // Fall back to ffmpeg
      console.log("[AudioRecorder] Sox failed, trying ffmpeg...");
      const cmd = `ffmpeg -f avfoundation -i ":default" -t ${duration} "${outputFile}" -y`;
      console.log("[AudioRecorder] Executing ffmpeg command:", cmd);
      await execAsync(cmd, { timeout: (duration + 5) * 1000 });
      console.log("[AudioRecorder] FFmpeg recording successful");
    }
  }

  private async recordWindows(outputFile: string, duration: number): Promise<void> {
    // Windows: use ffmpeg with dshow (DirectShow)
    console.log("[AudioRecorder] Recording on Windows with ffmpeg...");
    // Escape backslashes in path for Windows
    const escapedPath = outputFile.replace(/\\/g, "\\\\");

    // Auto-detect the audio device
    const audioDevice = await this.detectWindowsAudioDevice();
    console.log("[AudioRecorder] Using audio device:", audioDevice);

    // Use better audio codec for recognition: PCM 16-bit 44.1kHz mono
    // This is the most compatible format for music recognition APIs
    const cmd = `ffmpeg -f dshow -i audio="${audioDevice}" -t ${duration} -acodec pcm_s16le -ar 44100 -ac 1 -y "${escapedPath}"`;
    console.log("[AudioRecorder] Executing command:", cmd);
    await execAsync(cmd, { timeout: (duration + 5) * 1000, shell: true, maxBuffer: 10 * 1024 * 1024 });
    console.log("[AudioRecorder] Windows recording successful");
  }

  private async recordLinux(outputFile: string, duration: number): Promise<void> {
    // Linux: use ffmpeg with pulse audio or alsa
    console.log("[AudioRecorder] Attempting pulse audio recording...");
    try {
      const cmd = `ffmpeg -f pulse -i default -t ${duration} "${outputFile}" -y`;
      console.log("[AudioRecorder] Executing command:", cmd);
      await execAsync(cmd, { timeout: (duration + 5) * 1000 });
      console.log("[AudioRecorder] Pulse audio recording successful");
    } catch {
      // Fall back to ALSA
      console.log("[AudioRecorder] Pulse failed, trying ALSA...");
      const cmd = `ffmpeg -f alsa -i default -t ${duration} "${outputFile}" -y`;
      console.log("[AudioRecorder] Executing ALSA command:", cmd);
      await execAsync(cmd, { timeout: (duration + 5) * 1000 });
      console.log("[AudioRecorder] ALSA recording successful");
    }
  }
}
