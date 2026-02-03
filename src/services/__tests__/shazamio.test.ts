/**
 * Unit tests for ShazamioService
 */

import { ShazamioService } from "../shazamio";

jest.mock("../chromaprint", () => ({
  ChromaprintService: jest.fn().mockImplementation(() => ({
    recognize: jest.fn().mockResolvedValue({ title: "Test Song", artist: "Test Artist" }),
  })),
}));

describe("ShazamioService", () => {
  let service: ShazamioService;

  beforeEach(() => {
    service = new ShazamioService();
    jest.clearAllMocks();
  });

  it("should initialize successfully", () => {
    expect(service).toBeDefined();
  });

  it("should delegate recognition to Chromaprint", async () => {
    const result = await service.recognize("/tmp/test.wav");
    expect(result.title).toBe("Test Song");
    expect(result.artist).toBe("Test Artist");
  });
});
