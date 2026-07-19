# ACC - Admissions Command Center
## Project Memory

Last updated: 2026-07-18

---

## What This App Is
A personal web-based tool for Sol, an admissions counselor covering Tennessee. It serves as a second brain for school visit work. No student personal information is stored anywhere in this app.

---

## Tech Stack
- Plain HTML, CSS, JavaScript - no frameworks, no build tools
- All data stored in browser localStorage (key prefix: `acc_`)
- Hosted as static files - opened directly in browser (GitHub Pages planned)
- Leaflet.js for the school map view, Nominatim for geocoding
- Google Calendar integration (read-only sync, "Admissions Work" calendar only)
- EmailJS for sending route emails without a backend

---

## File Structure
```
ACC/
  index.html             - Main app shell, all pages live here as <section> tags
  css/
    style.css            - Global styles, color theme, top bar, sidebar, dashboard, modals
    directory.css        - School Directory styles (county pills, region view, school detail)
    visits.css           - Visit Log styles (cards, detail, voice memo, filter panel)
    rolodex.css          - Colleague Rolodex styles
    routes.css           - Route Planner styles
    map.css              - Map view styles
    calendar.css         - Google Calendar card styles
  js/
    app.js               - Navigation, localStorage helpers, dashboard stats, global search,
                           season archive, overdue schools card, export/import
    directory.js         - School Directory (county pills, region view, school detail,
                           add/edit/delete counties and schools, openModal)
    visits.js            - Visit Log (list, detail, log form, edit form, search, filters,
                           voice memo via Web Speech API)
    rolodex.js           - Colleague Rolodex
    routes.js            - Route Planner (build, detail, print, email via EmailJS)
    map.js               - Leaflet map view, geocoding, tab switching
    calendar.js          - Google Calendar OAuth and event display
  docs/
    memory.md            - This file
```

---

## Design
- Color theme: black background (`#0d0d0d`), purple accents (`#9b30ff`), white text
- Top bar: dark purple-black (`#110011`) with purple glow
- Cards/surfaces: dark (`#1a1a1a`) with purple borders (`#4a2e6a`)
- County/school pill aesthetic: `border-radius: 30px`, circular avatar with initials, count badge
- Mobile-first responsive - works on phone and PC

---

## Features Built

### Dashboard
- Upcoming Visits card - pulls from Google Calendar if connected
- Return Visits Flagged card - schools from Visit Log with `returnVisit: true`
- Overdue Schools card - Primary schools not visited in 60+ days, grouped by county with collapsible dropdowns, max-height scroll, "View School Directory" footer link
- Season Snapshot card - live counts of schools, visits, colleagues
- Primary Schools quick-access section - auto-populated from Directory
- Export Data / Import Data buttons - full JSON backup/restore; import only restores keys starting with `acc_`
- Last-backup nudge next to the export buttons - shows days since last export, turns orange after 14 days or if no backup exists
- Archive Season button - saves visits + routes under a named season label, clears them for a fresh start
- Past Seasons button - lists archived seasons with download links

### School Directory
Three tabs: A-Z Counties (default), Map, By Region

**A-Z Counties tab**
- County pills sorted A-Z with circular avatar, school count badge, region tag
- Click pill to open county's school list
- Hover popup shows county details
- Search bar filters county pills in real time

**By Region tab**
- Tennessee regions: West TN, Middle TN, East TN (set per county)
- Counties nested within regions, schools nested within counties
- Regions and counties are independently collapsible
- Search auto-expands matching items
- Collapse state persists during a session (`regionOpenState`, `countyOpenState`)

**Map tab**
- Leaflet map with colored markers by priority (Primary=purple, Secondary=indigo, Tertiary=gray)
- Approximate locations shown in orange
- Resync Map button re-geocodes all addresses

**Schools**
- Fields: name, address (street/city/zip), priority (Primary/Secondary/Tertiary), contact name, contact email, contact phone, notes
- Visit stats bar on detail page: total visits, last visit date, days since (red if overdue)
- Visit history list on detail page
- Edit and Delete buttons on detail page
- Duplicate school prevention (same name within same county is blocked)

**Counties**
- Fields: name, region (West/Middle/East TN), notes
- Duplicate county name prevention (case-insensitive)
- Cannot delete a county that still has schools

### Visit Log
- Log a Visit form: school (searchable dropdown), title (optional), date, mood (Great/Good/Okay/Tough), student count, most asked questions, new questions, notes for next time, promo materials count, return visit flag
- Voice memo (microphone button) on each textarea - uses Web Speech API
- Edit and Delete on detail view
- Visits grouped by month, most recent first
- Text search across school name, title, and all notes fields
- Filter panel (toggled by Filters button): school dropdown, mood, date from, date to, return-flagged-only checkbox
- Filters and search combine; reset on navigate away

### Colleague Rolodex
- Add/edit/delete colleagues
- Fields: name, institution, email, phone, notes
- Search by name or institution

### Route Planner
- Build routes with multiple school stops or custom stops (hotel, lunch, fair venue)
- Each stop has an editable address, start time, and end time
- Stops sorted by start time on save; reorder and remove in the builder
- Duplicate route - clones stops and origin, leaves date blank
- Generate Google Maps directions link (Apple Maps on iPhone/iPad)
- Starting point defaults to DEFAULT_ORIGIN (Sol's office, defined once in app.js)
- Print one or many routes as a styled itinerary with a date-range picker
- Email routes via EmailJS (Sol's public key configured)
- 48-hour reminder banner on the route list, dismissible per route
- Saved routes sync to Google Calendar when connected

### Global Search (top bar)
- Magnifier button in top bar opens a slide-down search panel
- Keyboard shortcut: Ctrl+K
- Searches schools, visits, and colleagues simultaneously
- Clickable results navigate directly to the item
- Press Escape or X to close

### Google Calendar
- OAuth via Google Identity Services
- Reads "Admissions Work" calendar only - never touches personal calendar
- Upcoming events shown on dashboard

---

## localStorage Keys

| Key | Contents |
|---|---|
| `acc_counties` | `[{id, name, notes, region}]` - region is "West TN", "Middle TN", or "East TN" |
| `acc_schools` | `[{id, countyId, name, address, priority, contact, contactEmail, contactPhone, notes}]` |
| `acc_visits` | `[{id, schoolId, schoolName, title, date, mood, studentCount, commonQuestions, newQuestions, nextTimeNotes, promoCount, returnVisit}]` |
| `acc_colleagues` | `[{id, name, institution, email, phone, notes}]` |
| `acc_routes` | `[{id, name, date, origin, stops, reminderDismissed, createdAt}]` - stop: `{id, type, schoolId?, name, address, startTime?, endTime?}` |
| `acc_archives` | `[{id, name, archivedOn, visits, routes}]` - season archive snapshots |
| `acc_geo_cache` | Address -> `{lat, lng, fallback?, manual?}` geocode cache (manual = user dragged the pin) |
| `acc_gcal_connected` | Whether Google Calendar was connected |
| `acc_gcal_calendar_id` | ID of the "Admissions Work" calendar |
| `acc_gcal_event_map` | Route ID -> Calendar event ID |
| `acc_gcal_last_sync` | ISO timestamp of last calendar sync |
| `acc_last_backup` | ISO timestamp of last data export (powers the backup nudge) |

---

## Key Code Patterns

**Data helpers** (app.js)
```js
loadData('schools', [])     // reads acc_schools from localStorage
saveData('schools', arr)    // writes acc_schools to localStorage
```

**ID generation** (directory.js)
```js
makeId()  // timestamp + random string
```

**Modal** (directory.js)
```js
openModal(title, bodyHtml, onSave)
// onSave: null hides the Save button (view-only modal)
closeModal()
```

**HTML escaping** (visits.js)
```js
escapeHtml(str)  // covers & < > " and '
```
Rule: ALL user-entered text (names, notes, titles, addresses, contacts) must pass
through escapeHtml before being placed in innerHTML or value="" attributes.
Exception: plain-text contexts (alert, confirm, email bodies) stay unescaped.

**Shared constants** (app.js - loads first, so available everywhere)
```js
DEFAULT_ORIGIN  // Sol's office address, default route starting point
```

**Date offset fix** - localStorage dates are UTC midnight strings; always offset when computing days:
```js
new Date(d.getTime() + d.getTimezoneOffset() * 60000)
```

**Overdue threshold** - 60 days for Primary schools

---

## Key Decisions Made
- No student personal information stored anywhere
- Driving only - no flight logistics
- Google Calendar: dedicated "Admissions Work" calendar only - never personal events
- Priority levels: Primary, Secondary, Tertiary (fixed, not custom)
- Return visit flag is within the same season
- One contact person per school
- Colleague Rolodex is separate from School Directory
- Season archive clears visits and routes but keeps school directory and colleagues
- Import only restores `acc_` keys - unexpected keys in a backup file are ignored
- localStorage is per-device - Export/Import is the bridge between devices

---

## GitHub
- Repo exists; push requires Sol's explicit go-ahead
- Will be hosted via GitHub Pages for access from any device
