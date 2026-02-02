/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Recognition Service - Choose which service to use for music recognition */
  "recognitionService": "shazamio" | "acrcloud" | "audd",
  /** ACRCloud Access Key - Your ACRCloud Access Key (only needed if using ACRCloud) */
  "acrcloudAccessKey"?: string,
  /** ACRCloud Access Secret - Your ACRCloud Access Secret (only needed if using ACRCloud) */
  "acrcloudAccessSecret"?: string,
  /** AudD API Token - Your AudD API Token (only needed if using AudD) */
  "auddApiToken"?: string,
  /** Recording Duration (seconds) - How long to record audio for recognition (3-15 seconds) */
  "recordingDuration": "3" | "5" | "10" | "15"
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

