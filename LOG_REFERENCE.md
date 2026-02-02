# 📋 Quick Log Reference - SongSnap

## How to View Logs

### In Raycast (Easiest)
1. Open Raycast Preferences: **Cmd+,** (macOS) or **Ctrl+,** (Windows)
2. Go to **Extensions**
3. Click on **SongSnap**
4. Click **Show Log**
5. Logs appear in real-time as you use the extension

## Log Component Prefixes

| Component | Prefix | What It Shows |
|-----------|--------|---------------|
| Main Command | `[SongSnap]` | Overall flow and steps |
| Preferences | `[Preferences]` | Settings loading and validation |
| Audio Recording | `[AudioRecorder]` | Microphone and audio capture |
| Service Factory | `[ServiceFactory]` | Which API service is being used |
| Shazamio API | `[ShazamioService]` | Music recognition API calls |
| History Database | `[HistoryDatabase]` | Song history saving |

## Quick Diagnosis

### Copy this table to reference while debugging:

```
✅ WORKING: Audio recording starts
   [AudioRecorder] Starting recording for 5 seconds
   [AudioRecorder] Platform: darwin (or win32, linux)

✅ WORKING: Service selection
   [ServiceFactory] Creating service for: shazamio
   [ServiceFactory] Shazamio service created

✅ WORKING: Recognition
   [ShazamioService] Song recognized: Bohemian Rhapsody

✅ WORKING: Save to history
   [HistoryDatabase] Entry added with ID: ...
   [HistoryDatabase] Successfully saved to: ...

❌ ERROR: Can't access microphone
   [AudioRecorder] Recording error: ...

❌ ERROR: Wrong settings
   [Preferences] Validation failed: Recording duration must be between 3 and 15 seconds

❌ ERROR: API issue
   [ShazamioService] Recognition failed: No matches found
```

## Search Tips

### Look for these to confirm success:
- `"Starting identification"` - Command started
- `"Validation passed"` - Settings are correct
- `"Audio file read successfully"` - Recording worked
- `"Song recognized"` - Match found
- `"Entry added"` - History saved
- `"Identification complete!"` - All done

### Look for these to find errors:
- `"ERROR"` - Something went wrong
- `"failed"` or `"Failed"` - Operation didn't work
- `"not found"` - Missing file or device
- `"No matches"` - Audio too quiet or wrong
- `"Validation failed"` - Bad settings

## Typical Success Logs (Copy-Paste Template)

```log
[SongSnap] Command initialized, starting identification...
[SongSnap] Step 1: Getting preferences...
[Preferences] Loading preferences...
[Preferences] Loaded preferences: { recognitionService: 'shazamio', recordingDuration: 5, ... }
[SongSnap] Step 2: Starting audio recording...
[AudioRecorder] Platform: darwin
[AudioRecorder] Starting recording for 5 seconds
[AudioRecorder] Using macOS recording mode
[AudioRecorder] Recording completed
[AudioRecorder] Audio file read successfully, size: 123456 bytes
[SongSnap] Step 3: Creating recognition service...
[ServiceFactory] Creating service for: shazamio
[ServiceFactory] Shazamio service created (default)
[SongSnap] Step 4: Sending audio to recognition service...
[ShazamioService] Starting recognition
[ShazamioService] API response received
[ShazamioService] Song recognized: Bohemian Rhapsody by Queen
[SongSnap] Step 5: Saving to history database...
[HistoryDatabase] Adding song to history
[HistoryDatabase] Successfully saved to: ~/.config/songsnap/history.json
[SongSnap] Identification complete!
```

## Where to Check Next

| Issue | Check Logs For |
|-------|--------|
| Microphone not found | `[AudioRecorder]` → look for ffmpeg/sox errors |
| No song matches | `[ShazamioService]` → look for "No matches found" |
| Settings wrong | `[Preferences]` → look for "Validation failed" |
| API error | `[ShazamioService]` → look for "Recognition failed" |
| Won't save | `[HistoryDatabase]` → look for "Failed to save" |
| Slow response | Check timing between `Step 4` and results |

## Copy Logs for Debugging

**macOS/Linux Terminal:**
```bash
# Get last 50 lines of Raycast logs
tail -50 ~/Library/Logs/Raycast/app.log
```

**Windows PowerShell:**
```powershell
# Get last 50 lines of extension log
Get-Content "$env:APPDATA\Raycast\app.log" -Tail 50
```

## Still Stuck?

1. ✅ Check the "Typical Success Logs" above to see where the flow breaks
2. ✅ Search for `ERROR` or `failed` in the logs
3. ✅ See **[DEBUGGING.md](./DEBUGGING.md)** for detailed solutions
4. ✅ Check each step's expected output:
   - Getting preferences ✓
   - Recording audio ✓
   - Creating service ✓
   - Recognizing song ✓
   - Saving to history ✓

---

**Pro Tip**: Filter logs by component name:
- Search for `[AudioRecorder]` to see only recording-related logs
- Search for `[ShazamioService]` to see only API calls
- Search for `ERROR` to see only errors
