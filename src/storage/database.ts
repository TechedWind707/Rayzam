/**
 * ─────────────────────────────────────────────────────────────────
 * database.ts  —  Storing and retrieving song history
 * ─────────────────────────────────────────────────────────────────
 *
 * Every time you identify a song, we save it so you can review your
 * history later in the "Song History" command.
 *
 * We don't use a real database (like SQLite or MySQL).  Instead we
 * store everything as a JSON string inside Raycast's LocalStorage —
 * a simple key-value store that Raycast provides to all extensions.
 *
 * Think of it like a Notes app where every entry is saved as a big
 * text file.  Raycast handles where it's stored on disk; we just
 * read and write it by name ("rayzam_history").
 *
 * Capacity: we keep the 500 most recent songs.  Older ones are
 * automatically removed to keep the storage size reasonable.
 * ─────────────────────────────────────────────────────────────────
 */

import { v4 as uuidv4 } from "uuid"; // Generates unique IDs like "a8f3c2d1-..."
import { LocalStorage } from "@raycast/api"; // Raycast's built-in key-value storage
import { HistoryEntry } from "../services/types";

// The key under which the whole history array is stored in LocalStorage.
// Like the label on a folder in a filing cabinet.
const STORAGE_KEY = "rayzam_history";

export class HistoryDatabase {
  // The in-memory copy of all history entries.
  // When we first open the database we load from storage into this array,
  // do our work in memory (fast), then save back to storage when done.
  private entries: HistoryEntry[] = [];

  // Loading from storage is async (it takes a moment).
  // We store the Promise so every method can "await" the load before doing anything.
  private loadPromise: Promise<void>;
  // A simple per-instance write queue to serialize writes and avoid overlapping
  // LocalStorage.setItem calls from concurrent async operations.
  private writeQueue: Promise<void> = Promise.resolve();

  constructor() {
    // Start loading immediately when the object is created
    this.loadPromise = this.loadEntries();
  }

  /**
   * loadEntries  (private)
   *
   * Reads the JSON string from Raycast's LocalStorage and turns it
   * back into a JavaScript array of HistoryEntry objects.
   */
  private async loadEntries(): Promise<void> {
    try {
      // LocalStorage.getItem returns the stored string, or undefined if nothing is saved yet
      const storedData = await LocalStorage.getItem(STORAGE_KEY);

      if (storedData && typeof storedData === "string") {
        // JSON.parse turns the JSON text back into a real JavaScript array
        this.entries = JSON.parse(storedData);
        console.log(
          "[HistoryDatabase] Loaded",
          this.entries.length,
          "entries from Raycast storage"
        );
      } else {
        this.entries = []; // No history yet — start with an empty list
        console.log("[HistoryDatabase] No existing history found");
      }
    } catch (err) {
      // If parsing fails (e.g. corrupted data), start fresh
      console.error("[HistoryDatabase] Failed to load history:", err);
      this.entries = [];
    }
  }

  /**
   * ensureLoaded  (private)
   *
   * Any public method that reads or writes data should call this first.
   * It pauses ("awaits") until the initial load from storage is complete,
   * so we never operate on an empty array by accident.
   */
  private async ensureLoaded(): Promise<void> {
    await this.loadPromise;
  }

  /**
   * saveEntries  (private)
   *
   * Converts the in-memory entries array back to JSON text and saves it
   * to Raycast's LocalStorage, overwriting whatever was there before.
   */
  private async saveEntries(): Promise<void> {
    try {
      console.log(
        "[HistoryDatabase] Queuing save of",
        this.entries.length,
        "entries to Raycast storage..."
      );
      // Serialize writes by chaining them on writeQueue. This prevents concurrent
      // writes from overlapping and reduces the chance of a lost update.
      this.writeQueue = this.writeQueue.then(async () => {
        console.log("[HistoryDatabase] Saving entries...");
        await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
        console.log("[HistoryDatabase] Successfully saved to Raycast storage");
      });
      // Wait for our queued write to complete before returning
      await this.writeQueue;
    } catch (err) {
      console.error("[HistoryDatabase] Failed to save history:", err);
    }
  }

  /**
   * addSong
   *
   * Creates a new history entry for a newly identified song and saves it.
   *
   * @param title   Song title
   * @param artist  Artist name
   * @param options Optional extra fields (album, year, service, confidence, etc.)
   * @returns       The newly created HistoryEntry (including its generated ID)
   */
  async addSong(
    title: string,
    artist: string,
    options: Partial<HistoryEntry> = {}
  ): Promise<HistoryEntry> {
    await this.ensureLoaded(); // Wait for the initial load before we modify anything

    const newEntry: HistoryEntry = {
      id: uuidv4(), // Generate a unique receipt-style ID, e.g. "3f2d-8a1b-..."
      title,
      artist,
      timestamp: Date.now(), // Current time in milliseconds — used for sorting and display
      service: "unknown", // Safe default — will be overwritten by options.service if provided
      ...options, // Spread all extra fields; any key here overrides the defaults above
      // Because ...options comes LAST, caller's service name beats the "unknown" default.
    };

    console.log("[HistoryDatabase] Adding song to history:", title, "by", artist);

    // unshift adds to the FRONT of the array (newest first, like a news feed)
    this.entries.unshift(newEntry);
    console.log("[HistoryDatabase] Entry added with ID:", newEntry.id);

    // Safety limit: if we have more than 500 entries, trim to the newest 500
    if (this.entries.length > 500) {
      console.log(
        "[HistoryDatabase] Trimming history to 500 songs (current:",
        this.entries.length,
        ")"
      );
      this.entries = this.entries.slice(0, 500); // Keep index 0–499, discard the rest
    }

    await this.saveEntries(); // Persist the updated list back to storage
    return newEntry;
  }

  /**
   * getRecent
   *
   * Returns the most recently identified songs (newest first).
   * @param limit  Maximum number to return (default 50)
   */
  async getRecent(limit: number = 50): Promise<HistoryEntry[]> {
    await this.ensureLoaded();
    // slice(0, limit) takes just the first 'limit' items from the array
    return this.entries.slice(0, limit);
  }

  /**
   * searchByTitle
   *
   * Searches through all entries for ones where the title OR artist
   * contains the query string (case-insensitive).
   *
   * Think of it like the search bar in your music library.
   */
  async searchByTitle(query: string, limit: number = 50): Promise<HistoryEntry[]> {
    await this.ensureLoaded();
    const lower = query.toLowerCase(); // Normalise to lowercase for case-insensitive matching

    return this.entries
      .filter(
        (e) =>
          // Does the title contain the query?  OR does the artist contain it?
          e.title.toLowerCase().includes(lower) || e.artist.toLowerCase().includes(lower)
      )
      .slice(0, limit); // Cap results at 'limit'
  }

  /**
   * getByDateRange
   *
   * Returns entries identified between two Unix timestamps.
   * Useful for "show me what I identified yesterday" type queries.
   */
  async getByDateRange(startTime: number, endTime: number): Promise<HistoryEntry[]> {
    await this.ensureLoaded();
    return this.entries.filter((e) => e.timestamp >= startTime && e.timestamp <= endTime);
  }

  /**
   * deleteSong
   *
   * Removes a single entry by its unique ID.
   * Returns true if the entry was found and deleted, false if not found.
   */
  async deleteSong(id: string): Promise<boolean> {
    await this.ensureLoaded();

    // findIndex returns the position of the matching item, or -1 if not found
    const idx = this.entries.findIndex((e) => e.id === id);

    if (idx >= 0) {
      // splice removes 1 item at position idx
      this.entries.splice(idx, 1);
      await this.saveEntries(); // Persist the deletion
      return true;
    }
    return false; // ID not found
  }
  /**
   * clearAll
   *
   * Removes every saved history entry.
   */
  async clearAll(): Promise<void> {
    await this.ensureLoaded();
    this.entries = [];
    await this.saveEntries();
  }

  /**
   * exportToJSON
   *
   * Returns all history entries as a pretty-printed JSON string.
   * Users can paste this into a file for backup or analysis.
   *
   * JSON.stringify(data, null, 2) → the "2" adds 2-space indentation
   * so it's human-readable instead of one long line.
   */
  exportToJSON(): string {
    return JSON.stringify(this.entries, null, 2);
  }

  /**
   * exportToCSV
   *
   * Returns all history entries as a CSV (comma-separated values) string
   * that can be opened in Excel or Google Sheets.
   *
   * CSV format:
   *   ID,Title,Artist,Album,...
   *   abc-123,"Bohemian Rhapsody","Queen","A Night at the Opera",...
   */
  exportToCSV(): string {
    const headers = [
      "ID",
      "Title",
      "Artist",
      "Album",
      "Release Year",
      "Service",
      "Timestamp",
      "Confidence",
      "Spotify ID",
      "YouTube URL",
      "Apple Music URL",
      "Album Art URL",
    ];
    const csvLines = [headers.join(",")]; // First line is the header row

    for (const entry of this.entries) {
      csvLines.push(
        [
          entry.id,
          this.escapeCsv(entry.title),
          this.escapeCsv(entry.artist),
          this.escapeCsv(entry.album || ""),
          entry.releaseYear || "",
          entry.service,
          entry.timestamp,
          entry.confidence || "",
          this.escapeCsv(entry.spotifyId || ""),
          this.escapeCsv(entry.youtubeUrl || ""),
          this.escapeCsv(entry.appleMusicUrl || ""),
          this.escapeCsv(entry.albumArtUrl || ""),
        ].join(",")
      );
    }

    return csvLines.join("\n"); // One row per line
  }

  /**
   * close
   *
   * Called after we're done using the database.
   * With a real database you'd close the connection here.
   * For LocalStorage there's nothing to close, but having
   * the method keeps code consistent and future-proof.
   */
  close(): void {
    // No-op for Raycast LocalStorage — nothing to clean up
  }

  /**
   * escapeCsv  (private)
   *
   * Makes a string safe to include in a CSV cell.
   * If the value contains a comma, a double-quote, or a newline,
   * we wrap it in double-quotes and escape any inner double-quotes.
   *
   * Without this, "Queen, The" would break the CSV because the comma
   * inside the value would be treated as a column separator.
   */
  private escapeCsv(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      // Replace each " with "" (CSV standard for escaping quotes)
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
