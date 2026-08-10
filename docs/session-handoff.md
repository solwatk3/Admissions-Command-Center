# ACC Session Handoff
**Date:** 2026-08-09
**Status:** Schedule Visit feature built and in code. Map print fixes from prior session pushed. Need end-to-end testing of both.

---

## What Was Built - Prior Session (2026-07-22)

### Map Print Fixes
Three fixes to the map print feature in `js/directory.js` - `printMap()` / `doCapture()`:
1. **Tile load timing** - replaced fixed setTimeout with a Leaflet tile `load` event listener + 200ms buffer + 6s fallback
2. **TN crop** - temporarily resizes map container to 900x300px before fitBounds so Tennessee fills the frame tightly, then restores original size
3. **Hide controls** - sets `visibility: hidden` on `.leaflet-control-container` before capture, restores after (in both success and catch paths)

---

## What Was Built - After That Session

### Schedule Visit (Planned Visits)
A way to plan a future visit to a school before it happens, separate from the Visit Log which records visits that already occurred.

**How it works:**
- "+ Schedule Visit" button appears on every school's detail page in the directory
- Clicking it opens a modal (via `openScheduleVisit(schoolId)` in `visits.js`) with the school pre-filled and locked
- Fields: title (optional), planned date (defaults to tomorrow), time (optional), notes/purpose
- On save, the record goes into `acc_planned_visits` in localStorage - completely separate from `acc_visits` so real visit history is never mixed with plans
- Planned visits render as orange cards directly on the school detail page (via `renderSchoolPlannedVisits()` in `directory.js`)
- Each planned visit card has an X button to delete it (`deletePlannedVisit()` in `visits.js`)
- Planned visits also appear on the calendar view as orange markers (color `#f97316`) alongside routes

**Key functions:**
| Function | File | What it does |
|---|---|---|
| `openScheduleVisit(schoolId)` | `visits.js` | Opens the schedule modal, pre-fills school if id passed |
| `getPlannedVisits()` | `visits.js` | Reads `acc_planned_visits` from localStorage |
| `savePlannedVisits(arr)` | `visits.js` | Writes `acc_planned_visits` to localStorage |
| `renderSchoolPlannedVisits(schoolId)` | `directory.js` | Renders orange planned visit cards on school detail page |
| `deletePlannedVisit(plannedId)` | `visits.js` | Removes one planned visit and re-renders directory |

**localStorage key:** `acc_planned_visits` - `[{id, schoolId, schoolName, title, date, time, notes}]`

---

## Key Variable / Function Names

| Name | File | What it does |
|---|---|---|
| `mapInstance` | `js/map.js` | The Leaflet map object - used in printMap() to iterate layers |
| `triageQueue` / `triageIndex` | `js/directory.js` | State for the current triage session |
| `activePriorityFilter` | `js/directory.js` | Which priority pill is active in the By Priority view |
| `primaryCountyOpen` | `js/app.js` | Tracks which county dropdowns are open on the dashboard |
| `openModal(title, body, onSave)` | `js/directory.js` | Pass `null` for onSave to hide the Save button |
| `getSchoolContacts(school)` | `js/directory.js` | Handles both legacy single-contact and new contacts array |
| `escapeHtml(str)` | `js/visits.js` | Always use on user data before inserting into innerHTML |

---

## Known Issues / Watch Points

- Map print resizes the container to 900x300 temporarily - if the user scrolls or interacts during the ~6s capture window the map may look odd. It snaps back after capture.
- html2canvas CDN loaded from cloudflare - if offline, map print will silently fail
- The secondary priority color was changed from cyan to green (#22c55e) - if the map marker color looks wrong, check `priorityColor` in map.js vs the CSS badge color
- `initDirectory()` must exist in directory.js - it's called by app.js every time the directory tab is opened
- Planned visits are NOT cleared by the season archive (archive only clears `acc_visits` and `acc_routes`) - decide if this is intentional

---

## Start Here Next Session

Test two things end-to-end:
1. **Schedule Visit** - open a school detail page, click "+ Schedule Visit", fill in a date and notes, save. Confirm the orange card appears below the school. Confirm the X button removes it. Confirm it shows up on the calendar view.
2. **Map Print** - run all 7 print options with real data. Map print should show tight TN crop with no zoom/layer controls visible.
