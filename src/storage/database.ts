/**
 * JSON file-based storage for song history
 */

import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { HistoryEntry } from "../services/types";

export class HistoryDatabase {
  private dbPath: string;
  private entries: HistoryEntry[] = [];

  constructor() {
    const dbDir = path.join(os.homedir(), ".config", "songsnap");
    this.dbPath = path.join(dbDir, "history.json");
    this.ensureDbDir();
    this.loadEntries();
  }

  private ensureDbDir(): void {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private loadEntries(): void {
    try {
      if (fs.existsSync(this.dbPath)) {
        const data = fs.readFileSync(this.dbPath, "utf-8");
        this.entries = JSON.parse(data);
      } else {
        this.entries = [];
      }
    } catch {
      this.entries = [];
    }
  }

  private saveEntries(): void {
    try {
      console.log("[HistoryDatabase] Saving", this.entries.length, "entries to disk...");
      fs.writeFileSync(this.dbPath, JSON.stringify(this.entries, null, 2), "utf-8");
      console.log("[HistoryDatabase] Successfully saved to:", this.dbPath);
    } catch (err) {
      console.error("[HistoryDatabase] Failed to save history:", err);
    }
  }

  addSong(entry: Omit<HistoryEntry, "id">): HistoryEntry {
    console.log("[HistoryDatabase] Adding song to history:", entry.title, "by", entry.artist);
    const id = uuidv4();
    const newEntry: HistoryEntry = { id, ...entry };
    this.entries.unshift(newEntry);
    console.log("[HistoryDatabase] Entry added with ID:", id);
    
    // Keep only last 500 songs
    if (this.entries.length > 500) {
      console.log("[HistoryDatabase] Trimming history to 500 songs (current:", this.entries.length, ")");
      this.entries = this.entries.slice(0, 500);
    }
    
    this.saveEntries();
    return newEntry;
  }

  getRecent(limit: number = 50): HistoryEntry[] {
    return this.entries.slice(0, limit);
  }

  searchByTitle(query: string, limit: number = 50): HistoryEntry[] {
    const lower = query.toLowerCase();
    return this.entries
      .filter((e) => e.title.toLowerCase().includes(lower) || e.artist.toLowerCase().includes(lower))
      .slice(0, limit);
  }

  getByDateRange(startTime: number, endTime: number): HistoryEntry[] {
    return this.entries.filter((e) => e.timestamp >= startTime && e.timestamp <= endTime);
  }

  deleteSong(id: string): boolean {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx >= 0) {
      this.entries.splice(idx, 1);
      this.saveEntries();
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
    // No-op for JSON storage
  }

  private escapeCsv(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

