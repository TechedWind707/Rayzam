import axios from "axios";

export interface ArtworkLookupInput {
  title: string;
  artist: string;
  album?: string;
  deezerAlbumId?: string;
  youtubeVideoId?: string;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isCloseMatch(expected: string, actual?: string): boolean {
  if (!actual) {
    return false;
  }

  const normalizedExpected = normalize(expected);
  const normalizedActual = normalize(actual);
  return (
    normalizedActual.includes(normalizedExpected) ||
    normalizedExpected.includes(normalizedActual)
  );
}

export async function fetchDeezerAlbumArtwork(albumId?: string): Promise<string | undefined> {
  if (!albumId) {
    return undefined;
  }

  try {
    const response = await axios.get(`https://api.deezer.com/album/${encodeURIComponent(albumId)}`, {
      timeout: 8000,
    });
    const data = response.data as Record<string, unknown>;

    return (
      (data.cover_xl as string | undefined) ||
      (data.cover_big as string | undefined) ||
      (data.cover_medium as string | undefined) ||
      (data.cover as string | undefined)
    );
  } catch (err) {
    console.warn(
      "[Artwork] Deezer artwork lookup failed:",
      err instanceof Error ? err.message : err
    );
    return undefined;
  }
}

export async function searchITunesArtwork(
  title: string,
  artist: string,
  album?: string
): Promise<string | undefined> {
  const term = [title, artist, album].filter(Boolean).join(" ");

  try {
    const response = await axios.get("https://itunes.apple.com/search", {
      params: {
        term,
        entity: "song",
        limit: 5,
      },
      timeout: 8000,
    });
    const results = (response.data as { results?: Array<Record<string, unknown>> }).results || [];
    const bestMatch =
      results.find(
        (result) =>
          isCloseMatch(title, result.trackName as string | undefined) &&
          isCloseMatch(artist, result.artistName as string | undefined)
      ) || results[0];

    const artworkUrl =
      (bestMatch?.artworkUrl100 as string | undefined) ||
      (bestMatch?.artworkUrl60 as string | undefined) ||
      (bestMatch?.artworkUrl30 as string | undefined);

    return artworkUrl?.replace(/100x100bb\.(jpg|jpeg|png)$/i, "600x600bb.$1");
  } catch (err) {
    console.warn(
      "[Artwork] iTunes artwork lookup failed:",
      err instanceof Error ? err.message : err
    );
    return undefined;
  }
}

export async function findBestArtwork(input: ArtworkLookupInput): Promise<string | undefined> {
  return (
    (await fetchDeezerAlbumArtwork(input.deezerAlbumId)) ||
    (await searchITunesArtwork(input.title, input.artist, input.album)) ||
    (input.youtubeVideoId
      ? `https://i.ytimg.com/vi/${encodeURIComponent(input.youtubeVideoId)}/hqdefault.jpg`
      : undefined)
  );
}
