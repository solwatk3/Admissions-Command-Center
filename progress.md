# ACC - Admissions Command Center
## Progress Tracker

---

## Done

- [x] Initial app scaffolding - HTML/CSS/JS, GitHub Pages deploy (2026-06-01)
- [x] School directory - county pills, school list, school detail modal (2026-06-01)
- [x] Map view - Leaflet.js with county polygons and school markers (2026-06-01)
- [x] Dashboard - primary schools card, overdue visits card, upcoming routes (2026-06-01)
- [x] Visits tracker - log visits per school, overdue flagging (2026-06-01)
- [x] Routes planner - build and sync routes to Google Calendar (2026-06-01)
- [x] Rolodex - colleague directory separate from school contacts (2026-06-01)
- [x] Backup / restore system - export JSON email, tap-to-restore via GitHub repo (2026-07-20)
- [x] Google Calendar sync fix - live counter, no more detached button reference (2026-07-20)
- [x] GitHub token setup UI - test connection, copy token, visible input (2026-07-20)
- [x] Priority Triage Mode - flip through schools and assign priorities in-modal (2026-07-21)
- [x] Map marker colors - purple/cyan/amber per priority level (2026-07-21)
- [x] Primary Schools dashboard card - collapsed by county with dropdown (2026-07-21)
- [x] Directory search - now finds both counties AND individual schools (2026-07-21)
- [x] By Priority view - new tab showing all schools of one priority, with Copy Emails (2026-07-21)
- [x] Auto-focus modal inputs - cursor lands in first field on any modal open (2026-07-21)
- [x] Print / Export system - 7 options: by priority tier, A-Z, by county, TN map (2026-07-21)
- [x] Map print - html2canvas capture, tighter TN crop, marker toggle (2026-07-21)
- [x] Map print timing fix - wait for tile load event instead of fixed timeout (2026-07-22)
- [x] Map print crop fix - resize container to TN aspect ratio before fitBounds (2026-07-22)
- [x] Map print controls fix - hide Leaflet zoom/layer buttons before capture (2026-07-22)
- [x] Schedule Visit (Planned Visits) - orange cards on school detail, calendar view, delete button (2026-08-09)
- [x] End time field on scheduled visits (2026-08-10)
- [x] Visit Report - date range report with presets (this week, this month, this year) and custom range (2026-08-10)
- [x] Planned visits added to archive snapshot and tap-to-restore backup export (2026-08-10)
- [x] Events - multi-school chip picker, tag multiple schools per event (2026-08-10)
- [x] Events - "Create Route" button to auto-build a route from an event's tagged schools (2026-08-10)
- [x] Route builder - "From Planned Visits" button, picks date range and builds stops from matching planned visits (2026-08-10)
- [x] Tentative Events - create unconfirmed events with host school + attending schools, confirm to convert to real event, amber color scheme (2026-08-10)
- [x] Tentative Events visible on school detail page with Hosting/Attending role badges (2026-08-10)
- [x] acc_tentative_events added to tap-to-restore backup export (2026-08-10)

---

## In Progress

- [ ] Nothing currently in progress

---

## Up Next

- [ ] Test Tentative Events end-to-end - create one, confirm it, verify it appears on school detail page and events page correctly
- [ ] Test Visit Report with real data - try each preset and a custom date range, verify school names and counts are correct
- [ ] Test tap-to-restore on Device B now that planned visits and tentative events are in the export

---

## Dead Ends

| What was tried | Why it failed | Date |
|---|---|---|
| Base64 snapshot in restore URL | URI too long error - URL limit exceeded | 2026-07-20 |
| Anonymous GitHub Gist for backup storage | Sol wanted their own repo instead | 2026-07-20 |
| `@media print` CSS to print Leaflet map | Cross-origin OSM tiles render blank in browser print | 2026-07-21 |
| `window.print()` directly after fitBounds for map | Same cross-origin tile issue - blank output | 2026-07-21 |
| Fixed 1.4s timeout before html2canvas map capture | Tiles not always loaded in time - replaced with tile load event | 2026-07-22 |
| Edge browser cache on Device B | Old cached JS didn't have planned visits rendering code - hard refresh fixed it | 2026-08-10 |
