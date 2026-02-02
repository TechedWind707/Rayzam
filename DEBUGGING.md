# 🐛 Debugging Guide - SongSnap

## Viewing Logs in Raycast

### Step 1: Open Raycast Developer Tools
1. Open Raycast
2. Go to **Preferences** (Cmd+, on macOS / Ctrl+, on Windows)
3. Navigate to **Extensions**
4. Find **SongSnap - Shazam for Raycast**
5. Click on it and select **Show Log**

### Step 2: Read the Log Output
The logs are printed in real-time as the extension runs. Each log message is prefixed with the component name in brackets:

```
[SongSnap] Step 1: Getting preferences...
[Preferences] Loading preferences...
[Preferences] Loaded preferences: { recognitionService: 'shazamio', recordingDuration: 5, ... }
[SongSnap] Step 2: Starting audio recording...
[AudioRecorder] Platform: darwin
[AudioRecorder] Starting recording for 5 seconds
[AudioRecorder] Using macOS recording mode
[AudioRecorder] Executing command: sox -d -t wav "/tmp/songsnap-..." trim 0 5
```

## Common Errors and Solutions

### ❌ "Failed to load command User cancelled"

**Most Likely Cause:** Audio recording failed

**Debug Steps:**
1. Check the logs for `[AudioRecorder]` messages
2. Look for any error messages from ffmpeg or sox
3. Verify your microphone is working

**Solutions:**
- **macOS**: Check System Preferences → Security & Privacy → Microphone
- **Windows**: Check Settings → Privacy & Security → Microphone
- Try plugging in external microphone if available
- Restart Raycast

### ❌ "Failed to load command" with no specific error

**Most Likely Cause:** Preferences initialization error

**Debug Steps:**
1. Check `[Preferences]` logs
2. Look for validation errors
3. Check if service credentials are present

**Solutions:**
- Open SongSnap preferences (Cmd+, → SongSnap → Preferences)
- Verify recognition service is set to "Shazamio" (default)
- If using ACRCloud/AudD, verify API credentials

### ❌ "No matches found"

**Most Likely Cause:** Audio quality too low or wrong service

**Debug Steps:**
1. Check `[AudioRecorder]` for successful recording
2. Check `[ShazamioService]` for API response
3. Verify audio file size is reasonable (>1KB)

**Solutions:**
- Increase recording duration to 10 seconds
- Play music louder or closer to microphone
- Try ACRCloud for better accuracy (requires API key)

### ❌ "AudioRecordingError: Failed to record audio"

**Most Likely Cause:** ffmpeg/sox not installed or microphone access denied

**Debug Steps:**
1. Check `[AudioRecorder]` logs
2. Look for specific ffmpeg error message
3. Check platform detection

**Solutions:**
- **macOS**: Install ffmpeg via Homebrew: `brew install ffmpeg`
- **Windows**: Install ffmpeg from https://ffmpeg.org/download.html
- Grant microphone permissions to Raycast
- Restart computer

### ❌ "[ShazamioService] Recognition failed"

**Most Likely Cause:** API issue or no internet connection

**Debug Steps:**
1. Check `[ShazamioService]` logs for API error
2. Verify internet connection
3. Check audio fingerprint generation

**Solutions:**
- Check internet connectivity
- Try again in a few seconds
- Use ACRCloud if Shazamio is having issues
- Check if you're behind a proxy/firewall

## Log Message Breakdown

### Normal Successful Flow
```
[SongSnap] Command initialized, starting identification...
[SongSnap] Step 1: Getting preferences...
[Preferences] Loading preferences...
[Preferences] Loaded preferences: {...}
[Preferences] Validating preferences...
[Preferences] Validation passed
[SongSnap] Step 2: Starting audio recording...
[AudioRecorder] Starting recording for 5 seconds
[AudioRecorder] Platform: darwin
[AudioRecorder] Using macOS recording mode
[AudioRecorder] Executing command: sox -d -t wav "..." trim 0 5
[AudioRecorder] Recording completed, reading file...
[AudioRecorder] Audio file read successfully, size: 123456 bytes
[SongSnap] Step 3: Creating recognition service...
[ServiceFactory] Creating service for: shazamio
[ServiceFactory] Shazamio service created (default)
[SongSnap] Service created: shazamio
[SongSnap] Step 4: Sending audio to recognition service...
[ShazamioService] Starting recognition, audio buffer size: 123456
[ShazamioService] Sending to Shazamio API...
[ShazamioService] API response received
[ShazamioService] Match found, parsing response...
[ShazamioService] Song recognized: Bohemian Rhapsody by Queen
[SongSnap] Song recognized: {...}
[SongSnap] Step 5: Saving to history database...
[HistoryDatabase] Adding song to history: Bohemian Rhapsody by Queen
[HistoryDatabase] Entry added with ID: 550e8400-e29b-41d4-a716-446655440000
[HistoryDatabase] Saving 1 entries to disk...
[HistoryDatabase] Successfully saved to: /Users/username/.config/songsnap/history.json
[SongSnap] Song saved to history with ID: 550e8400...
[SongSnap] Identification complete!
```

### Windows-Specific Flow
```
[AudioRecorder] Platform: win32
[AudioRecorder] Using Windows recording mode
[AudioRecorder] Executing command: ffmpeg -f dshow -i audio="Microphone" -t 5 "..." -y
```

### Linux-Specific Flow
```
[AudioRecorder] Platform: linux
[AudioRecorder] Attempting pulse audio recording...
[AudioRecorder] Executing command: ffmpeg -f pulse -i default -t 5 "..." -y
```

## Platform-Specific Troubleshooting

### macOS Issues

**Issue**: "sox: command not found"
```bash
# Solution: Install sox and ffmpeg
brew install sox ffmpeg
```

**Issue**: Microphone permission denied
- System Preferences → Security & Privacy → Microphone
- Add Raycast to the list of apps with microphone access

### Windows Issues

**Issue**: ffmpeg not found
- Download from: https://ffmpeg.org/download.html
- Add to PATH environment variable
- Restart computer

**Issue**: "Microphone" device not found
- Try: Settings → Privacy & Security → Microphone
- Ensure microphone is set as default input device
- Update audio drivers

### Linux Issues

**Issue**: "pulse" audio not found
- Install pulseaudio: `sudo apt install pulseaudio`
- Or try ALSA (automatic fallback)

## Advanced Debugging

### Enable Verbose Mode (if supported)
```typescript
// Temporarily add to any file:
console.log("[DEBUG] Detailed information...");
```

### Copy Full Logs
1. Open Raycast extension log
2. Select all (Cmd+A or Ctrl+A)
3. Copy (Cmd+C or Ctrl+C)
4. Paste into text file for analysis

### Check History Database
Location: `~/.config/songsnap/history.json`

```bash
# macOS/Linux
cat ~/.config/songsnap/history.json | jq .

# Windows PowerShell
Get-Content "$env:USERPROFILE\.config\songsnap\history.json" | ConvertFrom-Json
```

## Reporting Issues

When reporting a bug, include:

1. **Full log output** from Raycast
2. **Your OS and version**: macOS 13.0, Windows 11, Ubuntu 22.04, etc.
3. **Steps to reproduce** the issue
4. **Screenshots** if possible
5. **Which recognition service** you're using
6. **Error messages** exactly as shown

## Performance Debugging

### Slow Recognition (> 10 seconds)

**Check log timing:**
```
[SongSnap] Step 2: Starting audio recording...    # T=0s
[AudioRecorder] Recording completed...            # T=5s
[SongSnap] Step 4: Sending audio...              # T=5s
[ShazamioService] API response received          # T=7s (should be < 2s after sending)
```

If API response is slow:
- Check internet connection speed
- Try ACRCloud for faster responses
- Check if Shazamio API is having issues

### Memory Usage

The extension keeps history in memory. If it's using too much RAM:
- Clear history: Delete `~/.config/songsnap/history.json`
- Extension will create fresh history file

## Getting Help

1. **Check the logs first** - Most issues have specific error messages
2. **Search existing issues** on GitHub
3. **Create a new issue** with full log output
4. **Join Discord** community for live help (if available)

---

**Remember**: Always check the logs first! 90% of issues can be diagnosed from the console output.
