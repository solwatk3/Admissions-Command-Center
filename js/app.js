// =============================================
// ACC - Admissions Command Center
// Main app logic - navigation and shared state
// =============================================

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
          <span class="upcoming-route-name">${r.name}</span>
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
          <span>${s.name}</span>
          <span class="chip-county">${countyName}</span>
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
    return `<div class="return-visit-row"><span>&#128260; ${name}</span><span class="return-visit-date">${date}</span></div>`;
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

  // Build overdue list with days-since already computed
  const overdue = [];
  primaries.forEach(function(school) {
    const schoolVisits = visits.filter(function(v) { return v.schoolId === school.id; });
    let daysSince = null;
    let daysSinceStr = 'Never visited';

    if (schoolVisits.length > 0) {
      const lastDate = new Date(
        schoolVisits.slice().sort(function(a, b) { return new Date(b.date) - new Date(a.date); })[0].date
      );
      daysSince = Math.floor((today - new Date(lastDate.getTime() + lastDate.getTimezoneOffset() * 60000)) / 86400000);
      daysSinceStr = daysSince + ' days ago';
    }

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

  container.innerHTML = sortedCountyIds.map(function(cId) {
    const county   = counties.find(function(c) { return c.id === cId; });
    const items    = grouped[cId];
    const isOpen   = !!overdueCountyOpen[cId];
    const arrow    = isOpen ? '&#9660;' : '&#9654;';
    const label    = county ? county.name + ' County' : 'Unknown County';

    const schoolRows = items.map(function(item) {
      return `
        <div class="overdue-row" onclick="navigateTo('directory'); openSchoolDetail('${item.school.id}')">
          <span class="overdue-school-name">${item.school.name}</span>
          <span class="overdue-badge">${item.daysSinceStr}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="overdue-county-group">
        <div class="overdue-county-header" onclick="toggleOverdueCounty('${cId}')">
          <div class="overdue-county-header-left">
            <span class="overdue-county-arrow">${arrow}</span>
            <span class="overdue-county-name">${label}</span>
          </div>
          <span class="overdue-county-badge">${items.length} school${items.length !== 1 ? 's' : ''}</span>
        </div>
        ${isOpen ? `<div class="overdue-county-schools">${schoolRows}</div>` : ''}
      </div>
    `;
  }).join('');
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

  // Build a filename with today's date so exports are easy to tell apart
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = 'acc-backup-' + dateStr + '.json';

  // Create a temporary download link and click it programmatically
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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

      // Confirm before overwriting - this replaces everything
      if (!confirm('This will replace all your current data with the imported file. Continue?')) {
        event.target.value = '';
        return;
      }

      // Write each key back to localStorage with the acc_ prefix
      Object.keys(snapshot).forEach(function(key) {
        localStorage.setItem(key, JSON.stringify(snapshot[key]));
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
// APP INIT
// Runs once when the page loads
// =============================================
function init() {
  navigateTo('dashboard');
  initHoverSidebar();
  initCalendar();
}

// Start the app when the DOM is ready
document.addEventListener('DOMContentLoaded', init);

// Initialize EmailJS with Sol's public key so route emails can be sent without a dialog
emailjs.init({ publicKey: 'dZZyEPJlPeAooJHfJ' });
