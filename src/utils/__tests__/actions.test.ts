/**
 * Unit tests for utility functions
 */

import { formatSongDetails, createMarkdownView } from "../actions";
import { SongResult } from "../../services/types";

describe("Utility Functions", () => {
  const mockSong: SongResult = {
    title: "Bohemian Rhapsody",
    artist: "Queen",
    album: "A Night at the Opera",
    releaseYear: 1975,
    duration: 355,
    confidence: 0.95,
  };

  it("should format song details correctly", () => {
    const formatted = formatSongDetails(mockSong);
    expect(formatted).toContain("Bohemian Rhapsody");
    expect(formatted).toContain("Queen");
    expect(formatted).toContain("A Night at the Opera");
  });

  it("should create markdown view", () => {
    const markdown = createMarkdownView(mockSong);
    expect(markdown).toContain("# 🎵 Bohemian Rhapsody");
    expect(markdown).toContain("## 👤 Queen");
    expect(markdown).not.toContain("**Album:** A Night at the Opera");
    expect(markdown).not.toContain("**Released:** 1975");
  });

  it("should handle missing optional fields", () => {
    const minimalSong: SongResult = {
      title: "Test",
      artist: "Test Artist",
    };
    const formatted = formatSongDetails(minimalSong);
    expect(formatted).toContain("Test");
    expect(formatted).toContain("Test Artist");
  });
});


