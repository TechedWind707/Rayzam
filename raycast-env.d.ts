/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Recognition Service - Which service to use for song recognition */
  "service": "audd" | "acrcloud",
  /** Recording Duration - How many seconds to record audio (10–30) */
  "recordingDuration": string,
  /** Save Debug Audio - Save a copy of each recording for troubleshooting audio capture issues */
  "enableDebugAudio": boolean,
  /** Saved Audio Directory - Folder where audio recordings are saved. If unavailable, Rayzam uses its Raycast support folder. */
  "debugAudioDirectory"?: string,
  /** Save Debug JSON - Save the raw JSON returned by your selected recognition service for troubleshooting matches. */
  "enableDebugJson": boolean,
  /** Saved JSON Directory - Folder where raw recognition JSON responses are saved. If unavailable, Rayzam uses its Raycast support folder. */
  "debugJsonDirectory"?: string,
  /** Save Alternative Matches - Save other recognition candidates returned by the provider so they can be reviewed from Song History. */
  "saveAlternativeMatches": boolean,
  /** Post-Match Action - What to do automatically after a song is identified */
  "postMatchAction": "details" | "spotify" | "appleMusic" | "youtube" | "youtubeMusic",
  /** Audio Input Device - Leave blank to auto-detect. On Windows: paste the exact DirectShow name shown by running `ffmpeg -list_devices true -f dshow -i dummy` in a terminal (e.g. Microphone (Realtek Audio)). On macOS: paste the AVFoundation device index shown by `ffmpeg -f avfoundation -list_devices true -i ""`. */
  "inputDevice"?: string,
  /** AudD API Key - API token from audd.io, used when you choose AudD as the recognition service. */
  "auddApiKey"?: string,
  /** ACRCloud Access Key - Access key from your ACRCloud Audio & Video Recognition project */
  "acrcloudAccessKey"?: string,
  /** ACRCloud Access Secret - Secret key from the same ACRCloud project as your access key */
  "acrcloudAccessSecret"?: string,
  /** ACRCloud Host - Host from the same ACRCloud project as your access key and secret key. */
  "acrcloudHost"?: string,
  /** ACRCloud Metadata API Token - Optional Bearer token from ACRCloud Developer Settings. Used to fetch artwork and richer platform metadata. */
  "acrcloudMetadataToken"?: string,
  /** ACRCloud Metadata API Host - Optional ACRCloud Metadata API host. Leave empty to use eu-api-v2.acrcloud.com. */
  "acrcloudMetadataHost"?: string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `identify-song` command */
  export type IdentifySong = ExtensionPreferences & {}
  /** Preferences accessible in the `song-history` command */
  export type SongHistory = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `identify-song` command */
  export type IdentifySong = {}
  /** Arguments passed to the `song-history` command */
  export type SongHistory = {}
}

