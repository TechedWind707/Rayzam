# Development Guide

## Getting Started

### Setup
```bash
# Clone the repository
git clone https://github.com/yourusername/raycast-songsnap.git
cd raycast-songsnap

# Install dependencies
npm install

# Start development
npm run dev
```

### Available Commands
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm test             # Run tests
npm run test:watch   # Watch mode for tests
npm run lint         # Run linter
npm run format       # Format code
```

## Architecture

### Service Layer (`src/services/`)
Each recognition service implements the `MusicRecognitionService` interface:

```typescript
interface MusicRecognitionService {
  recognize(audioBuffer: Buffer): Promise<SongResult>;
}
```

Services are created via the `ServiceFactory` which handles configuration:

```typescript
const service = ServiceFactory.createService({
  service: RecognitionService.SHAZAMIO,
  // ... credentials if needed
});
```

### Storage Layer (`src/storage/`)
- `HistoryDatabase`: JSON file-based storage
- Stores up to 500 most recent songs
- Location: `~/.config/songsnap/history.json`
- Supports search, export (JSON/CSV), and deletion

### UI Layer (`src/commands/`)
- `identify-song.tsx`: Main recognition interface
- `song-history.tsx`: History browser and search
- Uses Raycast's List and Detail components

## Adding New Recognition Services

### Step 1: Create Service Class
```typescript
// src/services/mynewservice.ts
import { MusicRecognitionService, SongResult, RecognitionError, RecognitionService } from "./types";

export class MyNewService implements MusicRecognitionService {
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async recognize(audioBuffer: Buffer): Promise<SongResult> {
    // Implementation
    try {
      // Call API
      // Parse response
      // Return SongResult
    } catch (error) {
      throw new RecognitionError(
        "Error message",
        RecognitionService.MYNEWSERVICE,
        error
      );
    }
  }
}
```

### Step 2: Add to Service Factory
```typescript
// src/services/index.ts
export enum RecognitionService {
  // ... existing
  MYNEWSERVICE = "mynewservice",
}

export class ServiceFactory {
  static createService(config: ServiceConfig): MusicRecognitionService {
    switch (config.service) {
      // ... existing cases
      case RecognitionService.MYNEWSERVICE:
        if (!config.mynewserviceApiKey) {
          throw new Error("MyNewService API key is required");
        }
        return new MyNewService(config.mynewserviceApiKey);
    }
  }
}
```

### Step 3: Add Preferences
```json
{
  "preferences": [
    {
      "name": "mynewserviceApiKey",
      "title": "MyNewService API Key",
      "description": "Your API key for MyNewService",
      "type": "password",
      "required": false
    }
  ]
}
```

### Step 4: Update Preferences Type
```typescript
// src/utils/preferences.ts
export interface Preferences {
  // ... existing
  mynewserviceApiKey?: string;
}

export function validatePreferences(prefs: Preferences): string | null {
  // ... existing
  if (prefs.recognitionService === RecognitionService.MYNEWSERVICE) {
    if (!prefs.mynewserviceApiKey) {
      return "MyNewService API key is required";
    }
  }
}
```

### Step 5: Write Tests
```typescript
// src/services/__tests__/mynewservice.test.ts
import { MyNewService } from "../mynewservice";

describe("MyNewService", () => {
  it("should recognize audio", async () => {
    // Test implementation
  });
});
```

## Testing Strategy

### Unit Tests
- Test each service independently
- Mock external API calls
- Test error handling
- Test type safety

### Integration Tests (Manual)
- Test on actual Raycast
- Test with real audio
- Test on macOS and Windows
- Test different recognition services

### Coverage Goals
- **Target**: 80%+ overall coverage
- **Services**: 85%+ coverage
- **Storage**: 90%+ coverage
- **Utils**: 85%+ coverage

## Code Style

### TypeScript
- Use strict mode
- Explicit types everywhere
- No `any` types unless necessary
- Full JSDoc comments for public APIs

### React/TSX
- Functional components
- React hooks for state
- No class components

### Naming
- camelCase for functions/variables
- PascalCase for classes/interfaces/enums
- UPPER_CASE for constants
- Prefix private methods with underscore: `_privateMethod()`

## Error Handling

### Custom Errors
```typescript
// RecognitionError
throw new RecognitionError(
  "No matches found",
  RecognitionService.SHAZAMIO,
  originalError
);

// AudioRecordingError
throw new AudioRecordingError(
  "Microphone not found",
  originalError
);
```

### User-Facing Messages
- Keep error messages short and actionable
- Suggest solutions in error messages
- Log detailed errors for debugging

## Performance Optimization

### Audio Recording
- Default 5 seconds (user configurable)
- Stream recording to avoid memory issues
- Clean up temp files immediately

### API Calls
- Implement retry logic with exponential backoff
- Cache results when possible
- Set reasonable timeouts (30s)

### History Storage
- Limit to 500 most recent songs
- Use JSON for simplicity
- Consider pagination for large histories

## Debugging

### Enable Debug Logging
```typescript
// In services
console.log("Debug info:", data);

// View in Raycast:
// Extension > Extension Details > Show Log
```

### Common Issues

**Issue**: "No matches found"
- Check audio quality
- Verify service credentials
- Try different audio sample
- Check internet connection

**Issue**: Microphone errors
- Check system permissions
- Verify default microphone settings
- Try alternative microphone

**Issue**: Performance slow
- Check network latency
- Consider using faster service (ACRCloud > AudD > Shazamio)
- Increase recording duration

## Release Checklist

- [ ] All tests passing (100%)
- [ ] Code formatted and linted
- [ ] TypeScript strict mode passing
- [ ] Manual testing on macOS
- [ ] Manual testing on Windows
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Version bumped
- [ ] Built for production
- [ ] Submitted to Raycast store

## Resources

- [Raycast API Docs](https://developers.raycast.com/)
- [React Hooks](https://react.dev/reference/react/hooks)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Jest Testing](https://jestjs.io/docs/getting-started)

## Support

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **PRs**: Welcome with tests and documentation

---

Built with ❤️ for developers who want to identify music without leaving their keyboard.
