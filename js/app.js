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

  // Render flagged return visits
  renderReturnVisits();

  // Render upcoming visits (today and future)
  renderUpcomingVisits();

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
      return `
        <div class="primary-school-chip" onclick="navigateTo('directory'); openSchoolDetail('${s.id}')">
          <span>${escapeHtml(s.name)}</span>
          <span class="chip-county">${escapeHtml(countyName)}</span>
        </div>
      `;
    }).join('') +
  '</div>';

  container.innerHTML = html;
}

// =============================================
// RETURN VISITS DASHBOARD CARD
// Shows visits flagged for a return
// =============================================
function renderReturnVisits() {
  const container = document.getElementById('dashboard-returns');
  if (!container) return;

  const visits  = loadData('visits', []);
  const schools = loadData('schools', []);
  const flagged = visits.filter(v => v.returnVisit);

  if (flagged.length === 0) {
    container.innerHTML = '<p class="empty-state">No return visits flagged yet.</p>';
    return;
  }

  container.innerHTML = flagged.map(v => {
    const school = schools.find(s => s.id === v.schoolId);
    const name   = school ? school.name : v.schoolName || 'Unknown';
    const date   = new Date(v.date).toLocaleDateString('default', { month: 'short', day: 'numeric' });
    return `<div class="return-visit-row"><span>&#128260; ${escapeHtml(name)}</span><span class="return-visit-date">${date}</span></div>`;
  }).join('');
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
        // Strip the acc_ prefix so the file is clean to read
        snapshot[key] = JSON.parse(localStorage.getItem(key));
      } catch (e) {
        snapshot[key] = localStorage.getItem(key);
      }
    }
  }

  // Build a descriptive filename: date + school count + visit count
  // so you can tell backups apart at a glance in your Downloads folder
  const dateStr     = new Date().toISOString().split('T')[0];
  const schoolCount = (loadData('schools', [])).length;
  const visitCount  = (loadData('visits',  [])).length;
  const filename    = 'ACC-backup-' + dateStr
    + '-' + schoolCount + 'schools'
    + '-' + visitCount  + 'visits.json';

  // Hand off to the shared JSON download helper
  downloadJsonFile(snapshot, filename);

  // Record when this backup was made so the dashboard nudge stays accurate
  saveData('last_backup', new Date().toISOString());
  renderBackupStatus();
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
// DATA IMPORT
// Reads a JSON file exported by exportAllData()
// and restores all acc_ keys into localStorage
// =============================================
function importAllData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const snapshot = JSON.parse(e.target.result);

      // Read counts from the backup so the confirmation tells you what's inside
      const importSchools = Array.isArray(snapshot['acc_schools']) ? snapshot['acc_schools'].length : '?';
      const importVisits  = Array.isArray(snapshot['acc_visits'])  ? snapshot['acc_visits'].length  : '?';

      // Try to pull the date from the filename (ACC-backup-2026-07-18-...)
      const dateMatch = file.name.match(/(\d{4}-\d{2}-\d{2})/);
      const dateLabel = dateMatch ? ' from ' + dateMatch[1] : '';

      const confirmMsg = 'This backup' + dateLabel + ' contains:\n'
        + '  - ' + importSchools + ' schools\n'
        + '  - ' + importVisits  + ' visits\n\n'
        + 'Import and replace all your current data?';

      // Confirm before overwriting - this replaces everything
      if (!confirm(confirmMsg)) {
        event.target.value = '';
        return;
      }

      // Write each key back to localStorage.
      // Only keys starting with acc_ are restored - anything else in the
      // file is ignored so a wrong or tampered file cannot write junk
      // into browser storage.
      Object.keys(snapshot).forEach(function(key) {
        if (key.startsWith('acc_')) {
          localStorage.setItem(key, JSON.stringify(snapshot[key]));
        }
      });

      // Reset the file input so the same file can be imported again if needed
      event.target.value = '';

      // Refresh the dashboard to reflect the restored data
      updateDashboardStats();
      alert('Import successful! Your data has been restored.');
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

// Run the search and render results
function runGlobalSearch(q) {
  var resultsEl = document.getElementById('global-search-results');
  if (!resultsEl) return;

  var query = (q || '').trim().toLowerCase();
  if (!query) { resultsEl.innerHTML = ''; return; }

  var schools    = loadData('schools',    []);
  var visits     = loadData('visits',     []);
  var colleagues = loadData('colleagues', []);
  var counties   = loadData('counties',   []);

  // --- Search schools ---
  var schoolHits = schools.filter(function(s) {
    return (
      s.name.toLowerCase().includes(query) ||
      (s.address        || '').toLowerCase().includes(query) ||
      (s.contact        || '').toLowerCase().includes(query) ||
      (s.contactEmail   || '').toLowerCase().includes(query) ||
      (s.notes          || '').toLowerCase().includes(query)
    );
  });

  // --- Search visits ---
  var visitHits = visits.filter(function(v) {
    var school = schools.find(function(s) { return s.id === v.schoolId; });
    var schoolName = school ? school.name : (v.schoolName || '');
    return (
      schoolName.toLowerCase().includes(query) ||
      (v.title            || '').toLowerCase().includes(query) ||
      (v.commonQuestions  || '').toLowerCase().includes(query) ||
      (v.newQuestions     || '').toLowerCase().includes(query) ||
      (v.nextTimeNotes    || '').toLowerCase().includes(query)
    );
  });

  // --- Search colleagues ---
  var colleagueHits = colleagues.filter(function(c) {
    return (
      (c.name        || '').toLowerCase().includes(query) ||
      (c.institution || '').toLowerCase().includes(query) ||
      (c.email       || '').toLowerCase().includes(query) ||
      (c.notes       || '').toLowerCase().includes(query)
    );
  });

  var totalHits = schoolHits.length + visitHits.length + colleagueHits.length;

  if (totalHits === 0) {
    // Escape the query so typed quotes or angle brackets cannot break the page
    resultsEl.innerHTML = '<p class="gs-no-results">No results for "' + escapeHtml(q) + '"</p>';
    return;
  }

  var html = '';

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

  // Visit results
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

  // Colleague results
  if (colleagueHits.length > 0) {
    html += '<div class="gs-section-label">Colleagues</div>';
    html += colleagueHits.map(function(c) {
      return `
        <div class="gs-result" onclick="closeGlobalSearch(); navigateTo('rolodex')">
          <span class="gs-result-icon">&#128100;</span>
          <div class="gs-result-text">
            <span class="gs-result-name">${escapeHtml(c.name || 'Unnamed')}</span>
            ${c.institution ? `<span class="gs-result-sub">${escapeHtml(c.institution)}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  resultsEl.innerHTML = html;
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
