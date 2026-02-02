/**
 * Unit tests for HistoryDatabase
 */

import { HistoryDatabase } from "../database";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

jest.mock("fs");
jest.mock("path");

describe("HistoryDatabase", () => {
  let db: HistoryDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should initialize successfully", () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);

    db = new HistoryDatabase();
    expect(db).toBeDefined();
  });

  it("should add a song to history", () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
    (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

    db = new HistoryDatabase();

    const entry = db.addSong({
      title: "Test Song",
      artist: "Test Artist",
      service: "shazamio",
      timestamp: Date.now(),
    });

    expect(entry.title).toBe("Test Song");
    expect(entry.artist).toBe("Test Artist");
    expect(entry.id).toBeDefined();
  });

  it("should export to JSON", () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
    (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

    db = new HistoryDatabase();

    db.addSong({
      title: "Song1",
      artist: "Artist1",
      service: "shazamio",
      timestamp: Date.now(),
    });

    const json = db.exportToJSON();
    expect(json).toContain("Song1");
    expect(json).toContain("Artist1");
  });
});
