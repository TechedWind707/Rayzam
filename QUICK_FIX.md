# 🎵 Quick Fixes: Logs & Icon

## 🔍 **Where to Find Logs**

### Easiest Way (Raycast UI)
1. Open Raycast → Press **Cmd+,** (macOS) or **Ctrl+,** (Windows)
2. Go to **Extensions**
3. Click **SongSnap - Shazam for Raycast**
4. Click **Show Log** button
5. **Logs appear in real-time** ✓

### Direct File Location

**macOS:**
```bash
# View logs
tail -50 ~/Library/Logs/Raycast/app.log

# Watch live
tail -f ~/Library/Logs/Raycast/app.log
```

**Windows:**
```powershell
# View logs (PowerShell)
Get-Content "$env:APPDATA\Raycast\logs\app.log" -Tail 50

# Or in File Explorer:
# C:\Users\[YourUsername]\AppData\Roaming\Raycast\logs\
```

## 🎨 **Icon Not Showing - Quick Fixes**

### Fix 1: Reload the Extension
1. Open Raycast Preferences (Cmd+, / Ctrl+,)
2. Go to **Extensions**
3. Find **SongSnap**
4. Look for a **Reload** or **⟲** button and click it
5. Restart Raycast (Cmd+Q / Ctrl+Q, then reopen)

### Fix 2: Try Alternative Icon Paths
Edit `package.json` and try this instead:

```json
{
  "icon": "icon.png",
  ...
}
```

Then update both command icons:

```json
"commands": [
  {
    "name": "identify-song",
    "icon": "icon.png",
    ...
  },
  {
    "name": "song-history", 
    "icon": "icon.png",
    ...
  }
]
```

**Why this works:** Icon is now in root directory as `icon.png` (we already copied it there)

### Fix 3: Force Refresh Raycast
```bash
# macOS: Restart Raycast
killall Raycast
sleep 2
open -a Raycast

# Windows: In Task Manager
# Ctrl+Alt+Delete → Find Raycast → End Task
# Then reopen Raycast
```

## ✅ **Verify Setup**

### Check Icon File Exists
```bash
# Both of these should exist:
ls raycast-songsnap/assets/extension-icon.png
ls raycast-songsnap/icon.png
```

### Check package.json References
```bash
# Should see icon references
grep -n "icon" raycast-songsnap/package.json
```

### Check Logs for Icon Errors
```bash
# macOS
grep -i "icon\|image" ~/Library/Logs/Raycast/app.log

# Windows PowerShell
Get-Content "$env:APPDATA\Raycast\logs\app.log" | Select-String -Pattern "icon|image"
```

## 🚀 **If Still Not Working**

### Diagnostic Checklist
- [ ] Icon file exists: `ls assets/extension-icon.png`
- [ ] Icon in root exists: `ls icon.png`
- [ ] package.json updated with icon paths
- [ ] Dist folder rebuilt: `npx tsc`
- [ ] Raycast restarted completely
- [ ] Checked "Show Log" for error messages
- [ ] No permission issues on icon file

### Last Resort: Start Fresh

```bash
cd raycast-songsnap

# 1. Clean build
rm -rf dist

# 2. Rebuild
npx tsc

# 3. Restart Raycast completely
# macOS: killall Raycast && sleep 2 && open -a Raycast
# Windows: Close and reopen Raycast

# 4. Add to Raycast fresh
# Preferences → Extensions → + (Add Script Directory)
# Select the raycast-songsnap folder again
```

## 📝 **Log Reference**

### Successful Load Logs (What to Look For)
```
[SongSnap] Command initialized, starting identification...
[Preferences] Loading preferences...
[AudioRecorder] Platform: darwin (or win32)
[ShazamioService] Song recognized: Bohemian Rhapsody
[SongSnap] Identification complete!
```

### Error Logs (What Indicates Problems)
```
[AudioRecorder] ERROR
[ServiceFactory] Missing credentials
[HistoryDatabase] Failed to save
Connection refused
Permission denied
```

## 🎯 **Most Common Solutions**

| Problem | Solution |
|---------|----------|
| Can't find logs | Use Raycast UI: Extensions → SongSnap → Show Log |
| Icon not showing | Restart Raycast: `killall Raycast` then reopen |
| Logs empty | Extension hasn't run yet; try "Identify Song" command |
| Icon path error | Update package.json to use `"icon": "icon.png"` |
| Everything broken | Run: `rm -rf dist && npx tsc && killall Raycast` |

---

**Quick summary:**
- **Logs:** Raycast Preferences → Extensions → SongSnap → Show Log
- **Icon:** Already set up, just restart Raycast if not showing
- **If still issues:** See [LOG_AND_ICON_GUIDE.md](./LOG_AND_ICON_GUIDE.md) for detailed troubleshooting
