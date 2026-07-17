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

  // Update active state on nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === pageId);
  });

  // Close the sidebar on mobile after navigating
  closeSidebar();

  // Refresh the relevant section whenever the user navigates to it
  if (pageId === 'dashboard') updateDashboardStats();
  if (pageId === 'directory') initDirectory();
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
}

// =============================================
// PRIMARY SCHOOLS SECTION
// Filters schools marked as Primary and renders
// them as quick-access chips on the dashboard
// =============================================
function renderPrimarySchools(schools) {
  const container = document.getElementById('dashboard-primary-schools');
  if (!container) return;

  // Filter down to only Primary-priority schools
  const primaries = schools.filter(s => s.priority === 'Primary');

  if (primaries.length === 0) {
    container.innerHTML = '<p class="empty-state">No primary schools yet. Add schools in the School Directory and mark them as Primary.</p>';
    return;
  }

  // Build a grid of chips, one per primary school
  const html = '<div class="primary-school-list">' +
    primaries.map(s => `
      <div class="primary-school-chip">
        <span>${s.name}</span>
        <span class="chip-county">${s.county}</span>
      </div>
    `).join('') +
  '</div>';

  container.innerHTML = html;
}

// =============================================
// APP INIT
// Runs once when the page loads
// =============================================
function init() {
  // Start on the dashboard
  navigateTo('dashboard');
}

// Start the app when the DOM is ready
document.addEventListener('DOMContentLoaded', init);
