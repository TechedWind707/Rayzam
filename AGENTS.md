# AGENTS.md

Guidance for coding agents working on Rayzam.

## Project Summary

Rayzam is a Raycast extension for identifying music from the microphone. It supports ACRCloud and AudD, saves searchable song history, opens matches in music services, and can optionally save debug audio and raw provider JSON.

## Ground Rules

- Use npm, not Bun. Keep `package-lock.json`; do not add `bun.lock`.
- Use `rg` for search.
- Use `apply_patch` for manual edits.
- Do not revert unrelated user changes.
- Keep edits focused on the requested behavior.
- Run `npm run build` and `npm run lint` after code changes.
- Run targeted tests when changing storage, action helpers, or recorder behavior.
- Do not log API keys, secrets, tokens, or full credentials.

## Important Files

- `package.json` - Raycast manifest, commands, preferences, scripts
- `src/identify-song.tsx` - Identify Song command
- `src/song-history.tsx` - Song History command
- `src/services/recorder.ts` - FFmpeg recording
- `src/services/acrcloud.ts` - ACRCloud recognition
- `src/services/audd.ts` - AudD recognition
- `src/services/artwork.ts` - artwork lookup fallbacks
- `src/services/index.ts` - service factory and setup checks
- `src/services/types.ts` - shared contracts
- `src/storage/database.ts` - song history storage
- `src/utils/actions.ts` - Spotify, Apple Music, YouTube, YouTube Music actions
- `src/utils/preferences.ts` - preference normalization
- `src/utils/debug-json.ts` - optional raw JSON saving
- `README.md` - user-facing setup guide
- `DEVELOPMENT.md` - contributor guide

## Architecture Notes

- Recognition services accept an audio file path, not a buffer.
- `createRecognitionService` validates credentials for the selected provider before recording begins.
- ACRCloud can return matches in `metadata.music` or `metadata.humming`.
- AudD returns its primary match in `result`.
- The app stores only the top match by default.
- Alternative matches are saved only when `saveAlternativeMatches` is enabled.
- Debug audio and debug JSON are opt-in because they can contain private data.

## UI Expectations

- Keep command titles short and functional.
- The extension name is `Rayzam`; command titles should stay descriptive.
- Use Raycast components before custom layout tricks.
- Prefer metadata side panels for structured song details.
- Keep provider setup errors friendly and non-alarming.
- Keep Identify Song and Song History actions aligned.
- Show YouTube Music before YouTube when both actions appear.

## Platform Notes

- Windows recording uses FFmpeg DirectShow.
- macOS recording uses FFmpeg AVFoundation.
- Apple Music native app links are reliable on macOS only; Windows should fall back to web where needed.
- Avoid hardcoded Windows paths except in docs/examples.

## Publishing Notes

- Keep `README.md` concise but complete enough for API-key setup.
- Runtime assets and README images belong in `assets/`.
- Store screenshots belong in `metadata/`.
- Generated files such as `dist/` and `raycast-env.d.ts` should stay ignored.
- Check `.gitignore` before adding local debug files.
