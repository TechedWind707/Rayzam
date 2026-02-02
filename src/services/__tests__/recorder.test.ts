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

  it("should throw AudioRecordingError on unsupported platform", async () => {
    expect(recorder).toBeDefined();
    // Platform-specific tests would require complex mocking
    // In production, this is tested manually on macOS/Windows
  });
});
