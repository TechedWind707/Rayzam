import { LocalStorage } from "@raycast/api";
import { HistoryDatabase } from "../database";

jest.mock("@raycast/api");

const getItem = LocalStorage.getItem as jest.MockedFunction<typeof LocalStorage.getItem>;
const setItem = LocalStorage.setItem as jest.MockedFunction<typeof LocalStorage.setItem>;

describe("HistoryDatabase", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getItem.mockResolvedValue(undefined);
    setItem.mockResolvedValue(undefined);
  });

  it("adds a song to history", async () => {
    const db = new HistoryDatabase();

    const entry = await db.addSong("Test Song", "Test Artist", {
      service: "acrcloud",
      timestamp: 123,
    });

    expect(entry.title).toBe("Test Song");
    expect(entry.artist).toBe("Test Artist");
    expect(entry.id).toBeDefined();
    expect(setItem).toHaveBeenCalledWith(
      "rayzam_history",
      expect.stringContaining("Test Song")
    );
  });

  it("deletes a loaded song by id", async () => {
    getItem.mockResolvedValue(
      JSON.stringify([
        {
          id: "song-1",
          title: "Delete Me",
          artist: "Test Artist",
          service: "acrcloud",
          timestamp: 123,
        },
      ])
    );

    const db = new HistoryDatabase();

    await expect(db.deleteSong("song-1")).resolves.toBe(true);
    expect(setItem).toHaveBeenCalledWith("rayzam_history", "[]");
  });

  it("returns false when deleting an unknown song id", async () => {
    getItem.mockResolvedValue("[]");

    const db = new HistoryDatabase();

    await expect(db.deleteSong("missing")).resolves.toBe(false);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("clears all songs", async () => {
    getItem.mockResolvedValue(
      JSON.stringify([
        {
          id: "song-1",
          title: "Song",
          artist: "Artist",
          service: "acrcloud",
          timestamp: 123,
        },
      ])
    );

    const db = new HistoryDatabase();
    await db.clearAll();

    expect(setItem).toHaveBeenCalledWith("rayzam_history", "[]");
  });
});
