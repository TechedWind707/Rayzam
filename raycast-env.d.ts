/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Recognition Service - Which service to use for song recognition */
  "service": "chromaprint" | "audd" | "acrcloud",
  /** Recording Duration - How many seconds to record audio (3–15) */
  "recordingDuration": string,
  /** Audio Input Device - Leave blank to auto-detect. On Windows: paste the exact DirectShow name shown by running `ffmpeg -list_devices true -f dshow -i dummy` in a terminal (e.g. Microphone (Realtek Audio)). On macOS: paste the AVFoundation device index shown by `ffmpeg -f avfoundation -list_devices true -i ""`. */
  "inputDevice"?: string,
  /** AcoustID API Key - Optional: Use your own key from acoustid.org/new-application */
  "acoustIdApiKey"?: string,
  /** AudD API Key - API key from audd.io (only needed if using AudD service) */
  "auddApiKey"?: string,
  /** ACRCloud Access Key - Access key from acrcloud.com (only needed if using ACRCloud) */
  "acrcloudAccessKey"?: string,
  /** ACRCloud Access Secret - Access secret from acrcloud.com (only needed if using ACRCloud) */
  "acrcloudAccessSecret"?: string,
  /** ACRCloud Host - ACRCloud host endpoint (only needed if using ACRCloud) */
  "acrcloudHost": string
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

