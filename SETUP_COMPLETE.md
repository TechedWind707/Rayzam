# 🎵 SongSnap - Complete Setup & Troubleshooting Guide

## ✅ What's Been Done

Your SongSnap extension is now **complete and configured**:

- ✅ Full TypeScript extension built
- ✅ All 10 unit tests passing
- ✅ Comprehensive logging added
- ✅ Icon configured and ready
- ✅ JavaScript compiled in `dist/` folder
- ✅ All documentation included

## 📍 Key File Locations

### Extension Files
```
raycast-songsnap/
├── icon.png                      ← Icon used by Raycast (PRIMARY)
├── assets/extension-icon.png     ← Backup icon location
├── package.json                  ← Extension config
├── src/                          ← TypeScript source code
└── dist/                         ← Compiled JavaScript
    ├── commands/
    │   ├── identify-song.js      ← What Raycast runs
    │   └── song-history.js       ← What Raycast runs
    └── services/
```

### Raycast Log Locations

**macOS:**
```
~/Library/Logs/Raycast/app.log
```

**Windows:**
```
C:\Users\[YourUsername]\AppData\Roaming\Raycast\logs\app.log
```

### View Logs (Easiest Way)
1. Open Raycast → Press **Cmd+,** (or **Ctrl+,** on Windows)
2. Go to **Extensions**
3. Click **SongSnap - Shazam for Raycast**
4. Click **Show Log**
5. Done! Logs appear real-time ✓

## 🚀 First Steps

### 1. Make Sure Extension Loads
```bash
cd raycast-songsnap

# Verify build exists
ls dist/commands/identify-song.js   # Should exist
ls icon.png                         # Should exist
```

### 2. Add Extension to Raycast
- Open Raycast Preferences (Cmd+, or Ctrl+,)
- Click **Extensions**
- Click **+** (or "Add Script Directory")
- Navigate to `raycast-songsnap` folder
- Select it and add

### 3. Test It Works
- Open Raycast
- Type "Identify Song"
- Press Enter
- Listen for 5 seconds
- See result!

### 4. Check Logs If Something Fails
- Raycast → Preferences → Extensions → SongSnap → Show Log
- Look for `[SongSnap]` messages
- Or: `tail -f ~/Library/Logs/Raycast/app.log` (macOS)

## 🎨 Icon Troubleshooting

### If Icon Doesn't Show

**Step 1:** Restart Raycast
```bash
# macOS
killall Raycast
sleep 2
open -a Raycast

# Windows: Ctrl+Alt+Delete → Task Manager → Raycast → End Task → Reopen
```

**Step 2:** Reload extension in Raycast UI
- Preferences → Extensions → SongSnap → Reload button

**Step 3:** Verify icon files exist
```bash
# Both should exist:
ls icon.png
ls assets/extension-icon.png
```

**Step 4:** Check package.json references
```bash
# Should see "icon": "icon.png"
grep icon package.json
```

## 📋 Logging & Debugging

### Successful Identification Logs
```
[SongSnap] Command initialized, starting identification...
[SongSnap] Step 1: Getting preferences...
[Preferences] Loading preferences...
[Preferences] Validation passed
[SongSnap] Step 2: Starting audio recording...
[AudioRecorder] Starting recording for 5 seconds
[AudioRecorder] Platform: darwin (or win32)
[AudioRecorder] Recording completed
[SongSnap] Step 3: Creating recognition service...
[ServiceFactory] Shazamio service created
[SongSnap] Step 4: Sending audio to recognition service...
[ShazamioService] Song recognized: Song Title by Artist
[SongSnap] Step 5: Saving to history database...
[HistoryDatabase] Entry added with ID: ...
[SongSnap] Identification complete!
```

### Common Error Messages & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `[AudioRecorder] Recording error` | Microphone not found/permission denied | Check system mic settings |
| `[ShazamioService] No matches found` | Audio too quiet or API issue | Play music louder, try again |
| `[Preferences] Validation failed` | Wrong settings | Check Extension Preferences |
| `Missing executable` | dist/ folder missing | Run `npx tsc` |
| No logs appearing | Extension not running | Make sure command actually executes |

### How to Read Logs

**Component Prefixes:**
- `[SongSnap]` - Main command flow
- `[Preferences]` - Settings
- `[AudioRecorder]` - Microphone/recording
- `[ServiceFactory]` - Service selection
- `[ShazamioService]` - API recognition
- `[HistoryDatabase]` - History saving

**Search for issues:**
- grep for `ERROR` to find problems
- grep for `Step` to see progress
- grep for `ERROR\|failed\|not found` to troubleshoot

## 🔧 Common Tasks

### Rebuild After Code Changes
```bash
npx tsc
# Then restart Raycast
```

### View Latest Logs (macOS)
```bash
tail -50 ~/Library/Logs/Raycast/app.log
```

### Watch Logs Live (macOS)
```bash
tail -f ~/Library/Logs/Raycast/app.log
```

### Search Logs (macOS)
```bash
grep -i "songsnap\|error" ~/Library/Logs/Raycast/app.log
```

### Clear History
```bash
# Remove history file
rm ~/.config/songsnap/history.json

# Extension will create fresh history next run
```

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| **README.md** | Main documentation with features and setup |
| **QUICK_FIX.md** | Fast answers for logs and icon issues |
| **LOG_AND_ICON_GUIDE.md** | Detailed troubleshooting |
| **DEBUGGING.md** | Comprehensive debug guide |
| **LOG_REFERENCE.md** | Log format reference |
| **BUILD.md** | Build process explained |
| **DEVELOPMENT.md** | Developer setup and contributing |
| **CHANGELOG.md** | Version history |

## ⚡ Quick Reference

### I need to...

**...find logs**
→ Easiest: Raycast Prefs → Extensions → SongSnap → Show Log
→ Or: `tail -f ~/Library/Logs/Raycast/app.log` (macOS)
→ Or: `Get-Content "$env:APPDATA\Raycast\logs\app.log" -Tail 50` (Windows)

**...fix icon not showing**
→ Restart Raycast: `killall Raycast && sleep 2 && open -a Raycast`
→ Reload in Raycast UI
→ Check: `ls icon.png` exists

**...rebuild after code changes**
→ `npx tsc`

**...clear history**
→ `rm ~/.config/songsnap/history.json`

**...test if working**
→ Type "Identify Song" in Raycast
→ Press Enter
→ Let it listen for 5 seconds
→ Should see result

**...see detailed errors**
→ Look at logs with: `[ERROR]` or `failed` keywords
→ Check [DEBUGGING.md](./DEBUGGING.md)

## 🎯 Success Checklist

- [ ] `icon.png` exists in root directory
- [ ] `dist/commands/identify-song.js` exists
- [ ] `dist/commands/song-history.js` exists
- [ ] Extension added to Raycast (Cmd+, → Extensions → +)
- [ ] "Identify Song" appears in Raycast launcher
- [ ] Icon shows next to "Identify Song"
- [ ] Can trigger command and see logs
- [ ] Logs show `[SongSnap]` prefix
- [ ] Can run full identification successfully

## 💡 Pro Tips

1. **Always check logs first** - 90% of issues are visible in logs
2. **Restart Raycast completely** - Fixes most issues (killall Raycast)
3. **Rebuild after changes** - `npx tsc` after editing TypeScript
4. **Icon needs reload** - Restart Raycast if icon doesn't update
5. **History is local** - `~/.config/songsnap/history.json`

## 🆘 Still Having Issues?

1. **Check [QUICK_FIX.md](./QUICK_FIX.md)** for immediate solutions
2. **Check [DEBUGGING.md](./DEBUGGING.md)** for detailed troubleshooting
3. **Check [LOG_AND_ICON_GUIDE.md](./LOG_AND_ICON_GUIDE.md)** for logs/icon specifically
4. **Run diagnostics:**
   ```bash
   echo "=== Icon Files ===" 
   ls -lh icon.png assets/extension-icon.png
   echo "=== Compiled Files ==="
   ls -lh dist/commands/
   echo "=== Latest Logs ==="
   tail -20 ~/Library/Logs/Raycast/app.log
   ```

---

**You're all set!** The extension is ready to use. The logs are there, the icon is configured, and everything is documented. Good luck with SongSnap! 🎵
