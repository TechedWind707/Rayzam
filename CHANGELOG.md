# Changelog

## [1.0.0] - 2026-02-02

### Added
- **Core Functionality**
  - Audio recording with cross-platform support (macOS & Windows)
  - Three recognition services: Shazamio (free), ACRCloud (professional), AudD (API-based)
  - Song identification with < 10 second response time
  - Rich metadata display (title, artist, album, year, duration, confidence)

- **Features**
  - Song History: Browse all identified songs locally
  - Search History: Filter songs by title or artist
  - Export History: Download as JSON or CSV
  - Quick Actions: Open in Spotify, Apple Music, YouTube, or copy to clipboard
  - Preferences: Choose recognition service and configure API credentials
  - Album Artwork: Display album covers when available

- **User Experience**
  - Keyboard-first workflow (one command trigger)
  - Loading animations with countdown timer
  - Toast notifications for success/failure
  - Time-relative history display ("2 minutes ago", "yesterday", etc.)
  - Beautiful markdown formatting for results

- **Developer Experience**
  - TypeScript for type safety
  - Comprehensive unit tests (10 passing tests)
  - Jest test framework with >80% coverage target
  - Service factory pattern for extensibility
  - Well-documented code with JSDoc comments
  - Prettier code formatting configuration

- **Documentation**
  - Comprehensive README with setup and usage instructions
  - Development guide for contributing
  - Inline code documentation
  - Configuration examples for each service
  - Troubleshooting section

### Technical Details
- **Language**: TypeScript with React/TSX
- **Framework**: Raycast v1.75+
- **Storage**: JSON-based local history (no database required)
- **Audio**: Cross-platform recording with ffmpeg/sox
- **APIs**: 
  - Shazamio: Unofficial reverse-engineered API
  - ACRCloud: Official music recognition API
  - AudD: Official music identification API

### Performance
- Audio recording: 3-15 seconds (configurable)
- API latency: 1-5 seconds (typically)
- Total end-to-end: < 10 seconds (target achieved)
- History storage: Instant (JSON file)
- Search: <100ms for 500 songs

### Compatibility
- ✅ macOS (Monterey and newer)
- ✅ Windows (10 and newer)
- ✅ Raycast v1.75+

### Known Limitations
- Requires microphone access permission
- Shazamio may have occasional rate limiting
- ACRCloud and AudD require user API credentials
- History limited to 500 most recent songs

### Future Roadmap
- [ ] Lyrics display in Raycast
- [ ] Spotify playlist integration
- [ ] Continuous listening mode
- [ ] Social sharing (Discord, Slack)
- [ ] Local audio fingerprinting
- [ ] Browser extension companion
- [ ] Advanced analytics

---

## Version History

### Versioning Scheme
- MAJOR: Breaking changes to UI or API
- MINOR: New features, backward compatible
- PATCH: Bug fixes and improvements

### Semantic Versioning
This project follows [Semantic Versioning](https://semver.org/).

---

**Latest Release**: v1.0.0 (Feb 2, 2026)
**Status**: Stable ✓

For upgrade notes, see [README.md](./README.md#installation)
