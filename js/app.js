// =============================================
// ACC - Admissions Command Center
// Main app logic - navigation and shared state
// =============================================

// --- Shared constants ---
// Sol's office address - the default starting point for routes.
// Defined once here so an office move only needs one edit.
// Used by routes.js and calendar.js (app.js loads first, so it is always available).
const DEFAULT_ORIGIN = '210 Hurt St, Martin, TN 38237';

// --- Page and navigation config ---
// Maps page IDs to their display names shown in the top bar
const PAGE_TITLES = {
  dashboard:  'Dashboard',
  directory:  'School Directory',
  rolodex:    'Colleague Rolodex',
  visits:     'Visit Log',
  routes:     'Route Planner',
  events:     'Events',
};

// =============================================
// NAVIGATION
// Shows the selected page and hides all others
// =============================================
function navigateTo(pageId) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  // Show the requested page
  const target = document.getElementById('page-' + pageId);
  if (target) target.classList.add('active');

  // Update the top bar title
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = PAGE_TITLES[pageId] || '';

  // Update active state on sidebar nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === pageId);
  });

  // Update active state on bottom tab bar (mobile)
  document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === pageId);
  });

  // Close the sidebar on mobile after navigating
  closeSidebar();

  // Refresh the relevant section whenever the user navigates to it
  if (pageId === 'dashboard') updateDashboardStats();
  if (pageId === 'directory') initDirectory();
  if (pageId === 'rolodex')   initRolodex();
  if (pageId === 'visits')    initVisits();
  if (pageId === 'routes')    initRoutes();
  if (pageId === 'events')    initEvents();
}

// =============================================
// SIDEBAR TOGGLE
// Opens and closes the side navigation drawer
// =============================================
function toggleSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  const isOpen   = sidebar.classList.contains('open');

  if (isOpen) {
    closeSidebar();
  } else {
    sidebar.classList.add('open');
    overlay.classList.add('visible');
  }
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar').classList.remove('peek');
  document.getElementById('sidebar-overlay').classList.remove('visible');
}

// =============================================
// LOCAL STORAGE HELPERS
// Simple wrappers to save and load app data
// All data lives in the browser - no server needed yet
// =============================================
function saveData(key, value) {
  try {
    localStorage.setItem('acc_' + key, JSON.stringify(value));
  } catch (e) {
    console.error('ACC: could not save data for key:', key, e);
  }
}

function loadData(key, fallback) {
  try {
    const raw = localStorage.getItem('acc_' + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error('ACC: could not load data for key:', key, e);
    return fallback;
  }
}

// =============================================
// DASHBOARD STATS
// Counts schools, visits, and colleagues
// and updates the Season Snapshot card
// =============================================
function updateDashboardStats() {
  // Load each data set from storage
  const schools    = loadData('schools',    []);
  const visits     = loadData('visits',     []);
  const colleagues = loadData('colleagues', []);

  // Update the stat numbers on screen
  const schoolEl    = document.getElementById('stat-schools');
  const visitEl     = document.getElementById('stat-visits');
  const colleagueEl = document.getElementById('stat-colleagues');

  if (schoolEl)    schoolEl.textContent    = schools.length;
  if (visitEl)     visitEl.textContent     = visits.length;
  if (colleagueEl) colleagueEl.textContent = colleagues.length;

  // Render the Primary Schools quick-access section
  renderPrimarySchools(schools);

  // Render the unified dashboard calendar (replaces old upcoming visits + events cards)
  renderDashboardCalendar();

  // Render overdue school alerts
  renderOverdueSchools();

  // Refresh the last-backup note next to the export buttons
  renderBackupStatus();
}

// =============================================
// UPCOMING VISITS DASHBOARD CARD
// Pulls from the Route Planner - routes are planned ahead,
// the Visit Log is used after each visit to record notes.
// =============================================
function renderUpcomingVisits() {
  const container = document.getElementById('dashboard-upcoming');
  if (!container) return;

  const routes = loadData('routes', []);

  // Show routes from today forward, soonest first
  const today    = new Date().toISOString().split('T')[0];
  const upcoming = routes
    .filter(r => r.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (upcoming.length === 0) {
    container.innerHTML = '<p class="empty-state">No upcoming routes planned. Add one in the Route Planner.</p>';
    return;
  }

  container.innerHTML = upcoming.map(r => {
    const d       = new Date(r.date);
    // Offset fix - date strings parse as UTC midnight, shift to local
    const dateStr = new Date(d.getTime() + d.getTimezoneOffset() * 60000)
      .toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' });
    const stops   = `${r.stops.length} stop${r.stops.length !== 1 ? 's' : ''}`;
    return `
      <div class="upcoming-route-row" onclick="navigateTo('routes')">
        <div class="upcoming-route-icon">&#128205;</div>
        <div class="upcoming-route-info">
          <span class="upcoming-route-name">${escapeHtml(r.name)}</span>
          <span class="upcoming-route-meta">${dateStr} &nbsp;&middot;&nbsp; ${stops}</span>
        </div>
      </div>
    `;
  }).join('');
}

// =============================================
// PRIMARY SCHOOLS SECTION
// Filters schools marked as Primary and renders
// them as quick-access chips on the dashboard
// =============================================
function renderPrimarySchools(schools) {
  const container = document.getElementById('dashboard-primary-schools');
  if (!container) return;

  // Load counties so we can look up the name by countyId
  const counties = loadData('counties', []);

  // Load visits so we can flag schools that need a return visit
  const visits = loadData('visits', []);

  // Filter down to only Primary-priority schools
  const primaries = schools.filter(s => s.priority === 'Primary');

  if (primaries.length === 0) {
    container.innerHTML = '<p class="empty-state">No primary schools yet. Add schools in the School Directory and mark them as Primary.</p>';
    return;
  }

  // Build a grid of chips, one per primary school
  const html = '<div class="primary-school-list">' +
    primaries.map(s => {
      // Look up county name from the countyId stored on the school
      const county     = counties.find(c => c.id === s.countyId);
      const countyName = county ? county.name + ' County' : '';
      // Check if any visit for this school has the return-visit flag set
      const needsReturn = visits.some(function(v) { return v.schoolId === s.id && v.returnVisit; });
      return `
        <div class="primary-school-chip" onclick="navigateTo('directory'); openSchoolDetail('${s.id}')">
          <span>${escapeHtml(s.name)}</span>
          <span class="chip-county">${escapeHtml(countyName)}</span>
          ${needsReturn ? '<span class="chip-return-tag">&#8617; Revisit</span>' : ''}
        </div>
      `;
    }).join('') +
  '</div>';

  container.innerHTML = html;
}

// =============================================
// OVERDUE SCHOOL ALERTS
// Flags Primary schools that haven't been visited in 60+ days.
// Shown on the dashboard to prevent schools from slipping through.
// =============================================
// Tracks which county sections are open in the overdue card.
// Keyed by countyId - true = expanded, missing/false = collapsed.
var overdueCountyOpen = {};

// Toggle a county open/closed and re-render the overdue card
function toggleOverdueCounty(countyId) {
  overdueCountyOpen[countyId] = !overdueCountyOpen[countyId];
  renderOverdueSchools();
}

function renderOverdueSchools() {
  const container = document.getElementById('dashboard-overdue');
  if (!container) return;

  const schools = loadData('schools',  []);
  const visits  = loadData('visits',   []);
  const counties = loadData('counties', []);
  const today   = Date.now();

  // Only care about Primary schools
  const primaries = schools.filter(function(s) { return s.priority === 'Primary'; });

  // Build a lookup of the most recent visit date per school in ONE pass.
  // Faster than re-filtering and re-sorting the whole visit list for every school.
  const lastVisitDate = {};
  visits.forEach(function(v) {
    const current = lastVisitDate[v.schoolId];
    // Keep whichever date is newer (dates are YYYY-MM-DD so string compare works)
    if (!current || v.date > current) lastVisitDate[v.schoolId] = v.date;
  });

  // Build overdue list with days-since already computed
  const overdue = [];
  primaries.forEach(function(school) {
    const last = lastVisitDate[school.id];
    let daysSince = null;
    let daysSinceStr = 'Never visited';

    if (last) {
      const lastDate = new Date(last);
      // Offset fix - date strings parse as UTC midnight, shift to local time
      daysSince = Math.floor((today - new Date(lastDate.getTime() + lastDate.getTimezoneOffset() * 60000)) / 86400000);
      daysSinceStr = daysSince + ' days ago';
    }

    // Overdue means never visited, or last visit was more than 60 days ago
    if (daysSince === null || daysSince > 60) {
      overdue.push({ school: school, daysSinceStr: daysSinceStr });
    }
  });

  if (overdue.length === 0) {
    container.innerHTML = '<p class="empty-state">All primary schools visited within the last 60 days.</p>';
    return;
  }

  // Group overdue schools by county, sorted by county name
  const grouped = {};
  overdue.forEach(function(item) {
    const cId = item.school.countyId || 'none';
    if (!grouped[cId]) grouped[cId] = [];
    grouped[cId].push(item);
  });

  const sortedCountyIds = Object.keys(grouped).sort(function(a, b) {
    const ca = counties.find(function(c) { return c.id === a; });
    const cb = counties.find(function(c) { return c.id === b; });
    return (ca ? ca.name : 'zzz').localeCompare(cb ? cb.name : 'zzz');
  });

  const groupsHtml = sortedCountyIds.map(function(cId) {
    const county   = counties.find(function(c) { return c.id === cId; });
    const items    = grouped[cId];
    const isOpen   = !!overdueCountyOpen[cId];
    const arrow    = isOpen ? '&#9660;' : '&#9654;';
    const label    = county ? county.name + ' County' : 'Unknown County';

    const schoolRows = items.map(function(item) {
      return `
        <div class="overdue-row" onclick="navigateTo('directory'); openSchoolDetail('${item.school.id}')">
          <span class="overdue-school-name">${escapeHtml(item.school.name)}</span>
          <span class="overdue-badge">${item.daysSinceStr}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="overdue-county-group">
        <div class="overdue-county-header" onclick="toggleOverdueCounty('${cId}')">
          <div class="overdue-county-header-left">
            <span class="overdue-county-arrow">${arrow}</span>
            <span class="overdue-county-name">${escapeHtml(label)}</span>
          </div>
          <span class="overdue-county-badge">${items.length} school${items.length !== 1 ? 's' : ''}</span>
        </div>
        ${isOpen ? `<div class="overdue-county-schools">${schoolRows}</div>` : ''}
      </div>
    `;
  }).join('');

  // Footer link - opens the School Directory so the user can take action
  const footerHtml = `
    <div class="overdue-footer">
      <button class="btn btn-ghost btn-sm" onclick="navigateTo('directory')">
        View School Directory &#8594;
      </button>
    </div>
  `;

  container.innerHTML = groupsHtml + footerHtml;
}

// =============================================
// SEASON ARCHIVE
// Saves visits and routes under a named season label,
// then clears them so you start fresh.
// Schools and counties are kept - they carry forward each year.
// =============================================

// Opens a modal to confirm and name the archive
function openArchiveSeason() {
  const visits = loadData('visits', []);
  const routes = loadData('routes', []);

  const body = `
    <div class="form-group">
      <label>Season Name <span class="required">*</span></label>
      <input type="text" id="f-season-name" placeholder="e.g. 2024-2025" />
    </div>
    <p style="color:var(--text-muted); font-size:0.875rem; margin-top:8px;">
      This will archive <strong>${visits.length} visit${visits.length !== 1 ? 's' : ''}</strong>
      and <strong>${routes.length} route${routes.length !== 1 ? 's' : ''}</strong>,
      then clear them for the new season.<br /><br />
      Your school directory and colleagues will stay intact.
    </p>
  `;

  openModal('Archive This Season', body, function() {
    const name = document.getElementById('f-season-name').value.trim();
    if (!name) { alert('Please enter a season name.'); return; }

    // Load existing archives (array of past seasons)
    const archives = loadData('archives', []);

    // Build the archive entry
    archives.push({
      id:       makeId(),
      name:     name,
      archivedOn: new Date().toISOString().split('T')[0],
      visits:   visits,
      routes:   routes,
    });

    // Save archive, then clear current visits and routes
    saveData('archives', archives);
    saveData('visits',   []);
    saveData('routes',   []);

    closeModal();
    updateDashboardStats();
    alert('"' + name + '" season archived. Visit log and routes cleared for the new season.');
  });
}

// Opens a modal listing all past archived seasons
function openViewArchives() {
  const archives = loadData('archives', []);

  if (archives.length === 0) {
    openModal('Past Seasons', '<p style="color:var(--text-muted);">No seasons archived yet.</p>', null);
    return;
  }

  // List archives newest first
  const sorted = [...archives].sort(function(a, b) { return b.archivedOn.localeCompare(a.archivedOn); });

  const rows = sorted.map(function(arc) {
    return `
      <div class="archive-row">
        <div class="archive-row-info">
          <span class="archive-row-name">${escapeHtml(arc.name)}</span>
          <span class="archive-row-meta">
            Archived ${arc.archivedOn} &nbsp;-&nbsp;
            ${arc.visits ? arc.visits.length : 0} visit${arc.visits && arc.visits.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="downloadArchive('${arc.id}')">
          &#8659; Download
        </button>
      </div>
    `;
  }).join('');

  openModal('Past Seasons', `<div class="archive-list">${rows}</div>`, null);
}

// Shared helper - downloads any object as a nicely formatted JSON file.
// Used by both the season archive download and the full data export,
// so the temporary-link download trick only lives in one place.
function downloadJsonFile(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  // Create an invisible link, click it to trigger the download, then clean up
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Downloads one archived season as a JSON file
function downloadArchive(archiveId) {
  const archives = loadData('archives', []);
  const arc = archives.find(function(a) { return a.id === archiveId; });
  if (!arc) return;

  downloadJsonFile(arc, 'acc-season-' + arc.name.replace(/\s+/g, '-') + '.json');
}

// =============================================
// DATA EXPORT
// Collects every acc_ key from localStorage and
// downloads it as a single JSON file the user can save
// =============================================
function exportAllData() {
  const snapshot = {};

  // Loop through every key in localStorage and grab the ones that belong to ACC
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('acc_')) {
      try {
        snapshot[key] = JSON.parse(localStorage.getItem(key));
      } catch (e) {
        snapshot[key] = localStorage.getItem(key);
      }
    }
  }

  // Build a descriptive filename: date + school count + visit count
  const dateStr     = new Date().toISOString().split('T')[0];
  const schoolCount = (loadData('schools', [])).length;
  const visitCount  = (loadData('visits',  [])).length;
  const filename    = 'ACC-backup-' + dateStr
    + '-' + schoolCount + 'schools'
    + '-' + visitCount  + 'visits.json';

  // Record timestamp and refresh the nudge
  saveData('last_backup', new Date().toISOString());
  renderBackupStatus();

  // ---- FILE DOWNLOAD ----
  // Trigger a .json file download to the device so the user can import it
  // directly with the file picker - no copying and pasting required.
  const blob    = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const blobUrl = URL.createObjectURL(blob);
  const dlLink  = document.createElement('a');
  dlLink.href     = blobUrl;
  dlLink.download = filename;
  document.body.appendChild(dlLink);
  dlLink.click();
  document.body.removeChild(dlLink);
  URL.revokeObjectURL(blobUrl);

  // ---- EMAIL BACKUP ----
  // Build a leaner copy for the email - skip the geocache and Google Calendar
  // system keys since they're large and auto-regenerate. Core data only.
  const emailKeys  = ['acc_counties', 'acc_schools', 'acc_visits',
                      'acc_colleagues', 'acc_routes', 'acc_archives',
                      'acc_events', 'acc_event_types'];
  const emailSnap  = {};
  emailKeys.forEach(function(k) {
    if (snapshot[k] !== undefined) emailSnap[k] = snapshot[k];
  });

  const btn = document.getElementById('export-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

  const subject = 'ACC Backup - ' + dateStr
    + ' - ' + schoolCount + ' schools, ' + visitCount + ' visits';

  // Simplified email - the .json file is the primary restore path now.
  // The raw JSON is included at the bottom as a last-resort fallback only.
  const message = 'ACC Backup - ' + dateStr + '\n'
    + 'Schools: ' + schoolCount + '  |  Visits: ' + visitCount + '\n\n'
    + 'Your backup just downloaded as:\n'
    + filename + '\n\n'
    + '======= HOW TO RESTORE =======\n'
    + '1. Open ACC: https://solwatk3.github.io/Admissions-Command-Center/\n'
    + '2. Click "Import Data" on the dashboard\n'
    + '3. Tap "Choose File" and pick the .json backup file\n'
    + '   (On mobile: check Downloads or Files app)\n'
    + '==============================\n\n'
    + '--- FALLBACK: raw JSON (only needed if the file is unavailable) ---\n'
    + JSON.stringify(emailSnap);

  emailjs.send('service_9sv9w6p', 'template_r0o15xz', {
    to_email: 'solwatk3@gmail.com',
    subject:  subject,
    message:  message,
  })
  .then(function() {
    if (btn) { btn.disabled = false; btn.textContent = '✓ Backed up!'; }
    setTimeout(function() {
      if (btn) btn.textContent = '↓ Export Data';
    }, 3000);
  })
  .catch(function(err) {
    console.error('ACC: backup email failed', err);
    if (btn) { btn.disabled = false; btn.textContent = '↓ Export Data'; }
    alert('File downloaded, but the email failed to send. Your local backup is still saved.');
  });
}

// =============================================
// BACKUP STATUS NUDGE
// Shows how long it has been since the last export.
// Turns orange after 14 days (or if no backup exists yet)
// because all data lives in this browser's localStorage -
// a browser reset without a backup means the data is gone.
// =============================================
function renderBackupStatus() {
  const el = document.getElementById('backup-status');
  if (!el) return;

  const last = loadData('last_backup', null);

  // Never backed up - always show the warning state
  if (!last) {
    el.textContent = 'No backup yet';
    el.classList.add('backup-overdue');
    return;
  }

  // Work out whole days since the last backup
  const days = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
  el.textContent = days === 0
    ? 'Last backup: today'
    : 'Last backup: ' + days + ' day' + (days !== 1 ? 's' : '') + ' ago';

  // Warning color once the backup is more than 14 days old
  el.classList.toggle('backup-overdue', days > 14);
}

// =============================================
// IMPORT MODAL
// File-picker based restore - no copying or pasting required.
// The user picks the .json backup file downloaded during Export
// and the data is read and restored automatically.
// =============================================
function openImportModal() {
  const body = `
    <p style="color:var(--text-muted); font-size:0.875rem; margin:0 0 16px;">
      Pick the .json backup file from your device to restore your data.
      On mobile, check your Downloads or Files app after exporting.
    </p>
    <div class="form-group">
      <label>Backup file (.json)</label>
      <input
        type="file"
        id="f-import-file"
        accept=".json,application/json"
        style="color:var(--text); padding:8px 0;"
        onchange="importAllData(event)"
      />
    </div>
    <p style="color:var(--text-muted); font-size:0.78rem; margin-top:12px;">
      Don't have the file? Export from another device first, then transfer the .json to this one.
    </p>
  `;

  // null as the save handler hides the Save button -
  // the file input triggers the restore automatically on file selection.
  openModal('Restore from Backup', body, null);
}

// =============================================
// RESTORE SNAPSHOT
// Shared restore logic used by the paste-import modal.
// Writes all acc_ keys from the snapshot back into localStorage.
// =============================================
function restoreSnapshot(snapshot) {
  const importSchools = Array.isArray(snapshot['acc_schools']) ? snapshot['acc_schools'].length : '?';
  const importVisits  = Array.isArray(snapshot['acc_visits'])  ? snapshot['acc_visits'].length  : '?';

  const confirmMsg = 'This backup contains:\n'
    + '  - ' + importSchools + ' schools\n'
    + '  - ' + importVisits  + ' visits\n\n'
    + 'Restore and replace all your current data?';

  if (!confirm(confirmMsg)) return;

  // Only restore acc_ keys - ignore anything unexpected in the payload
  Object.keys(snapshot).forEach(function(key) {
    if (key.startsWith('acc_')) {
      localStorage.setItem(key, JSON.stringify(snapshot[key]));
    }
  });

  closeModal();
  updateDashboardStats();
  alert('Restore successful! Your data is back.');
}

// Legacy file-based import - kept so old downloaded .json files still work
function importAllData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      restoreSnapshot(JSON.parse(e.target.result));
      event.target.value = '';
    } catch (err) {
      alert('Could not read that file. Make sure it is a valid ACC backup.');
    }
  };
  reader.readAsText(file);
}

// =============================================
// FORMAT PHONE NUMBER
// Strips non-digits and returns (###)-###-#### for 10-digit US numbers.
// Also handles 11-digit numbers starting with 1 (country code).
// Returns the original string unchanged if it can't be formatted,
// so partial or international numbers are never silently mangled.
// =============================================
function formatPhone(raw) {
  if (!raw) return raw;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    return '(' + digits.slice(0, 3) + ')-' + digits.slice(3, 6) + '-' + digits.slice(6);
  }
  // Strip leading country code 1 and format the remaining 10 digits
  if (digits.length === 11 && digits[0] === '1') {
    return '(' + digits.slice(1, 4) + ')-' + digits.slice(4, 7) + '-' + digits.slice(7);
  }
  return raw;
}

// =============================================
// COPY TO CLIPBOARD
// Copies a value and briefly shows "Copied!" confirmation
// el is the element that was clicked - used to show feedback
// =============================================
function copyToClipboard(value, el) {
  navigator.clipboard.writeText(value).then(function() {
    const original = el.innerHTML;
    el.innerHTML = '&#10003; Copied!';
    el.style.color = 'var(--success)';
    // Reset back to original text after 1.5 seconds
    setTimeout(function() {
      el.innerHTML = original;
      el.style.color = '';
    }, 1500);
  });
}

// =============================================
// HOVER SIDEBAR (desktop only)
// The sidebar slides in when the user hovers
// near the left edge, slides out when they leave
// =============================================
function initHoverSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const trigger  = document.getElementById('sidebar-trigger');
  if (!sidebar || !trigger) return;

  let hideTimer = null;

  // Show the sidebar
  function showSidebar() {
    clearTimeout(hideTimer);
    sidebar.classList.add('peek');
  }

  // Hide the sidebar after a short delay so accidental mouse exits don't close it
  function hideSidebar() {
    hideTimer = setTimeout(function() {
      sidebar.classList.remove('peek');
    }, 200);
  }

  // Hovering the trigger strip opens the sidebar
  trigger.addEventListener('mouseenter', showSidebar);
  trigger.addEventListener('mouseleave', hideSidebar);

  // Hovering the sidebar itself keeps it open
  sidebar.addEventListener('mouseenter', showSidebar);
  sidebar.addEventListener('mouseleave', hideSidebar);
}

// =============================================
// GLOBAL SEARCH
// Searches schools, visits, and colleagues in one box.
// Toggled by the magnifier button in the top bar,
// or by pressing Ctrl+K anywhere in the app.
// =============================================

// Open the global search panel and focus the input
function toggleGlobalSearch() {
  var panel = document.getElementById('global-search-panel');
  if (!panel) return;
  if (panel.classList.contains('hidden')) {
    openGlobalSearch();
  } else {
    closeGlobalSearch();
  }
}

function openGlobalSearch() {
  var panel = document.getElementById('global-search-panel');
  var input = document.getElementById('global-search-input');
  if (!panel || !input) return;
  panel.classList.remove('hidden');
  input.focus();
  input.select();
}

function closeGlobalSearch() {
  var panel = document.getElementById('global-search-panel');
  var input = document.getElementById('global-search-input');
  var results = document.getElementById('global-search-results');
  if (panel)   panel.classList.add('hidden');
  if (input)   input.value = '';
  if (results) results.innerHTML = '';
}

// Run the search and render results.
// Covers schools, visits, colleagues, events, and routes.
function runGlobalSearch(q) {
  var resultsEl = document.getElementById('global-search-results');
  if (!resultsEl) return;

  var query = (q || '').trim().toLowerCase();
  if (!query) { resultsEl.innerHTML = ''; return; }

  var schools    = loadData('schools',     []);
  var visits     = loadData('visits',      []);
  var colleagues = loadData('colleagues',  []);
  var counties   = loadData('counties',    []);
  var events     = loadData('events',      []);
  var routes     = loadData('routes',      []);

  // --- Counties ---
  // Shows matching counties as their own result - clicking opens that county's school list.
  // County name is intentionally removed from the school filter below so searching
  // "Stewart" brings up Stewart County, not a wall of every school inside it.
  var countyHits = counties.filter(function(c) {
    return (
      c.name.toLowerCase().includes(query) ||
      (c.notes  || '').toLowerCase().includes(query) ||
      (c.region || '').toLowerCase().includes(query)
    );
  });

  // --- Schools ---
  // Matches on school-level fields only (name, address, notes, priority).
  // Contact searches and county searches are handled in their own sections.
  var schoolHits = schools.filter(function(s) {
    return (
      s.name.toLowerCase().includes(query) ||
      (s.address  || '').toLowerCase().includes(query) ||
      (s.notes    || '').toLowerCase().includes(query) ||
      (s.priority || '').toLowerCase().includes(query)
    );
  });

  // --- School Contacts ---
  // Each matching contact becomes its own result row showing the contact's
  // name, title, and which school they belong to.
  // Clicking opens that school's detail page where the contact info lives.
  var contactHits = [];
  schools.forEach(function(s) {
    getSchoolContacts(s).forEach(function(c) {
      if (
        (c.name  || '').toLowerCase().includes(query) ||
        (c.email || '').toLowerCase().includes(query) ||
        (c.phone || '').toLowerCase().includes(query) ||
        (c.title || '').toLowerCase().includes(query)
      ) {
        contactHits.push({ contact: c, school: s });
      }
    });
  });

  // --- Visits ---
  // Searches: school name, visit title, all notes fields
  var visitHits = visits.filter(function(v) {
    var school = schools.find(function(s) { return s.id === v.schoolId; });
    var schoolName = school ? school.name : (v.schoolName || '');
    return (
      schoolName.toLowerCase().includes(query) ||
      (v.title           || '').toLowerCase().includes(query) ||
      (v.commonQuestions || '').toLowerCase().includes(query) ||
      (v.newQuestions    || '').toLowerCase().includes(query) ||
      (v.nextTimeNotes   || '').toLowerCase().includes(query) ||
      (v.mood            || '').toLowerCase().includes(query)
    );
  });

  // --- Colleagues ---
  // Searches: name, institution, email, phone, notes
  var colleagueHits = colleagues.filter(function(c) {
    return (
      (c.name        || '').toLowerCase().includes(query) ||
      (c.institution || '').toLowerCase().includes(query) ||
      (c.email       || '').toLowerCase().includes(query) ||
      (c.phone       || '').toLowerCase().includes(query) ||
      (c.notes       || '').toLowerCase().includes(query)
    );
  });

  // --- Events ---
  // Searches: event name, type, notes
  var eventHits = events.filter(function(ev) {
    return (
      (ev.name  || '').toLowerCase().includes(query) ||
      (ev.type  || '').toLowerCase().includes(query) ||
      (ev.notes || '').toLowerCase().includes(query)
    );
  });

  // --- Routes ---
  // Searches: route name, and the names of all stops in that route
  var routeHits = routes.filter(function(r) {
    if ((r.name || '').toLowerCase().includes(query)) return true;
    return (r.stops || []).some(function(stop) {
      return (stop.name    || '').toLowerCase().includes(query) ||
             (stop.address || '').toLowerCase().includes(query);
    });
  });

  var totalHits = countyHits.length + schoolHits.length + contactHits.length +
                  visitHits.length + colleagueHits.length + eventHits.length + routeHits.length;

  if (totalHits === 0) {
    // Escape the query so typed quotes or angle brackets cannot break the page
    resultsEl.innerHTML = '<p class="gs-no-results">No results for "' + escapeHtml(q) + '"</p>';
    return;
  }

  var html = '';

  // County results - clicking opens that county's school list directly
  if (countyHits.length > 0) {
    html += '<div class="gs-section-label">Counties</div>';
    html += countyHits.map(function(c) {
      var schoolCount = schools.filter(function(s) { return s.countyId === c.id; }).length;
      var sub = (c.region || '') + (c.region && schoolCount ? ' - ' : '') +
                (schoolCount ? schoolCount + ' school' + (schoolCount !== 1 ? 's' : '') : '');
      return `
        <div class="gs-result" onclick="closeGlobalSearch(); navigateTo('directory'); openCountyView('${c.id}')">
          <span class="gs-result-icon">&#128205;</span>
          <div class="gs-result-text">
            <span class="gs-result-name">${escapeHtml(c.name)} County</span>
            ${sub ? `<span class="gs-result-sub">${escapeHtml(sub)}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // School results
  if (schoolHits.length > 0) {
    html += '<div class="gs-section-label">Schools</div>';
    html += schoolHits.map(function(s) {
      var county = counties.find(function(c) { return c.id === s.countyId; });
      var sub = county ? county.name + ' County' : '';
      return `
        <div class="gs-result" onclick="closeGlobalSearch(); navigateTo('directory'); openSchoolDetail('${s.id}')">
          <span class="gs-result-icon">&#127968;</span>
          <div class="gs-result-text">
            <span class="gs-result-name">${escapeHtml(s.name)}</span>
            ${sub ? `<span class="gs-result-sub">${escapeHtml(sub)}</span>` : ''}
          </div>
          <span class="gs-result-tag">${s.priority || ''}</span>
        </div>
      `;
    }).join('');
  }

  // Contact results - each contact shown individually with school as subtitle
  if (contactHits.length > 0) {
    html += '<div class="gs-section-label">School Contacts</div>';
    html += contactHits.map(function(item) {
      var c = item.contact;
      var s = item.school;
      // Show the most useful piece of contact info as the subtitle line
      var detail = c.title ? escapeHtml(c.title) : '';
      if (c.email) detail += (detail ? ' - ' : '') + escapeHtml(c.email);
      return `
        <div class="gs-result" onclick="closeGlobalSearch(); navigateTo('directory'); openSchoolDetail('${s.id}')">
          <span class="gs-result-icon">&#128101;</span>
          <div class="gs-result-text">
            <span class="gs-result-name">${escapeHtml(c.name || 'Unnamed Contact')}</span>
            <span class="gs-result-sub">${escapeHtml(s.name)}${detail ? ' - ' + detail : ''}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Visit results - sorted newest first
  if (visitHits.length > 0) {
    html += '<div class="gs-section-label">Visits</div>';
    html += visitHits.slice().sort(function(a, b) { return new Date(b.date) - new Date(a.date); }).map(function(v) {
      var school = schools.find(function(s) { return s.id === v.schoolId; });
      var schoolName = school ? school.name : (v.schoolName || 'Unknown School');
      var d = new Date(v.date);
      var dateStr = d.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
      return `
        <div class="gs-result" onclick="closeGlobalSearch(); navigateTo('visits'); openVisitDetail('${v.id}')">
          <span class="gs-result-icon">&#128203;</span>
          <div class="gs-result-text">
            <span class="gs-result-name">${escapeHtml(v.title || schoolName)}</span>
            <span class="gs-result-sub">${v.title ? escapeHtml(schoolName) + ' - ' : ''}${dateStr}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Colleague results - clicking opens that person's detail card directly
  if (colleagueHits.length > 0) {
    html += '<div class="gs-section-label">Colleagues</div>';
    html += colleagueHits.map(function(c) {
      return `
        <div class="gs-result" onclick="closeGlobalSearch(); navigateTo('rolodex'); openColleagueDetail('${c.id}')">
          <span class="gs-result-icon">&#128100;</span>
          <div class="gs-result-text">
            <span class="gs-result-name">${escapeHtml(c.name || 'Unnamed')}</span>
            ${c.institution ? `<span class="gs-result-sub">${escapeHtml(c.institution)}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // Event results - sorted soonest first
  if (eventHits.length > 0) {
    html += '<div class="gs-section-label">Events</div>';
    html += eventHits.slice().sort(function(a, b) { return new Date(a.date) - new Date(b.date); }).map(function(ev) {
      var d = new Date(ev.date);
      var dateStr = d.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
      return `
        <div class="gs-result" onclick="closeGlobalSearch(); navigateTo('events')">
          <span class="gs-result-icon">&#127881;</span>
          <div class="gs-result-text">
            <span class="gs-result-name">${escapeHtml(ev.name || 'Unnamed Event')}</span>
            <span class="gs-result-sub">${ev.type ? escapeHtml(ev.type) + ' - ' : ''}${dateStr}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Route results
  if (routeHits.length > 0) {
    html += '<div class="gs-section-label">Routes</div>';
    html += routeHits.map(function(r) {
      var stopCount = (r.stops || []).length;
      var sub = stopCount + ' stop' + (stopCount !== 1 ? 's' : '') + (r.date ? ' - ' + r.date : '');
      return `
        <div class="gs-result" onclick="closeGlobalSearch(); navigateTo('routes'); openRouteDetail('${r.id}')">
          <span class="gs-result-icon">&#128506;</span>
          <div class="gs-result-text">
            <span class="gs-result-name">${escapeHtml(r.name || 'Unnamed Route')}</span>
            <span class="gs-result-sub">${escapeHtml(sub)}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  resultsEl.innerHTML = html;
}

// =============================================
// DASHBOARD CALENDAR
// Unified calendar that shows Routes, Events, Visits, and Google Cal events.
// Supports a monthly grid view and a scrollable agenda view.
// =============================================

// View state - persists during the session
var calView  = 'grid';                      // 'grid' or 'agenda'
var calYear  = new Date().getFullYear();    // month displayed in grid view
var calMonth = new Date().getMonth();       // 0-indexed

// Switch between grid and agenda view
function setCalView(view) {
  calView = view;
  renderDashboardCalendar();
}

// Move back one month in grid view
function calPrevMonth() {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderDashboardCalendar();
}

// Move forward one month in grid view
function calNextMonth() {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderDashboardCalendar();
}

// Jump grid view back to the current month/year
function calGoToday() {
  calYear  = new Date().getFullYear();
  calMonth = new Date().getMonth();
  renderDashboardCalendar();
}

// =============================================
// CALENDAR DATA - collect all item types
// Returns one unified array with route, event, visit, and gcal items
// =============================================
function getCalendarItems() {
  var routes  = loadData('routes',  []);
  var events  = loadData('events',  []);
  var visits  = loadData('visits',  []);
  var items   = [];

  // Routes - purple
  routes.forEach(function(r) {
    if (!r.date) return;
    var stops = (r.stops || []).length;
    items.push({
      type:  'route',
      date:  r.date,
      title: r.name || 'Route',
      meta:  stops + ' stop' + (stops !== 1 ? 's' : ''),
      id:    r.id,
      color: '#9b30ff',
    });
  });

  // Events (boss-assigned fairs / conferences) - teal
  events.forEach(function(e) {
    if (!e.date) return;
    items.push({
      type:  'event',
      date:  e.date,
      title: e.name || 'Event',
      meta:  e.type || 'Event',
      id:    e.id,
      color: '#22d3ee',
    });
  });

  // Visit Log entries - grey
  visits.forEach(function(v) {
    if (!v.date) return;
    items.push({
      type:  'visit',
      date:  v.date,
      title: v.title || v.schoolName || 'Visit',
      meta:  'Visit' + (v.schoolName ? ' - ' + v.schoolName : ''),
      id:    v.id,
      color: '#94a3b8',
    });
  });

  // Google Calendar events (pulled by fetchGCalEvents in calendar.js) - green
  var gcalItems = window.calGcalItems || [];
  gcalItems.forEach(function(g) {
    if (!g.date) return;
    items.push({
      type:  'gcal',
      date:  g.date,
      title: g.title,
      meta:  'Google Calendar',
      id:    'gcal-' + g.id,
      color: '#4ade80',
    });
  });

  return items;
}

// =============================================
// MAIN CALENDAR RENDER
// Updates the header controls and calls the active view renderer
// =============================================
function renderDashboardCalendar() {
  // Update view toggle button active states
  var gridBtn   = document.getElementById('cal-grid-btn');
  var agendaBtn = document.getElementById('cal-agenda-btn');
  if (gridBtn)   gridBtn.classList.toggle('active', calView === 'grid');
  if (agendaBtn) agendaBtn.classList.toggle('active', calView === 'agenda');

  // Show month nav only in grid view
  var monthNav = document.getElementById('cal-month-nav');
  if (monthNav) monthNav.style.display = calView === 'grid' ? 'flex' : 'none';

  // Keep month label current
  var monthLabel = document.getElementById('cal-month-label');
  if (monthLabel) {
    var d = new Date(calYear, calMonth, 1);
    monthLabel.textContent = d.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  // Render body content
  var container = document.getElementById('dashboard-cal-body');
  if (!container) return;

  if (calView === 'grid') {
    renderCalendarGrid(container);
  } else {
    renderCalendarAgenda(container);
  }

  // Refresh the GCal status area in the header
  updateCalGcalStatus();
}

// =============================================
// GRID VIEW RENDERER
// Builds a 7-column monthly grid with dots for each item
// =============================================
function renderCalendarGrid(container) {
  var items     = getCalendarItems();
  var todayStr  = new Date().toISOString().split('T')[0];

  // Group items by date string for quick lookup
  var byDate = {};
  items.forEach(function(item) {
    if (!byDate[item.date]) byDate[item.date] = [];
    byDate[item.date].push(item);
  });

  var firstDay     = new Date(calYear, calMonth, 1);
  var daysInMonth  = new Date(calYear, calMonth + 1, 0).getDate();
  var startDow     = firstDay.getDay();  // 0=Sun
  var prevLastDay  = new Date(calYear, calMonth, 0).getDate();

  var dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var html = '<div class="cal-grid">';

  // Day-of-week header
  html += '<div class="cal-dow-row">';
  dows.forEach(function(d) {
    html += '<div class="cal-dow-cell">' + d + '</div>';
  });
  html += '</div>';

  html += '<div class="cal-days-grid">';

  // Filler cells for days from previous month
  for (var i = startDow - 1; i >= 0; i--) {
    html += '<div class="cal-day cal-other-month"><span class="cal-day-num">' + (prevLastDay - i) + '</span></div>';
  }

  // Current month days
  for (var d = 1; d <= daysInMonth; d++) {
    var dateStr   = calYear + '-' + String(calMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    var dayItems  = byDate[dateStr] || [];
    var isToday   = dateStr === todayStr;
    var cellClass = 'cal-day' + (isToday ? ' cal-today' : '');

    html += '<div class="' + cellClass + '" onclick="openCalDayModal(\'' + dateStr + '\')">';
    html += '<span class="cal-day-num">' + d + '</span>';

    if (dayItems.length > 0) {
      // Dots row - one dot per item (max 6 shown)
      html += '<div class="cal-day-dots">';
      dayItems.slice(0, 6).forEach(function(item) {
        html += '<span class="cal-dot" style="background:' + item.color + ';" title="' + escapeHtml(item.title) + '"></span>';
      });
      html += '</div>';

      // Text label chips - first 2 items
      html += '<div class="cal-day-labels">';
      dayItems.slice(0, 2).forEach(function(item) {
        html += '<div class="cal-day-label" style="color:' + item.color + ';">' + escapeHtml(item.title) + '</div>';
      });
      if (dayItems.length > 2) {
        html += '<div class="cal-day-more">+' + (dayItems.length - 2) + ' more</div>';
      }
      html += '</div>';
    }

    html += '</div>';
  }

  // Filler cells for the remainder of the last week row
  var totalCells    = startDow + daysInMonth;
  var trailingCells = (7 - (totalCells % 7)) % 7;
  for (var n = 1; n <= trailingCells; n++) {
    html += '<div class="cal-day cal-other-month"><span class="cal-day-num">' + n + '</span></div>';
  }

  html += '</div></div>'; // close cal-days-grid + cal-grid
  container.innerHTML = html;
}

// =============================================
// AGENDA VIEW RENDERER
// Chronological list split into Upcoming / Past sections
// =============================================
function renderCalendarAgenda(container) {
  var items    = getCalendarItems();
  var todayStr = new Date().toISOString().split('T')[0];

  if (items.length === 0) {
    container.innerHTML = '<div class="cal-agenda"><p class="empty-state">No routes, events, or visits logged yet.</p></div>';
    return;
  }

  var upcoming = items.filter(function(i) { return i.date >= todayStr; })
    .sort(function(a, b) { return a.date.localeCompare(b.date); });
  var past = items.filter(function(i) { return i.date < todayStr; })
    .sort(function(a, b) { return b.date.localeCompare(a.date); }); // newest first

  var html = '<div class="cal-agenda">';

  if (upcoming.length > 0) {
    html += '<div class="cal-agenda-section">Upcoming</div>';
    upcoming.forEach(function(item) { html += buildAgendaRow(item); });
  }

  if (past.length > 0) {
    html += '<div class="cal-agenda-section">Past</div>';
    past.forEach(function(item) { html += buildAgendaRow(item); });
  }

  html += '</div>';
  container.innerHTML = html;
}

// Builds one agenda row's HTML string
function buildAgendaRow(item) {
  // Date offset fix - YYYY-MM-DD strings parse as UTC midnight; shift to local
  var d           = new Date(item.date);
  var local       = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
  var dayNum      = local.getDate();
  var monStr      = local.toLocaleString('default', { month: 'short' });

  var typeLabels  = { route: 'Route', event: 'Event', visit: 'Visit', gcal: 'Google Cal' };
  var typeLabel   = typeLabels[item.type] || item.type;
  var isReadOnly  = item.type === 'gcal';  // GCal items are display-only

  var clickAttr   = isReadOnly
    ? 'class="cal-agenda-row cal-readonly"'
    : 'class="cal-agenda-row" onclick="openCalItem(\'' + item.id + '\', \'' + item.type + '\')"';

  return '<div ' + clickAttr + '>' +
    '<div class="cal-agenda-stripe" style="background:' + item.color + ';"></div>' +
    '<div class="cal-agenda-date">' +
      '<span class="cal-agenda-date-day">' + dayNum + '</span>' +
      '<span class="cal-agenda-date-mon">' + monStr + '</span>' +
    '</div>' +
    '<div class="cal-agenda-info">' +
      '<div class="cal-agenda-title">' + escapeHtml(item.title) + '</div>' +
      '<div class="cal-agenda-meta">' + escapeHtml(item.meta) + '</div>' +
    '</div>' +
    '<span class="cal-agenda-type" style="color:' + item.color + '; background:' + item.color + '22; border:1px solid ' + item.color + '44;">' + typeLabel + '</span>' +
  '</div>';
}

// =============================================
// NAVIGATE TO A CALENDAR ITEM
// Called from agenda row or day modal clicks
// =============================================
function openCalItem(id, type) {
  if (type === 'route') {
    navigateTo('routes');
    // Give the route list a moment to render before opening the detail
    setTimeout(function() { openRouteDetail(id); }, 60);
  } else if (type === 'event') {
    navigateTo('events');
    setTimeout(function() { openEditEvent(id); }, 60);
  } else if (type === 'visit') {
    navigateTo('visits');
    setTimeout(function() { openVisitDetail(id); }, 60);
  }
  // gcal items are read-only display from Google - no navigation
}

// =============================================
// DAY DETAIL MODAL
// Opens when the user clicks any day in the grid.
// Lists items on that day and offers quick-add buttons.
// =============================================
function openCalDayModal(dateStr) {
  var items = getCalendarItems().filter(function(i) { return i.date === dateStr; });

  // Format the date label for the modal title
  var d     = new Date(dateStr);
  var local = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
  var dateLabel = local.toLocaleDateString('default', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  var typeLabels = { route: 'Route', event: 'Event', visit: 'Visit', gcal: 'Google Cal' };

  // Build item list HTML
  var itemsHtml = '';
  if (items.length === 0) {
    itemsHtml = '<p class="cal-day-modal-empty">Nothing scheduled - use a button below to add something.</p>';
  } else {
    itemsHtml = '<div class="cal-day-modal-items">';
    items.forEach(function(item) {
      var isReadOnly  = item.type === 'gcal';
      var clickAttr   = isReadOnly
        ? 'class="cal-day-modal-item cal-readonly"'
        : 'class="cal-day-modal-item" onclick="closeModal(); openCalItem(\'' + item.id + '\', \'' + item.type + '\')"';
      itemsHtml += '<div ' + clickAttr + '>' +
        '<div class="cal-day-modal-stripe" style="background:' + item.color + ';"></div>' +
        '<div class="cal-day-modal-info">' +
          '<div class="cal-day-modal-title">' + escapeHtml(item.title) + '</div>' +
          '<div class="cal-day-modal-type">' + (typeLabels[item.type] || item.type) + ' &middot; ' + escapeHtml(item.meta) + '</div>' +
        '</div>' +
      '</div>';
    });
    itemsHtml += '</div>';
  }

  // Add buttons - pre-fill the clicked date into the relevant form
  var addHtml = '<div class="cal-day-modal-add">' +
    '<button class="btn btn-accent btn-sm" onclick="quickAddEvent(\'' + dateStr + '\')">+ Add Event</button>' +
    '<button class="btn btn-ghost btn-sm" onclick="quickAddRoute(\'' + dateStr + '\')">+ New Route</button>' +
  '</div>';

  var body = '<div class="cal-day-modal-date">' + dateLabel + '</div>' + itemsHtml + addHtml;

  // Pass null as the save handler so no Save button is shown - actions are in the body
  openModal('', body, null);
}

// =============================================
// QUICK-ADD HELPERS
// Close the day modal, open the relevant form, pre-fill the date
// =============================================
function quickAddEvent(dateStr) {
  closeModal();
  openAddEvent();
  // openAddEvent defaults to today - overwrite with the clicked date
  setTimeout(function() {
    var dateInput = document.getElementById('f-event-date');
    if (dateInput) dateInput.value = dateStr;
  }, 0);
}

function quickAddRoute(dateStr) {
  closeModal();
  // Open the route builder on the Routes page and pre-fill the date field
  navigateTo('routes');
  openRouteBuilder();
  setTimeout(function() {
    var dateInput = document.getElementById('rb-date');
    if (dateInput) dateInput.value = dateStr;
  }, 80);
}

// =============================================
// GCAL STATUS IN CALENDAR HEADER
// Called by renderDashboardCalendar and renderCalendarStatus in calendar.js
// =============================================
function updateCalGcalStatus() {
  var statusEl = document.getElementById('cal-gcal-status');
  if (!statusEl) return;

  // isCalendarConnected is defined in calendar.js (loads after app.js)
  var connected = (typeof isCalendarConnected === 'function') && isCalendarConnected();

  var lastSyncRaw = loadData('gcal_last_sync', null);
  var lastSync = lastSyncRaw
    ? new Date(lastSyncRaw).toLocaleString('default', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;

  if (connected) {
    statusEl.innerHTML =
      '<span class="cal-gcal-dot cal-gcal-dot-on"></span>' +
      (lastSync ? '<span class="cal-gcal-meta">Synced ' + lastSync + '</span>' : '') +
      '<button class="btn btn-ghost btn-sm" id="gcal-sync-btn" onclick="syncAllRoutes()">&#8635; Sync</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="disconnectCalendar()">Disconnect</button>';
  } else {
    statusEl.innerHTML =
      '<span class="cal-gcal-dot cal-gcal-dot-off"></span>' +
      '<button class="btn btn-accent btn-sm" onclick="connectCalendar()">Connect Google Cal</button>';
  }
}

// =============================================
// APP INIT
// Runs once when the page loads
// =============================================
function init() {
  navigateTo('dashboard');
  initHoverSidebar();
  initCalendar();

  // Ctrl+K opens global search from anywhere.
  // toLowerCase makes it work even when Caps Lock is on.
  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openGlobalSearch();
    }
  });
}

// Start the app when the DOM is ready
document.addEventListener('DOMContentLoaded', init);

// Initialize EmailJS with Sol's public key so route emails can be sent without a dialog
emailjs.init({ publicKey: 'dZZyEPJlPeAooJHfJ' });
