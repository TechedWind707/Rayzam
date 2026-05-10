# Development Guide

This guide is for working on Rayzam locally. For user setup, see `README.md`.

## Requirements

- Raycast with extension development enabled
- Node.js 22+
- npm
- FFmpeg available on `PATH`
- ACRCloud and/or AudD credentials for real recognition testing

Rayzam uses npm as its package manager. Keep `package-lock.json`; do not add Bun, pnpm, or Yarn lockfiles unless the project intentionally switches package managers.

## Setup

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm run build
npm run lint
npm test
npm run test:watch
npm run format
```

Run `npm run build` and `npm run lint` before publishing or opening a PR.

## Project Structure

- `src/identify-song.tsx` - main command for recording and identifying songs
- `src/song-history.tsx` - history browser, search, export, and song actions
- `src/components/SelectDeviceView.tsx` - in-app microphone/device picker
- `src/services/recorder.ts` - FFmpeg-based audio capture
- `src/services/acrcloud.ts` - ACRCloud recognition provider
- `src/services/audd.ts` - AudD recognition provider
- `src/services/artwork.ts` - free artwork fallback helpers
- `src/services/index.ts` - recognition service factory
- `src/services/types.ts` - shared result, history, and error types
- `src/storage/database.ts` - Raycast LocalStorage-backed song history
- `src/utils/actions.ts` - external music app/search actions
- `src/utils/preferences.ts` - Raycast preference loading and normalization
- `src/utils/debug-json.ts` - optional raw provider JSON saving
- `assets/` - runtime extension assets and README images
- `metadata/` - Raycast Store screenshots

## Recognition Flow

1. `identify-song.tsx` loads preferences and checks the selected provider.
2. `AudioRecorder` records a temporary WAV file with FFmpeg.
3. The selected service receives the audio file path.
4. The service parses the provider response into a `SongResult`.
5. Optional metadata/artwork enrichment runs.
6. The top match is displayed and saved to history.
7. Optional alternative matches are saved when the preference is enabled.

Recognition services implement:

```ts
interface RecognitionService {
  recognize(audioPath: string): Promise<RecognitionResult>;
}
```

The provider should return the top match as `SongResult`. If the provider returns multiple candidates, put the lower-ranked matches in `alternatives`.

## Preferences

Preferences live in `package.json` and are read through `src/utils/preferences.ts`.

Current important preferences:

- selected recognition service
- recording duration
- debug audio saving and directory
- debug JSON saving and directory
- alternative match saving
- post-match action
- optional input device
- AudD API key
- ACRCloud host, access key, secret key
- optional ACRCloud Metadata API token and host

Provider credentials are optional in Raycast preferences because users may configure only one provider. The app validates the selected provider before recording.

## Debugging

Raycast logs are available from the extension details screen.

For audio capture issues:

- Enable `Save Debug Audio`
- Choose a directory in `Saved Audio Directory`
- Play the saved WAV file and confirm it contains usable audio

For provider response issues:

- Enable `Save Debug JSON`
- Choose a directory in `Saved JSON Directory`
- Inspect the saved provider response

ACRCloud matches usually appear under:

```json
metadata.music
```

or, for humming:

```json
metadata.humming
```

AudD returns its main match under:

```json
result
```

## Adding a Recognition Provider

1. Add a new enum value in `src/services/types.ts`.
2. Create a service file in `src/services/`.
3. Implement `RecognitionService`.
4. Parse provider data into `SongResult`.
5. Add provider setup and validation in `src/services/index.ts`.
6. Add needed preferences in `package.json`.
7. Normalize preference loading in `src/utils/preferences.ts`.
8. Add focused tests where practical.

Keep provider errors user-facing and actionable. Log technical details to the console or optional debug JSON, not the visible error screen.

## UI Guidelines

- Follow Raycast conventions and prefer built-in components.
- Keep command titles simple: `Identify Song`, `Song History`.
- Keep `Rayzam` as the extension name, not something users must decode in command titles.
- Prefer `Detail.Metadata` for structured song details.
- Keep actions consistent between Identify Song and Song History.
- Put YouTube Music above YouTube when both are shown.
- On Windows, Apple Music should prefer web fallback because native deep links are unreliable.

## Storage

Song history is stored in Raycast LocalStorage under `rayzam_history`.

The history database keeps the 500 most recent entries. Stored entries may include platform links, artwork URLs, confidence, recognition service, and optional alternative matches.

## Tests

Tests live near the code they cover:

- `src/storage/__tests__/database.test.ts`
- `src/services/__tests__/recorder.test.ts`
- `src/utils/__tests__/actions.test.ts`

Mock Raycast APIs through `src/__mocks__/@raycast/api.ts`.

## Release Checklist

- `npm run build`
- `npm run lint`
- `npm test` where practical
- Manual test Identify Song with ACRCloud
- Manual test Identify Song with AudD if credentials are available
- Manual test Song History actions and export
- Confirm README setup steps and pricing notes are current
- Confirm metadata screenshots are current
- Confirm no local debug audio/JSON files are tracked
- Bump version when appropriate
- Update `CHANGELOG.md`

## Useful Links

- Raycast docs: <https://developers.raycast.com/>
- Raycast Store checklist: <https://developers.raycast.com/basics/prepare-an-extension-for-store>
- ACRCloud console: <https://console.acrcloud.com/>
- AudD dashboard: <https://dashboard.audd.io/>
