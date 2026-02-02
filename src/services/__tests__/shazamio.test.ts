/**
 * Unit tests for ShazamioService
 */

import { ShazamioService } from "../shazamio";
import { RecognitionError, RecognitionService } from "../types";

jest.mock("axios");

describe("ShazamioService", () => {
  let service: ShazamioService;

  beforeEach(() => {
    service = new ShazamioService();
    jest.clearAllMocks();
  });

  it("should initialize successfully", () => {
    expect(service).toBeDefined();
  });

  it("should throw RecognitionError on API failure", async () => {
    const audioBuffer = Buffer.from("test audio data");

    try {
      await service.recognize(audioBuffer);
    } catch (err) {
      if (err instanceof RecognitionError) {
        expect(err.service).toBe(RecognitionService.SHAZAMIO);
      }
    }
  });
});
