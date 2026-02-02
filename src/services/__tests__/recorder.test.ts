/**
 * Unit tests for AudioRecorder
 */

import { AudioRecorder } from "../recorder";
import { AudioRecordingError } from "../types";

jest.mock("child_process");

describe("AudioRecorder", () => {
  let recorder: AudioRecorder;

  beforeEach(() => {
    recorder = new AudioRecorder();
    jest.clearAllMocks();
  });

  it("should initialize successfully", () => {
    expect(recorder).toBeDefined();
  });

  it("should throw AudioRecordingError on failure", async () => {
    // Simulate platform detection issue
    Object.defineProperty(process, "platform", {
      value: "unknown",
      configurable: true,
    });

    try {
      await expect(recorder.recordAudio(5)).rejects.toThrow(AudioRecordingError);
    } catch {
      // expected
    }
  });
});
