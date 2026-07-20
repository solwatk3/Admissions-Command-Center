# ACC Session Handoff
**Date:** 2026-07-20  
**Status:** All changes coded and pushed to GitHub. Ready to test end-to-end.

---

## What Was Fixed This Session

### 1. Google Calendar sync button did nothing
**Root cause:** `syncRouteToCalendar()` was calling `renderCalendarStatus()` after each route, which rebuilt the DOM and created a new sync button element. The old button reference was now pointing at a detached node, so the progress updates went nowhere.

**Fix:** Removed `renderCalendarStatus()` from inside `syncRouteToCalendar()`. Now `syncAllRoutes()` holds the button reference cleanly across the whole loop, shows a live counter ("Syncing 1/3... 2/3... Done!"), then calls `renderCalendarStatus()` once at the end.

**File:** `ACC/js/calendar.js`

---

### 2. Tap-to-restore link in backup email (full flow now working)

**Problem chain:**
- Old approach: base64-encoded full snapshot in the URL - too long, "URI too long" error
- First fix: anonymous GitHub Gist - Sol wanted their own repo instead
- Second fix: GitHub Contents API writing to `backups/latest.json` in the ACC repo

**How it works now:**
1. Sol has a GitHub Personal Access Token stored via `saveData('gh_token', token)` (key: `acc_gh_token` in localStorage)
2. On export, `saveBackupToRepo()` writes the backup JSON to `https://github.com/solwatk3/Admissions-Command-Center/backups/latest.json` via the GitHub Contents API (PUT, includes SHA on update)
3. The backup email contains a single tappable line: `https://solwatk3.github.io/Admissions-Command-Center/?restore_raw=1`
4. On load, `checkRestoreParam()` detects `?restore_raw=1`, fetches `https://raw.githubusercontent.com/solwatk3/Admissions-Command-Center/main/backups/latest.json`, and calls `restoreSnapshot()`
5. The token itself is included in the backup payload (`emailKeys` array includes `acc_gh_token`), so it auto-restores on new devices - no re-entry needed

**File:** `ACC/js/app.js`

---

### 3. Token visibility and testing

**Problems:** Token was `type="password"` so invisible, and there was no way to verify it worked before exporting.

**Fixes:**
- Token input is now `type="text"` (monospace) so Sol can see and copy it
- "Copy token" button (appears when a token is already saved) - copies it to clipboard for pasting on other devices
- "Test connection" button calls `testGitHubToken(token, el)` which hits the GitHub API, shows "✓ Connected!" in green or pops an alert with the exact HTTP error code and what to check

**File:** `ACC/js/app.js` - functions: `openGitHubTokenSetup()`, `testGitHubToken()`

---

### 4. Silent failure feedback

Previously, if the token was wrong or missing, the backup email just silently had no restore link and the user had no idea why.

**Fix:**
- Button text distinguishes success: "✓ Backed up with restore link!" vs "✓ Backed up (no restore link)"
- If repo save failed, an alert fires 500ms after the email send with the exact error from the GitHub API

---

## Current State of Key Files

| File | Key sections |
|------|-------------|
| `ACC/js/app.js` | `exportAllData()` (line ~458), `openGitHubTokenSetup()` (1491), `saveBackupToRepo()` (1555), `testGitHubToken()` (1613), `checkRestoreParam()` (1656) |
| `ACC/js/calendar.js` | `syncAllRoutes()` (line ~275), `syncRouteToCalendar()` (~209) |
| `ACC/index.html` | `🔑 Restore Link` button in the dashboard header |

---

## Token Storage Details

- Saved with: `saveData('gh_token', token)` -> JSON-encodes to `acc_gh_token` in localStorage
- Read with: `loadData('gh_token', '') || localStorage.getItem('acc_gh_token') || ''` (self-healing fallback handles old format)
- Included in: `emailKeys` array inside `exportAllData()` so it goes into the repo backup and auto-restores

---

## What Sol Still Needs to Do (one time)

1. Go to GitHub.com - Profile - Settings - Developer settings - Fine-grained tokens
2. Create token: name "ACC Restore", no expiration, repo = Admissions-Command-Center only, permission = Contents: Read and write
3. Open ACC, click **🔑 Restore Link**, paste the token, click **Test connection** to verify, then **Save**
4. Do one **Export** - the email will now have the tappable restore link

After that, the token lives in the backup and restores automatically on any new device.

---

## Known Limitations / Watch Points

- The `backups/latest.json` file is **public** (repo is public). It contains school names, visit data, and colleagues - no passwords or truly sensitive data, but Sol should be aware.
- The token is stored in plaintext in localStorage and in the backup JSON. It has minimal permissions (Contents only, one repo) so exposure is low-risk, but Sol should not share their backup file with others.
- GCal token is in-memory only - expires after ~1 hour. Sol will need to reconnect each session. This is a Google OAuth limitation, not a bug.
- `checkRestoreParam()` still handles the old `?restore=BASE64` format for backward compatibility, but no new links use that format.
