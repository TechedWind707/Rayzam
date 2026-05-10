/**
 * ─────────────────────────────────────────────────────────────────
 * song-history.tsx  —  The "Song History" command for Rayzam
 * ─────────────────────────────────────────────────────────────────
 *
 * Every time Rayzam successfully identifies a song, it saves a
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
  List, // Renders a searchable, scrollable list
  ActionPanel, // Container for ⌘K actions
  Action, // A single action item
  Icon, // Raycast's built-in icon set
  showToast, // Brief pop-up notification
  Toast, // Toast type definitions
  Clipboard, // Lets us copy text to the system clipboard
  Alert,
  confirmAlert,
} from "@raycast/api";
import { useState, useEffect, useRef } from "react";
import { HistoryDatabase } from "./storage/database";
import { HistoryEntry, SongResult } from "./services/types";
import {
  copySongDetails,
  openInSpotify,
  openInAppleMusic,
  openInYouTube,
  openInYouTubeMusic,
} from "./utils/actions";

// ─── The main React component ─────────────────────────────────────────────────
export default function SongHistoryCommand() {
  // ── State ────────────────────────────────────────────────────────────────
  const [songs, setSongs] = useState<HistoryEntry[]>([]); // All loaded songs
  const [filteredSongs, setFilteredSongs] = useState<HistoryEntry[]>([]); // Songs matching the search
  const [searchText, setSearchText] = useState(""); // Current text in the search bar
  const [loading, setLoading] = useState(true); // True while loading from storage

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
      const db = new HistoryDatabase();
      const recent = await db.getRecent(100); // Get the 100 most recent songs
      db.close();
      setSongs(recent);
      setFilteredSongs(recent); // Initially show all songs
      setLoading(false);
    } catch (err) {
      console.error("[SongHistory] Load error:", err);
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to load history",
        message: err instanceof Error ? err.message : "Unknown error",
      });
      setLoading(false);
    }
  }

  // ── Search through history ────────────────────────────────────────────────
  // Searches titles AND artist names, case-insensitive.
  async function performSearch(): Promise<void> {
    try {
      const db = new HistoryDatabase();
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
      const content = format === "json" ? exportSongsToJSON(songs) : exportSongsToCSV(songs);

      await Clipboard.copy(content);
      await showToast({
        style: Toast.Style.Success,
        title: `✓ Exported to ${format.toUpperCase()}`,
        message: "History copied to clipboard",
      });
    } catch (err) {
      showToast({
        style: Toast.Style.Failure,
        title: "Export failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  function exportSongsToJSON(entries: HistoryEntry[]): string {
    return JSON.stringify(entries, null, 2);
  }

  function exportSongsToCSV(entries: HistoryEntry[]): string {
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

    const escapeCsv = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }

      return value;
    };

    const rows = entries.map((entry) =>
      [
        entry.id,
        escapeCsv(entry.title),
        escapeCsv(entry.artist),
        escapeCsv(entry.album || ""),
        entry.releaseYear || "",
        entry.service,
        entry.timestamp,
        entry.confidence || "",
        escapeCsv(entry.spotifyId || ""),
        escapeCsv(entry.youtubeUrl || ""),
        escapeCsv(entry.appleMusicUrl || ""),
        escapeCsv(entry.albumArtUrl || ""),
      ].join(",")
    );

    return [headers.join(","), ...rows].join("\n");
  }

  function HistoryManagementActions() {
    return (
      <ActionPanel.Section title="History">
        <Action
          title="Export as JSON"
          icon={Icon.Download}
          onAction={() => exportHistory("json")}
        />
        <Action
          title="Export as Csv"
          icon={Icon.Download}
          onAction={() => exportHistory("csv")}
        />
        <Action
          title="Clear Song History"
          icon={Icon.Trash}
          style={Action.Style.Destructive}
          onAction={clearHistory}
        />
      </ActionPanel.Section>
    );
  }

  // ── Delete a song ─────────────────────────────────────────────────────────
  // Removes the entry from storage and updates the on-screen lists immediately
  // so the UI feels instant (no need to reload from storage).
  async function deleteSong(id: string): Promise<void> {
    try {
      const db = new HistoryDatabase();
      const success = await db.deleteSong(id);
      db.close();

      if (success) {
        // Filter the deleted song out of both the full list and the filtered list
        const updated = songs.filter((s) => s.id !== id);
        setSongs(updated);
        setFilteredSongs(
          updated.filter((s) => s.title.toLowerCase().includes(searchText.toLowerCase()))
        );
        await showToast({ style: Toast.Style.Success, title: "✓ Song deleted" });
      }
    } catch (err) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to delete song",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }
  async function clearHistory(): Promise<void> {
    const confirmed = await confirmAlert({
      title: "Clear Song History?",
      message: "This removes every saved song from Rayzam history. This cannot be undone.",
      primaryAction: {
        title: "Clear History",
        style: Alert.ActionStyle.Destructive,
      },
    });

    if (!confirmed) {
      return;
    }

    try {
      const db = new HistoryDatabase();
      await db.clearAll();
      db.close();
      setSongs([]);
      setFilteredSongs([]);
      await showToast({ style: Toast.Style.Success, title: "Song History Cleared" });
    } catch (err) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to Clear History",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER LOGIC
  // ════════════════════════════════════════════════════════════════════════════

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
      isShowingDetail
      onSearchTextChange={setSearchText} // Called every keystroke — updates the search state
      searchBarPlaceholder="Search by title or artist..."
      // Actions at the list level (not tied to a specific item) — shown when nothing is selected
      actions={
        <ActionPanel>
          <HistoryManagementActions />
        </ActionPanel>
      }
    >
      {/* .map() turns each HistoryEntry into a List.Item component */}
      {filteredSongs.map((song) => {
        const time = new Date(song.timestamp);

        // Build a human-friendly "time ago" string instead of a raw date
        // Date.now() - song.timestamp = how many milliseconds ago this was
        const timeStr =
          Date.now() - song.timestamp < 60000
            ? "Just now" // < 1 minute
            : Date.now() - song.timestamp < 3600000
              ? `${Math.floor((Date.now() - song.timestamp) / 60000)} min ago` // < 1 hour
              : Date.now() - song.timestamp < 86400000
                ? `${Math.floor((Date.now() - song.timestamp) / 3600000)} hours ago` // < 1 day
                : time.toLocaleDateString(); // Older → show the date

        return (
          <List.Item
            key={song.id} // React needs a unique key on each list item
            title={song.title} // Main text: song title
            subtitle={song.artist} // Smaller text: artist name
            icon={song.albumArtUrl ? { source: song.albumArtUrl } : Icon.Music}
            // accessories = small labels on the right side of each row
            accessories={[
              { text: timeStr }, // e.g. "3 min ago"
              { text: song.service }, // e.g. "acrcloud"
            ]}
            detail={<SongDetail song={song} />}
            actions={
              <ActionPanel>
                <Action
                  title={song.spotifyId ? "Open in Spotify" : "Search on Spotify"}
                  icon={Icon.MagnifyingGlass}
                  onAction={() => openInSpotify(song.spotifyId, song.artist, song.title)}
                />
                <Action
                  title={song.appleMusicUrl ? "Open in Apple Music" : "Search on Apple Music"}
                  icon={Icon.MagnifyingGlass}
                  onAction={() => openInAppleMusic(song.appleMusicUrl, song.artist, song.title)}
                />
                <Action
                  title="Search on Youtube Music"
                  icon={Icon.MagnifyingGlass}
                  onAction={() => openInYouTubeMusic(song.artist, song.title)}
                />
                <Action
                  title={song.youtubeUrl ? "Watch on Youtube" : "Search on Youtube"}
                  icon={Icon.MagnifyingGlass}
                  onAction={() => openInYouTube(song.youtubeUrl, song.artist, song.title)}
                />
                <Action
                  title="Copy Details"
                  icon={Icon.Clipboard}
                  onAction={() =>
                    copySongDetails({
                      title: song.title,
                      artist: song.artist,
                      album: song.album,
                      releaseYear: song.releaseYear,
                      confidence: song.confidence,
                      albumArtUrl: song.albumArtUrl,
                    })
                  }
                />
                <Action
                  title="Delete"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  onAction={() => deleteSong(song.id)}
                />
                {song.alternatives && song.alternatives.length > 0 && (
                  <Action.Push
                    title="View Alternative Matches"
                    icon={Icon.List}
                    target={
                      <AlternativeMatchesList
                        parentTitle={song.title}
                        candidates={song.alternatives}
                      />
                    }
                  />
                )}
                <HistoryManagementActions />
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function SongDetail({ song }: { song: HistoryEntry }) {
  const markdown = [
    `# ${song.title}`,
    `## ${song.artist}`,
    song.albumArtUrl ? `<img src="${song.albumArtUrl}" width="180" />` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return (
    <List.Item.Detail
      markdown={markdown}
      metadata={
        <List.Item.Detail.Metadata>
          {song.album && <List.Item.Detail.Metadata.Label title="Album" text={song.album} />}
          {song.releaseYear && (
            <List.Item.Detail.Metadata.Label title="Release Year" text={`${song.releaseYear}`} />
          )}
          <List.Item.Detail.Metadata.Label
            title="Identified"
            text={formatDateTime(song.timestamp)}
          />
          <List.Item.Detail.Metadata.Label title="Service" text={song.service} />
          {song.confidence !== undefined && (
            <List.Item.Detail.Metadata.Label
              title="Confidence"
              text={`${(song.confidence * 100).toFixed(1)}%`}
            />
          )}
          {song.alternatives && song.alternatives.length > 0 && (
            <List.Item.Detail.Metadata.Label
              title="Alternative Matches"
              text={`${song.alternatives.length}`}
            />
          )}
        </List.Item.Detail.Metadata>
      }
    />
  );
}

function AlternativeMatchesList({
  parentTitle,
  candidates,
}: {
  parentTitle: string;
  candidates: SongResult[];
}) {
  return (
    <List isShowingDetail searchBarPlaceholder="Search alternative matches...">
      {candidates.map((candidate, index) => (
        <List.Item
          key={`${candidate.title}-${candidate.artist}-${index}`}
          title={candidate.title}
          subtitle={candidate.artist}
          icon={candidate.albumArtUrl ? { source: candidate.albumArtUrl } : Icon.Music}
          accessories={[
            candidate.confidence !== undefined
              ? { text: `${(candidate.confidence * 100).toFixed(1)}%` }
              : {},
          ]}
          detail={
            <List.Item.Detail
              markdown={[
                `# ${candidate.title}`,
                `## ${candidate.artist}`,
                candidate.albumArtUrl ? `<img src="${candidate.albumArtUrl}" width="180" />` : "",
              ]
                .filter(Boolean)
                .join("\n\n")}
              metadata={
                <List.Item.Detail.Metadata>
                  <List.Item.Detail.Metadata.Label title="Original Match" text={parentTitle} />
                  {candidate.album && (
                    <List.Item.Detail.Metadata.Label title="Album" text={candidate.album} />
                  )}
                  {candidate.releaseYear && (
                    <List.Item.Detail.Metadata.Label
                      title="Release Year"
                      text={`${candidate.releaseYear}`}
                    />
                  )}
                  {candidate.confidence !== undefined && (
                    <List.Item.Detail.Metadata.Label
                      title="Confidence"
                      text={`${(candidate.confidence * 100).toFixed(1)}%`}
                    />
                  )}
                </List.Item.Detail.Metadata>
              }
            />
          }
          actions={
            <ActionPanel>
              <Action
                title="Search on Spotify"
                icon={Icon.MagnifyingGlass}
                onAction={() =>
                  openInSpotify(candidate.spotifyId, candidate.artist, candidate.title)
                }
              />
              <Action
                title={candidate.youtubeUrl ? "Watch on Youtube" : "Search on Youtube"}
                icon={Icon.MagnifyingGlass}
                onAction={() =>
                  openInYouTube(candidate.youtubeUrl, candidate.artist, candidate.title)
                }
              />
              <Action
                title="Copy Details"
                icon={Icon.Clipboard}
                onAction={() => copySongDetails(candidate)}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
