# ACC - Admissions Command Center
## Project Memory

---

## What This App Is
A personal web-based tool for Sol, an admissions counselor covering East TN, Crockett, Montgomery, and Gibson County (TN). It serves as a second brain for work - no student personal information is stored anywhere in this app.

---

## Tech Stack
- Plain HTML, CSS, JavaScript - no frameworks, no build tools
- All data stored in browser localStorage (key prefix: `acc_`)
- Hosted as static files - opened directly in browser for now, GitHub Pages planned
- Google Calendar integration planned (dedicated "Admissions Work" calendar only)

---

## File Structure
```
ACC/
  index.html          - Main app shell, all pages live here
  css/
    style.css         - Global styles, color theme, layout
    directory.css     - School Directory and modal styles
  js/
    app.js            - Navigation, localStorage helpers, dashboard stats
    directory.js      - School Directory logic (counties, schools, search)
  docs/
    memory.md         - This file
```

---

## Design
- Color theme: black background (`#0d0d0d`), purple accents (`#9b30ff`), white text
- Top bar: dark purple-black (`#110011`) with purple glow
- Cards/surfaces: dark (`#1a1a1a`) with purple borders
- Mobile-first responsive - works on phone and PC equally

---

## Features Built So Far

### Dashboard
- Upcoming Visits card (placeholder - connects to Calendar later)
- Return Visits Flagged card (populated from Visit Log)
- Season Snapshot card (live counts of schools, visits, colleagues)
- Primary Schools quick-access section at the bottom - auto-populated from Directory

### School Directory
- Counties displayed in a 4-column grid
- Each county is collapsible - click header to expand/collapse
- Expand All / Collapse All buttons
- Search bar filters by county name or school name, auto-expands matches
- Counties have: name, notes (e.g. housing rule exemptions), edit, delete
- Schools have: name, address, priority (Primary/Secondary/Tertiary), contact name, contact email, contact phone
- Priority badges: purple = Primary, green = Secondary, yellow = Tertiary
- Default counties: East TN, Crockett, Montgomery, Gibson
- Counties are expandable - user can add new ones anytime
- Cannot delete a county that still has schools in it

---

## Features To Build Next
- [ ] Colleague Rolodex - name, institution, contact info for other counselors
- [ ] Visit Log - post-visit notes per school (quality, student count, common questions, new questions, next-time notes, promo materials, return visit flag)
- [ ] Route Planner - pick stops, get optimal driving order, Google Maps link, 48-hour reminder
- [ ] Google Calendar two-way sync - dedicated "Admissions Work" calendar only
- [ ] Mobile layout polish

---

## Key Decisions Made
- No student personal information stored anywhere
- Driving only - no flight logistics needed
- Google Calendar: dedicated separate calendar called "Admissions Work" - app never touches personal calendar events
- Two-way Calendar sync: add in app OR in Google Calendar, shows up in both
- Priority levels: Primary, Secondary, Tertiary (not custom)
- Return visit flag is within the same season, not year-over-year
- School contact info is one person per school (not multiple)
- Colleague Rolodex is separate from School Directory

---

## localStorage Keys
| Key | Contents |
|---|---|
| `acc_counties` | Array of county objects `{id, name, notes}` |
| `acc_schools` | Array of school objects `{id, countyId, name, address, priority, contact, contactEmail, contactPhone}` |
| `acc_visits` | Array of visit log entries (structure TBD) |
| `acc_colleagues` | Array of colleague contacts (structure TBD) |

---

## GitHub
- Repo to be created - files to be pushed once repo is set up
- Will be hosted via GitHub Pages for free browser access from any device
