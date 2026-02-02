/**
 * JSON-based storage for song history using Raycast's storage API
 */

import { v4 as uuidv4 } from "uuid";
import { LocalStorage } from "@raycast/api";
import { HistoryEntry } from "../services/types";

const STORAGE_KEY = "songsnap_history";

export class HistoryDatabase {
  private entries: HistoryEntry[] = [];
  private loadPromise: Promise<void>;

  constructor() {
    this.loadPromise = this.loadEntries();
  }

  private async loadEntries(): Promise<void> {
    try {
      const storedData = await LocalStorage.getItem(STORAGE_KEY);
      if (storedData && typeof storedData === "string") {
        this.entries = JSON.parse(storedData);
        console.log("[HistoryDatabase] Loaded", this.entries.length, "entries from Raycast storage");
      } else {
        this.entries = [];
        console.log("[HistoryDatabase] No existing history found");
      }
    } catch (err) {
      console.error("[HistoryDatabase] Failed to load history:", err);
      this.entries = [];
    }
  }

  private async ensureLoaded(): Promise<void> {
    await this.loadPromise;
  }

  private async saveEntries(): Promise<void> {
    try {
      console.log("[HistoryDatabase] Saving", this.entries.length, "entries to Raycast storage...");
      await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
      console.log("[HistoryDatabase] Successfully saved to Raycast storage");
    } catch (err) {
      console.error("[HistoryDatabase] Failed to save history:", err);
    }
  }

  async addSong(title: string, artist: string, options: Partial<HistoryEntry> = {}): Promise<HistoryEntry> {
    // Ensure data is loaded
    await this.ensureLoaded();
    
    const newEntry: HistoryEntry = {
      id: uuidv4(),
      title,
      artist,
      timestamp: Date.now(),
      ...options,
    };

    console.log("[HistoryDatabase] Adding song to history:", title, "by", artist);
    this.entries.unshift(newEntry);
    console.log("[HistoryDatabase] Entry added with ID:", newEntry.id);
    
    // Keep only last 500 songs
    if (this.entries.length > 500) {
      console.log("[HistoryDatabase] Trimming history to 500 songs (current:", this.entries.length, ")");
      this.entries = this.entries.slice(0, 500);
    }
    
    await this.saveEntries();
    return newEntry;
  }

  async getRecent(limit: number = 50): Promise<HistoryEntry[]> {
    await this.ensureLoaded();
    return this.entries.slice(0, limit);
  }

  async searchByTitle(query: string, limit: number = 50): Promise<HistoryEntry[]> {
    await this.ensureLoaded();
    const lower = query.toLowerCase();
    return this.entries
      .filter((e) => e.title.toLowerCase().includes(lower) || e.artist.toLowerCase().includes(lower))
      .slice(0, limit);
  }

  async getByDateRange(startTime: number, endTime: number): Promise<HistoryEntry[]> {
    await this.ensureLoaded();
    return this.entries.filter((e) => e.timestamp >= startTime && e.timestamp <= endTime);
  }

  async deleteSong(id: string): Promise<boolean> {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx >= 0) {
      this.entries.splice(idx, 1);
      await this.saveEntries();
      return true;
    }
    return false;
  }

  exportToJSON(): string {
    return JSON.stringify(this.entries, null, 2);
  }

  exportToCSV(): string {
    const headers = ["ID", "Title", "Artist", "Album", "Release Year", "Service", "Timestamp", "Confidence"];
    const csvLines = [headers.join(",")];

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
        ].join(",")
      );
    }

    return csvLines.join("\n");
  }

  close(): void {
    // No-op for Raycast storage
  }

  private escapeCsv(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

