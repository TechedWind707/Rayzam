# 📋 Finding Logs & Fixing Icon

## 🔍 Finding Raycast Log Files

### Where Are The Logs Located?

**macOS:**
```bash
# Raycast application logs
~/Library/Logs/Raycast/

# View real-time logs
tail -f ~/Library/Logs/Raycast/app.log

# View last 50 lines
tail -50 ~/Library/Logs/Raycast/app.log

# Search for SongSnap errors
grep -i "songsnap\|error" ~/Library/Logs/Raycast/app.log
```

**Windows:**
```powershell
# Raycast logs location
$env:APPDATA\Raycast\logs\

# View logs (PowerShell)
Get-Content "$env:APPDATA\Raycast\logs\app.log" -Tail 50

# Or in Explorer:
# C:\Users\[YourUsername]\AppData\Roaming\Raycast\logs\
```

**Linux:**
```bash
~/.local/share/raycast/logs/
```

### How to Access Logs in Raycast UI

1. **Open Raycast**
2. Press **Cmd+,** (macOS) or **Ctrl+,** (Windows)
3. Go to **Extensions**
4. Find **SongSnap - Shazam for Raycast**
5. Click on it
6. Click **Show Log** button
7. Logs display in real-time

## 🎨 Fixing the Icon Issue

### Why Icon Might Not Show

The icon file needs to be:
1. ✅ In the correct location (`assets/` folder)
2. ✅ Referenced correctly in `package.json`
3. ✅ In PNG format with proper dimensions
4. ✅ Raycast might need a reload

### Current Setup

**Icon file location:**
```
raycast-songsnap/assets/extension-icon.png  ✓ EXISTS
```

**Icon reference in package.json:**
```json
{
  "icon": "assets/extension-icon.png",
  "commands": [
    {
      "icon": "assets/extension-icon.png"
    }
  ]
}
```

### Fix Steps

**Step 1: Verify icon file exists**
```bash
ls -lh raycast-songsnap/assets/
# Should show: extension-icon.png
```

**Step 2: Check icon dimensions**
- Raycast recommends: **256x256 pixels** or larger
- Format: PNG with transparency
- Your icon appears to be correct size

**Step 3: Reload extension in Raycast**
- Open Raycast Preferences (Cmd+, / Ctrl+,)
- Go to Extensions
- Find SongSnap
- Click the **⟲ Reload** button (or similar)

**Step 4: If icon still doesn't show**

Try alternative icon reference:
```json
{
  "icon": "./assets/extension-icon.png"
}
```

Or try:
```json
{
  "icon": "icon.png"
}
```

And move the icon to the root folder:
```bash
cp raycast-songsnap/assets/extension-icon.png raycast-songsnap/icon.png
```

### Verify Icon Works

1. **In Launcher:** Type "Identify Song" - icon should appear next to it
2. **In Preferences:** Extensions tab should show the icon
3. **Command List:** Both commands should have the icon

## 📂 Complete Log & Asset Checklist

### Logs Checklist
- [ ] Found `~/Library/Logs/Raycast/` (macOS) or `%APPDATA%\Raycast\logs\` (Windows)
- [ ] Can view with `tail -f` or PowerShell `Get-Content`
- [ ] Can see logs in Raycast UI: Extensions → SongSnap → Show Log
- [ ] Logs show `[SongSnap]` prefix when running commands

### Icon Checklist
- [ ] Icon file exists: `assets/extension-icon.png`
- [ ] Icon is PNG format (256x256 or larger)
- [ ] Icon is referenced in `package.json` in both places:
  - [ ] `"icon": "assets/extension-icon.png"` (main)
  - [ ] `"icon": "assets/extension-icon.png"` (commands)
- [ ] Raycast extension reloaded
- [ ] Icon appears in Raycast launcher
- [ ] Icon appears in Extensions preferences

## 🔧 Troubleshooting Both Issues

### Logs Not Appearing in Show Log
```
Likely cause: 
- Extension isn't running (check if commands load)
- Wrong log file location
- Raycast cache issue

Solution:
1. Restart Raycast completely
2. Check command runs without errors
3. Look for [SongSnap] prefix in logs
4. Try different log file location
```

### Icon Not Showing in Launcher
```
Likely cause:
- Icon path incorrect in package.json
- Icon file missing or corrupted
- Raycast cache issue
- Icon needs to be reloaded

Solution:
1. Verify file exists: ls assets/extension-icon.png
2. Check package.json icon paths
3. Restart Raycast
4. Try "Show Log" to see if icon errors appear
5. Copy icon to root: cp assets/extension-icon.png icon.png
```

## 🚀 Quick Commands

### Find and tail logs (macOS)
```bash
# Real-time logs
tail -f ~/Library/Logs/Raycast/app.log

# Search for SongSnap
grep SongSnap ~/Library/Logs/Raycast/app.log

# Last 100 lines
tail -100 ~/Library/Logs/Raycast/app.log
```

### Check icon in Windows
```powershell
# Verify icon exists
Test-Path "$env:USERPROFILE\raycast-songsnap\assets\extension-icon.png"

# View logs
Get-Content "$env:APPDATA\Raycast\logs\app.log" -Tail 100
```

### Reload extension
```bash
# Restart Raycast completely
killall Raycast  # macOS
# or Ctrl+Alt+Delete → Task Manager → Raycast → End Task (Windows)

# Reopen Raycast
open -a Raycast  # macOS
```

## If Still Having Issues

1. **Collect diagnostic info:**
   ```bash
   # macOS
   ls -la ~/Library/Logs/Raycast/
   ls -la raycast-songsnap/assets/
   cat raycast-songsnap/package.json | grep -A 2 "icon"
   
   # Windows
   dir "$env:APPDATA\Raycast\logs\"
   dir raycast-songsnap\assets\
   ```

2. **Share these details:**
   - Full path to log file
   - Contents of `assets/` directory
   - Icon references from `package.json`
   - Any error messages in logs

3. **Check [DEBUGGING.md](./DEBUGGING.md) for more detailed troubleshooting**

---

**Pro Tip:** The easiest way to see logs is:
- **In Raycast:** Preferences → Extensions → SongSnap → Show Log (simplest!)
- Or watch logs live: `tail -f ~/Library/Logs/Raycast/app.log` (macOS)
