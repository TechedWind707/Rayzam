/**
 * ─────────────────────────────────────────────────────────────────
 * song-history.tsx  —  The "Song History" command
 * ─────────────────────────────────────────────────────────────────
 *
 * Every time SongSnap successfully identifies a song, it saves a
 * record to the local database.  This command lets you browse,
 * search, and manage that history.
 *
 * SCREENS:
 *   • List screen  — Scrollable list of songs, newest first.
 *                    A search bar filters by title or artist live.
 *   • Detail screen — Clicking a song shows a full detail view
 *                     with Spotify/YouTube links and a delete button.
 *
 * EXPORT:
 *   Open ⌘K from the list to export your whole history as JSON
 *   or CSV (copied to the clipboard, ready to paste into a file).
 * ─────────────────────────────────────────────────────────────────
 */

import React from "react";
import {
  List,        // Renders a searchable, scrollable list
  ActionPanel, // Container for ⌘K actions
  Action,      // A single action item
  Detail,      // Renders a Markdown-based detail screen
  Icon,        // Raycast's built-in icon set
  showToast,   // Brief pop-up notification
  Toast,       // Toast type definitions
  Clipboard,   // Lets us copy text to the system clipboard
} from "@raycast/api";
import { useState, useEffect, useRef } from "react";
import { HistoryDatabase }  from "./storage/database";
import { HistoryEntry }     from "./services/types";
import { copySongDetails, openInSpotify, openInAppleMusic, openInYouTube } from "./utils/actions";

// ─── The main React component ─────────────────────────────────────────────────
export default function SongHistoryCommand() {

  // ── State ────────────────────────────────────────────────────────────────
  const [songs,         setSongs]         = useState<HistoryEntry[]>([]); // All loaded songs
  const [filteredSongs, setFilteredSongs] = useState<HistoryEntry[]>([]); // Songs matching the search
  const [selectedSong,  setSelectedSong]  = useState<HistoryEntry | null>(null); // Song being viewed
  const [searchText,    setSearchText]    = useState("");    // Current text in the search bar
  const [loading,       setLoading]       = useState(true);  // True while loading from storage

  // useRef — prevents loadHistory() from running twice (React sometimes renders components twice in dev mode)
  const isLoaded = useRef(false);

  // ── Load history on first render ─────────────────────────────────────────
  useEffect(() => {
    if (isLoaded.current) return; // Already loaded — don't re-run
    loadHistory();
    isLoaded.current = true;
  }, []);

  // ── React to search text changes ─────────────────────────────────────────
  // Whenever the user types in the search bar OR the songs array changes,
  // re-filter the list.
  useEffect(() => {
    if (searchText.trim() === "") {
      // Empty search → show everything
      setFilteredSongs(songs);
    } else {
      performSearch(); // Delegate to the async search function
    }
  }, [searchText, songs]); // Re-run any time searchText or songs changes

  // ── Load history from storage ─────────────────────────────────────────────
  async function loadHistory(): Promise<void> {
    try {
      const db     = new HistoryDatabase();
      const recent = await db.getRecent(100); // Get the 100 most recent songs
      db.close();
      setSongs(recent);
      setFilteredSongs(recent); // Initially show all songs
      setLoading(false);
    } catch (err) {
      console.error("[SongHistory] Load error:", err);
      showToast({
        style:   Toast.Style.Failure,
        title:   "Failed to load history",
        message: err instanceof Error ? err.message : "Unknown error",
      });
      setLoading(false);
    }
  }

  // ── Search through history ────────────────────────────────────────────────
  // Searches titles AND artist names, case-insensitive.
  async function performSearch(): Promise<void> {
    try {
      const db      = new HistoryDatabase();
      const results = await db.searchByTitle(searchText);
      db.close();
      setFilteredSongs(results);
    } catch (err) {
      console.error("[SongHistory] Search error:", err);
    }
  }

  // ── Export history ────────────────────────────────────────────────────────
  // Copies the entire history to the clipboard in the chosen format.
  // JSON = machine-readable; CSV = opens in Excel / Google Sheets.
  async function exportHistory(format: "json" | "csv"): Promise<void> {
    try {
      const db      = new HistoryDatabase();
      // exportToJSON() / exportToCSV() return a text string — no file is saved to disk
      const content = format === "json" ? db.exportToJSON() : db.exportToCSV();
      db.close();

      await Clipboard.copy(content);
      await showToast({
        style:   Toast.Style.Success,
        title:   `✓ Exported to ${format.toUpperCase()}`,
        message: "History copied to clipboard",
      });
    } catch (err) {
      showToast({
        style:   Toast.Style.Failure,
        title:   "Export failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // ── Delete a song ─────────────────────────────────────────────────────────
  // Removes the entry from storage and updates the on-screen lists immediately
  // so the UI feels instant (no need to reload from storage).
  async function deleteSong(id: string): Promise<void> {
    try {
      const db      = new HistoryDatabase();
      const success = db.deleteSong(id);
      db.close();

      if (success) {
        // Filter the deleted song out of both the full list and the filtered list
        const updated = songs.filter((s) => s.id !== id);
        setSongs(updated);
        setFilteredSongs(
          updated.filter((s) => s.title.toLowerCase().includes(searchText.toLowerCase()))
        );
        await showToast({ style: Toast.Style.Success, title: "✓ Song deleted" });
        setSelectedSong(null); // Go back to the list view
      }
    } catch (err) {
      showToast({
        style:   Toast.Style.Failure,
        title:   "Failed to delete song",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER LOGIC
  // ════════════════════════════════════════════════════════════════════════════

  // ── Detail screen (when a song is selected) ───────────────────────────────
  if (selectedSong) {
    // Convert the Unix timestamp (milliseconds) to a human-readable date/time string
    const time = new Date(selectedSong.timestamp);

    // Build the Markdown content for the detail view
    const markdown = `
# 🎵 ${selectedSong.title}

## 👤 ${selectedSong.artist}

${selectedSong.album       ? `**Album:** ${selectedSong.album}`                          : ""}

${selectedSong.releaseYear ? `**Released:** ${selectedSong.releaseYear}`                 : ""}

**Service:** ${selectedSong.service}

**Identified:** ${time.toLocaleString()}

${selectedSong.confidence  ? `**Confidence:** ${(selectedSong.confidence * 100).toFixed(1)}%` : ""}
`;

    return (
      <Detail
        markdown={markdown}
        actions={
          <ActionPanel>
            <Action
              title="Search on Spotify"
              icon={Icon.MagnifyingGlass}
              onAction={() => openInSpotify(undefined, selectedSong.artist, selectedSong.title)}
            />
            <Action
              title="Search on YouTube"
              icon={Icon.MagnifyingGlass}
              onAction={() => openInYouTube(undefined, selectedSong.artist, selectedSong.title)}
            />
            {/* copySongDetails expects a SongResult; we build a minimal one from the HistoryEntry */}
            <Action
              title="Copy Details"
              icon={Icon.Clipboard}
              onAction={() =>
                copySongDetails({
                  title:       selectedSong.title,
                  artist:      selectedSong.artist,
                  album:       selectedSong.album,
                  releaseYear: selectedSong.releaseYear,
                  confidence:  selectedSong.confidence,
                })
              }
            />
            {/* Action.Style.Destructive turns this button red to signal a dangerous action */}
            <Action
              title="Delete from History"
              icon={Icon.Trash}
              style={Action.Style.Destructive}
              onAction={() => deleteSong(selectedSong.id)}
            />
            {/* Go back to the list by clearing the selectedSong state */}
            <Action
              title="Back to History"
              icon={Icon.ChevronLeft}
              onAction={() => setSelectedSong(null)}
            />
          </ActionPanel>
        }
      />
    );
  }

  // ── Loading spinner ───────────────────────────────────────────────────────
  if (loading) {                                                                                                                                        
    return <List isLoading={true} searchBarPlaceholder="Search songs..." />;
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (songs.length === 0) {
    return (
      <List searchBarPlaceholder="Search songs...">
        <List.EmptyView
          title="No songs in history"
          description="Run 'Identify Song' to build your history"
        />
      </List>
    );
  }

  // ── Main list screen ──────────────────────────────────────────────────────
  return (
    <List
      isLoading={loading}
      onSearchTextChange={setSearchText} // Called every keystroke — updates the search state
      searchBarPlaceholder="Search by title or artist..."
      // Actions at the list level (not tied to a specific item) — shown when nothing is selected
      actions={
        <ActionPanel>
          <Action title="Export as JSON" icon={Icon.Download} onAction={() => exportHistory("json")} />
          <Action title="Export as CSV"  icon={Icon.Download} onAction={() => exportHistory("csv")}  />
        </ActionPanel>
      }
    >
      {/* .map() turns each HistoryEntry into a List.Item component */}
      {filteredSongs.map((song) => {
        const time = new Date(song.timestamp);

        // Build a human-friendly "time ago" string instead of a raw date
        // Date.now() - song.timestamp = how many milliseconds ago this was
        const timeStr =
          Date.now() - song.timestamp < 60000        ? "Just now"     // < 1 minute
          : Date.now() - song.timestamp < 3600000    ? `${Math.floor((Date.now() - song.timestamp) / 60000)} min ago`   // < 1 hour
          : Date.now() - song.timestamp < 86400000   ? `${Math.floor((Date.now() - song.timestamp) / 3600000)} hours ago` // < 1 day
          : time.toLocaleDateString();               // Older → show the date

        return (
          <List.Item
            key={song.id}           // React needs a unique key on each list item
            title={song.title}      // Main text: song title
            subtitle={song.artist}  // Smaller text: artist name
            // accessories = small labels on the right side of each row
            accessories={[
              { text: timeStr },        // e.g. "3 min ago"
              { text: song.service },   // e.g. "chromaprint"
            ]}
            actions={
              <ActionPanel>
                {/* Clicking "View Details" pushes to the detail screen above */}
                <Action
                  title="View Details"
                  icon={Icon.Eye}
                  onAction={() => setSelectedSong(song)}
                />
                <Action
                  title="Search on Spotify"
                  icon={Icon.MagnifyingGlass}
                  onAction={() => openInSpotify(undefined, song.artist, song.title)}
                />
                <Action
                  title="Search on YouTube"
                  icon={Icon.MagnifyingGlass}
                  onAction={() => openInYouTube(undefined, song.artist, song.title)}
                />
                <Action
                  title="Copy Details"
                  icon={Icon.Clipboard}
                  onAction={() =>
                    copySongDetails({
                      title:       song.title,
                      artist:      song.artist,
                      album:       song.album,
                      releaseYear: song.releaseYear,
                      confidence:  song.confidence,
                    })
                  }
                />
                <Action
                  title="Delete"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  onAction={() => deleteSong(song.id)}
                />
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}
