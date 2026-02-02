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

  constructor() {
    this.platform = process.platform;
    this.tempDir = os.tmpdir();
  }

  /**
   * Record audio from the default microphone
   */
  async recordAudio(duration: number = 5): Promise<Buffer> {
    const audioFile = path.join(this.tempDir, `songsnap-${Date.now()}.wav`);

    try {
      if (this.platform === "darwin") {
        await this.recordMacOS(audioFile, duration);
      } else if (this.platform === "win32") {
        await this.recordWindows(audioFile, duration);
      } else if (this.platform === "linux") {
        await this.recordLinux(audioFile, duration);
      } else {
        throw new AudioRecordingError(`Unsupported platform: ${this.platform}`);
      }

      // Read the audio file
      const audioBuffer = await fs.promises.readFile(audioFile);
      // Clean up temp file
      await fs.promises.unlink(audioFile).catch(() => {});
      return audioBuffer;
    } catch (error) {
      // Clean up on error
      await fs.promises.unlink(audioFile).catch(() => {});
      throw new AudioRecordingError(
        `Failed to record audio: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  private async recordMacOS(outputFile: string, duration: number): Promise<void> {
    // Try sox first, fall back to ffmpeg
    try {
      await execAsync(
        `sox -d -t wav "${outputFile}" trim 0 ${duration}`,
        { timeout: (duration + 5) * 1000 }
      );
    } catch {
      // Fall back to ffmpeg
      await execAsync(
        `ffmpeg -f avfoundation -i ":default" -t ${duration} "${outputFile}" -y`,
        { timeout: (duration + 5) * 1000 }
      );
    }
  }

  private async recordWindows(outputFile: string, duration: number): Promise<void> {
    // Windows: use ffmpeg with dshow (DirectShow)
    await execAsync(
      `ffmpeg -f dshow -i audio="Microphone" -t ${duration} "${outputFile}" -y`,
      { timeout: (duration + 5) * 1000 }
    );
  }

  private async recordLinux(outputFile: string, duration: number): Promise<void> {
    // Linux: use ffmpeg with pulse audio or alsa
    try {
      await execAsync(
        `ffmpeg -f pulse -i default -t ${duration} "${outputFile}" -y`,
        { timeout: (duration + 5) * 1000 }
      );
    } catch {
      // Fall back to ALSA
      await execAsync(
        `ffmpeg -f alsa -i default -t ${duration} "${outputFile}" -y`,
        { timeout: (duration + 5) * 1000 }
      );
    }
  }
}
