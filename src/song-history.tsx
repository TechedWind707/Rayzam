/**
 * Command: Song History
 * Browse and search through previously identified songs
 */

import React from "react";
import { List, ActionPanel, Action, Detail, Icon, showToast, Toast, Clipboard } from "@raycast/api";
import { useState, useEffect } from "react";
import { HistoryDatabase } from "./storage/database";
import { HistoryEntry } from "./services/types";
import { copySongDetails, openInSpotify, openInAppleMusic, openInYouTube } from "./utils/actions";

export default function SongHistoryCommand() {
  const [songs, setSongs] = useState<HistoryEntry[]>([]);
  const [filteredSongs, setFilteredSongs] = useState<HistoryEntry[]>([]);
  const [selectedSong, setSelectedSong] = useState<HistoryEntry | null>(null);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (searchText.trim() === "") {
      setFilteredSongs(songs);
    } else {
      performSearch();
    }
  }, [searchText, songs]);

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

  async function loadHistory(): Promise<void> {
    try {
      const db = new HistoryDatabase();
      const recent = await db.getRecent(100);
      db.close();
      setSongs(recent);
      setFilteredSongs(recent);
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

  async function exportHistory(format: "json" | "csv"): Promise<void> {
    try {
      const db = new HistoryDatabase();
      const content = format === "json" ? db.exportToJSON() : db.exportToCSV();
      db.close();

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

  async function deleteSong(id: string): Promise<void> {
    try {
      const db = new HistoryDatabase();
      const success = db.deleteSong(id);
      db.close();

      if (success) {
        const updated = songs.filter((s) => s.id !== id);
        setSongs(updated);
        setFilteredSongs(updated.filter((s) => s.title.toLowerCase().includes(searchText.toLowerCase())));
        await showToast({
          style: Toast.Style.Success,
          title: "✓ Song deleted",
        });
        setSelectedSong(null);
      }
    } catch (err) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to delete song",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  if (selectedSong) {
    const time = new Date(selectedSong.timestamp);
    const markdown = `
# 🎵 ${selectedSong.title}

## 👤 ${selectedSong.artist}

${selectedSong.album ? `**Album:** ${selectedSong.album}` : ""}

${selectedSong.releaseYear ? `**Released:** ${selectedSong.releaseYear}` : ""}

**Service:** ${selectedSong.service}

**Identified:** ${time.toLocaleString()}

${selectedSong.confidence ? `**Confidence:** ${(selectedSong.confidence * 100).toFixed(1)}%` : ""}
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
            <Action
              title="Copy Details"
              icon={Icon.Clipboard}
              onAction={() =>
                copySongDetails({
                  title: selectedSong.title,
                  artist: selectedSong.artist,
                  album: selectedSong.album,
                  releaseYear: selectedSong.releaseYear,
                  confidence: selectedSong.confidence,
                })
              }
            />
            <Action
              title="Delete from History"
              icon={Icon.Trash}
              style={Action.Style.Destructive}
              onAction={() => deleteSong(selectedSong.id)}
            />
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

  if (loading) {
    return <List isLoading={true} searchBarPlaceholder="Search songs..." />;
  }

  if (songs.length === 0) {
    return (
      <List searchBarPlaceholder="Search songs...">
        <List.EmptyView title="No songs in history" description="Run 'Identify Song' to build your history" />
      </List>
    );
  }

  return (
    <List
      isLoading={loading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search by title or artist..."
      actions={
        <ActionPanel>
          <Action
            title="Export as JSON"
            icon={Icon.Download}
            onAction={() => exportHistory("json")}
          />
          <Action
            title="Export as CSV"
            icon={Icon.Download}
            onAction={() => exportHistory("csv")}
          />
        </ActionPanel>
      }
    >
      {filteredSongs.map((song) => {
        const time = new Date(song.timestamp);
        const timeStr =
          Date.now() - song.timestamp < 60000
            ? "Just now"
            : Date.now() - song.timestamp < 3600000
              ? `${Math.floor((Date.now() - song.timestamp) / 60000)} min ago`
              : Date.now() - song.timestamp < 86400000
                ? `${Math.floor((Date.now() - song.timestamp) / 3600000)} hours ago`
                : time.toLocaleDateString();

        return (
          <List.Item
            key={song.id}
            title={song.title}
            subtitle={song.artist}
            accessories={[{ text: timeStr }, { text: `${song.service}` }]}
            actions={
              <ActionPanel>
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
                      title: song.title,
                      artist: song.artist,
                      album: song.album,
                      releaseYear: song.releaseYear,
                      confidence: song.confidence,
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
