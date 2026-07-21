# ACC - Admissions Command Center

A personal web app for managing school admissions work across Tennessee. Built for Sol - tracks school visits, routes, events, and colleagues in one place. No student personal information is stored anywhere.

Hosted on GitHub Pages. No backend, no login, no frameworks - just HTML, CSS, and JavaScript.

---

## What It Does

- **School Directory** - All schools organized by county and region, with contacts, priority levels, and visit history. Includes a Leaflet map view with color-coded markers.
- **Visit Log** - Log every school visit with mood, student count, notes, and a return-visit flag. Searchable and filterable by date, school, and mood.
- **Route Planner** - Build multi-stop driving routes, generate Google/Apple Maps links, print itineraries, and email routes. Multi-day routes supported.
- **Events** - Track fairs, conferences, and other boss-assigned events. Supports multi-day date ranges.
- **Calendar** - Monthly grid view showing visits, routes, and events together. Supports drag-to-select for quick date-range entry. Syncs routes and events to Google Calendar.
- **Colleague Rolodex** - Contact list for other admissions reps met on the road.
- **Dashboard** - Upcoming visits, overdue schools, next events, and season stats at a glance.

---

## Tech Stack

- Plain HTML, CSS, JavaScript - no build tools, no frameworks
- Data stored in browser `localStorage` (all keys prefixed `acc_`)
- [Leaflet.js](https://leafletjs.com/) for the school map, Nominatim for geocoding
- Google Calendar sync via Google Identity Services (OAuth token in memory only)
- EmailJS for sending route emails without a backend
- GitHub Pages for hosting

---

## File Structure

```
ACC/
  index.html          - App shell; all pages are <section> tags toggled by JS
  css/
    style.css         - Global theme, top bar, sidebar, dashboard, modals
    calendar.css      - Calendar grid and agenda styles
    directory.css     - School Directory styles
    visits.css        - Visit Log styles
    routes.css        - Route Planner styles
    events.css        - Events page styles
    rolodex.css       - Colleague Rolodex styles
    map.css           - Map view styles
  js/
    app.js            - Navigation, localStorage helpers, dashboard, calendar grid,
                        global search, backup/restore, season archive
    calendar.js       - Google Calendar OAuth, event sync
    directory.js      - School Directory (counties, schools, contacts, map markers)
    visits.js         - Visit Log (log, edit, search, filter, voice memo)
    events.js         - Events (add, edit, delete, multi-day support)
    routes.js         - Route Planner (build, duplicate, print, email, sync)
    map.js            - Leaflet map, geocoding, pin management
    rolodex.js        - Colleague Rolodex
  docs/
    memory.md         - Developer notes and session handoff docs
  backups/
    latest.json       - Most recent data backup (auto-saved on export)
```

---

## Design

- Black background (`#0d0d0d`) with purple accents (`#9b30ff`)
- Dark cards (`#1a1a1a`) with purple borders (`#4a2e6a`)
- Mobile-first - works on phone and desktop

---

## Data and Backup

All data lives in `localStorage` and is per-device. Use the **Export Data** button on the Dashboard to download a full JSON backup. Use **Import Data** to restore on a new device.

The app nudges you to back up if it has been more than 14 days since the last export.

---

## Google Calendar Sync

Connect under the Calendar page. The app only reads and writes to a calendar named **"Admissions Work"** - it never touches your personal calendar. Routes and events sync as all-day events. The OAuth token is never stored to disk.

---

## Season Archive

At the end of a recruiting season, use **Archive Season** on the Dashboard to snapshot all visits and routes under a season name, then clear them for a fresh start. The School Directory and Rolodex carry over. Past seasons can be downloaded from the **Past Seasons** button.
