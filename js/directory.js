// =============================================
// ACC - School Directory
// County pills -> Schools list -> School detail
// =============================================

// Tracks which view is active: 'counties', 'schools', 'detail'
let dirView        = 'counties';
let activeCountyId = null;   // county being viewed in schools view
let activeSchoolId = null;   // school being viewed in detail view

// Collapse state for the By Region view.
// Keyed by region key or county id - true = expanded, false/missing = collapsed.
// Persists while the session is open so toggling survives a search re-render.
let regionOpenState = {};
let countyOpenState = {};

// =============================================
// DATA HELPERS
// =============================================
function getCounties() {
  return loadData('counties', [
    { id: 'c1', name: 'East TN',    notes: '' },
    { id: 'c2', name: 'Crockett',   notes: '' },
    { id: 'c3', name: 'Montgomery', notes: '' },
    { id: 'c4', name: 'Gibson',     notes: '' },
  ]);
}

function saveCounties(counties) {
  saveData('counties', counties);
}

function getSchools() {
  return loadData('schools', []);
}

function saveSchools(schools) {
  saveData('schools', schools);
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// =============================================
// ADDRESS HELPERS
// Builds and parses the standardized address format
// used for geocoding: "Street, City, TN ZIP"
// =============================================

// Combines street, city, and zip into the geocoder-friendly format.
// Always uses TN as the state since Sol only works in Tennessee.
// Returns an empty string if no fields are filled in.
function buildAddress(street, city, zip) {
  const parts = [street, city ? city + ', TN' : '', zip].filter(Boolean);
  if (!street && !city && !zip) return '';
  return [street, city, 'TN', zip].filter(Boolean).join(', ').replace(', TN,', ', TN');
}

// Parses a stored address string back into its parts for form pre-filling.
// Handles the format "Street, City, TN ZIP"
function parseAddress(address) {
  if (!address) return { street: '', city: '', zip: '' };
  // Split on comma+space
  const parts = address.split(',').map(function(p) { return p.trim(); });
  // Format: ["Street", "City", "TN ZIP"] or ["Street", "City", "TN", "ZIP"]
  const street = parts[0] || '';
  const city   = parts[1] || '';
  // Last part may be "TN 38330" or just the zip
  const last   = parts[parts.length - 1] || '';
  const zip    = last.replace(/^TN\s*/i, '').trim();
  return { street: street, city: city, zip: zip };
}

// =============================================
// TOP-LEVEL ROUTER
// Decides which view to render
// =============================================
function renderDirectory() {
  if (dirView === 'counties') renderCountyPills();
  if (dirView === 'schools')  renderSchoolsList(activeCountyId);
  if (dirView === 'detail')   renderSchoolDetail(activeSchoolId);
}

// =============================================
// VIEW 1 - COUNTY PILLS
// Compact pill per county, hover shows primaries
// click navigates into that county's schools
// =============================================
function renderCountyPills() {
  const container = document.getElementById('directory-content');
  if (!container) return;

  const counties = getCounties();
  const schools  = getSchools();

  // Show the controls bar
  showDirectoryControls(true);

  if (counties.length === 0) {
    container.innerHTML = '<p class="empty-state" style="padding:40px; text-align:center;">No counties yet. Add one to get started.</p>';
    return;
  }

  const REGION_LABELS = { 'West TN': 'West TN', 'Middle TN': 'Middle TN', 'East TN': 'East TN' };

  // Always sort A-Z so the grid is predictable
  const sorted = counties.slice().sort(function(a, b) { return a.name.localeCompare(b.name); });

  container.innerHTML = '<div class="county-pill-grid">' +
    sorted.map(function(county) {
      const countySchools  = schools.filter(function(s) { return s.countyId === county.id; });
      const primarySchools = countySchools.filter(function(s) { return s.priority === 'Primary'; });
      const initials       = county.name.trim().split(' ').map(function(w) { return w[0]; }).join('').toUpperCase().slice(0, 2);
      const regionTag      = REGION_LABELS[county.region] || '';

      const primaryPopup = primarySchools.length > 0
        ? primarySchools.map(function(s) {
            return `<span class="popup-primary-school" onclick="event.stopPropagation(); openSchoolDetail('${s.id}')">&#11088; ${s.name}</span>`;
          }).join('')
        : '<span class="popup-no-primary">No primary schools yet</span>';

      return `
        <div class="county-pill" id="county-pill-${county.id}" data-county-name="${county.name.toLowerCase()}">
          <div class="county-pill-inner" onclick="openCountyView('${county.id}')">
            <div class="county-avatar">${initials}</div>
            <div class="county-pill-label-stack">
              <span class="county-pill-name">${county.name}</span>
              ${regionTag ? `<span class="county-pill-region-tag">${regionTag}</span>` : ''}
            </div>
            <span class="county-pill-count">${countySchools.length}</span>
          </div>

          <!-- Hover popup showing primary schools and edit/delete actions -->
          <div class="county-popup">
            <p class="popup-label">Primary Schools</p>
            <div class="popup-primaries">${primaryPopup}</div>
            <div class="county-popup-actions">
              <button class="btn-icon" onclick="event.stopPropagation(); openEditCounty('${county.id}')">&#9998; Edit</button>
              <button class="btn-icon btn-icon-danger" onclick="event.stopPropagation(); confirmDeleteCounty('${county.id}')">&#128465; Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join('') +
  '</div>';
}

// =============================================
// VIEW 2 - SCHOOLS LIST
// All schools inside one county, with back button
// =============================================
function openCountyView(countyId) {
  dirView        = 'schools';
  activeCountyId = countyId;
  renderDirectory();
}

function renderSchoolsList(countyId) {
  const container = document.getElementById('directory-content');
  if (!container) return;

  const counties      = getCounties();
  const county        = counties.find(c => c.id === countyId);
  const schools       = getSchools();
  // Sort schools A-Z within the county view
  const countySchools = schools
    .filter(s => s.countyId === countyId)
    .sort(function(a, b) { return a.name.localeCompare(b.name); });

  // Hide the top controls bar (search/add buttons) in this view
  showDirectoryControls(false);

  container.innerHTML = `
    <!-- Back button and county title -->
    <div class="view-header">
      <button class="btn btn-ghost back-btn" onclick="backToCounties()">&#8592; Back to Counties</button>
      <div class="view-title-row">
        <h2 class="view-county-title">${county ? county.name + ' County' : 'County'}</h2>
        <button class="btn btn-accent" onclick="openAddSchool('${countyId}')">+ Add School</button>
        ${county && county.notes ? `<button class="btn btn-ghost" onclick="toggleInlineNotes('county-inline-notes')">&#128221; Notes</button>` : ''}
        <button class="btn btn-ghost" onclick="openEditCounty('${countyId}')">&#9998; Edit County</button>
      </div>
      ${county && county.notes ? `
        <div id="county-inline-notes" class="inline-notes" style="display:none;">
          <strong>County Notes:</strong> ${county.notes}
        </div>` : ''}
    </div>

    <!-- Schools grid -->
    <div class="schools-pill-grid">
      ${countySchools.length === 0
        ? '<p class="empty-state" style="padding:40px; text-align:center;">No schools in this county yet. Add one above.</p>'
        : countySchools.map(s => renderSchoolPill(s)).join('')
      }
    </div>
  `;
}

// Renders one school as a pill in the schools list view
function renderSchoolPill(school) {
  const priorityClass = {
    'Primary':   'priority-primary',
    'Secondary': 'priority-secondary',
    'Tertiary':  'priority-tertiary',
  }[school.priority] || '';

  return `
    <div class="school-pill">
      <span class="priority-badge ${priorityClass}">${school.priority}</span>
      <span class="school-pill-name" onclick="openSchoolDetail('${school.id}')">${school.name}</span>
      <div class="school-pill-actions">
        <button class="btn-icon" onclick="openEditSchool('${school.id}')">&#9998;</button>
        <button class="btn-icon btn-icon-danger" onclick="confirmDeleteSchool('${school.id}')">&#128465;</button>
      </div>
    </div>
  `;
}

// =============================================
// VIEW 3 - SCHOOL DETAIL
// Full info page for one school
// =============================================
function openSchoolDetail(schoolId) {
  const schools = getSchools();
  const school  = schools.find(s => s.id === schoolId);
  if (!school) return;

  dirView        = 'detail';
  activeSchoolId = schoolId;
  // Always set the county so the back button knows where to return
  activeCountyId = school.countyId;
  renderDirectory();
}

function renderSchoolDetail(schoolId) {
  const container = document.getElementById('directory-content');
  if (!container) return;

  const schools  = getSchools();
  const school   = schools.find(s => s.id === schoolId);
  if (!school) { backToCounties(); return; }

  const counties = getCounties();
  const county   = counties.find(c => c.id === school.countyId);

  const priorityClass = {
    'Primary':   'priority-primary',
    'Secondary': 'priority-secondary',
    'Tertiary':  'priority-tertiary',
  }[school.priority] || '';

  // Compute visit stats for this school
  const allVisits    = loadData('visits', []);
  const schoolVisits = allVisits.filter(function(v) { return v.schoolId === school.id; });
  const visitCount   = schoolVisits.length;
  const lastVisit    = schoolVisits.slice().sort(function(a, b) { return new Date(b.date) - new Date(a.date); })[0];
  const lastVisitDate = lastVisit ? new Date(lastVisit.date) : null;
  const daysSince = lastVisitDate
    ? Math.floor((Date.now() - new Date(lastVisitDate.getTime() + lastVisitDate.getTimezoneOffset() * 60000)) / 86400000)
    : null;
  const lastVisitStr = lastVisitDate
    ? new Date(lastVisitDate.getTime() + lastVisitDate.getTimezoneOffset() * 60000)
        .toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Never';
  const overdueClass = daysSince !== null && daysSince > 60 ? 'svs-overdue' : '';

  showDirectoryControls(false);

  container.innerHTML = `
    <div class="view-header">
      <button class="btn btn-ghost back-btn" onclick="backToSchools()">&#8592; Back to ${county ? county.name : 'County'}</button>
    </div>

    <!-- Outer row: info card on the left, map panel on the right -->
    <div class="school-detail-outer">

      <div class="school-detail-card">
        <div class="school-detail-header">
          <div>
            <span class="priority-badge ${priorityClass}" style="margin-bottom:8px; display:inline-block;">${school.priority}</span>
            <h2 class="school-detail-name">${school.name}</h2>
            <p class="school-detail-county">${county ? county.name + ' County' : ''}</p>
          </div>
          <div class="school-detail-actions">
            <button class="btn btn-ghost" onclick="openEditSchool('${school.id}')">&#9998; Edit School</button>
            <button class="btn btn-danger" onclick="confirmDeleteSchool('${school.id}')">&#128465; Delete</button>
          </div>
        </div>

        <!-- Visit stats bar -->
        <div class="school-visit-stats-bar">
          <div class="svs-item">
            <span class="svs-value">${visitCount}</span>
            <span class="svs-label">Total Visits</span>
          </div>
          <div class="svs-divider"></div>
          <div class="svs-item">
            <span class="svs-value">${lastVisitStr}</span>
            <span class="svs-label">Last Visit</span>
          </div>
          <div class="svs-divider"></div>
          <div class="svs-item">
            <span class="svs-value ${overdueClass}">${daysSince !== null ? daysSince + 'd ago' : '-'}</span>
            <span class="svs-label">Days Since</span>
          </div>
        </div>

        <div class="detail-fields">
          <div class="detail-field">
            <span class="detail-label">Address</span>
            <span class="detail-value">${school.address || 'Not on file'}</span>
          </div>
          <div class="detail-field">
            <span class="detail-label">Contact Name</span>
            <span class="detail-value">${school.contact || 'Not on file'}</span>
          </div>
          <div class="detail-field">
            <span class="detail-label">Contact Email</span>
            <span class="detail-value">
              ${school.contactEmail
                ? `<span class="copy-value" onclick="copyToClipboard('${school.contactEmail}', this)">&#9993; ${school.contactEmail}</span>`
                : 'Not on file'}
            </span>
          </div>
          <div class="detail-field">
            <span class="detail-label">Contact Phone</span>
            <span class="detail-value">
              ${school.contactPhone
                ? `<span class="copy-value" onclick="copyToClipboard('${school.contactPhone}', this)">&#128222; ${school.contactPhone}</span>`
                : 'Not on file'}
            </span>
          </div>
        </div>
      </div>

      <!-- Map panel - only shown when the school has an address -->
      ${school.address ? `
        <div class="school-detail-map-wrap">
          <div id="school-detail-map"></div>
          <p class="school-detail-map-note">&#128205; ${school.address} &nbsp;&middot;&nbsp; <span style="opacity:0.6;">Drag pin to correct position</span></p>
        </div>
      ` : ''}

    </div>

    <!-- Visit history for this school -->
    <div class="school-visit-history">
      <div class="school-visit-history-header">
        <h3>Visit History</h3>
        <button class="btn btn-accent btn-sm" onclick="openLogVisit('${school.id}')">+ Log Visit</button>
      </div>
      ${renderSchoolVisitHistory(school.id)}
    </div>
  `;

  // After the HTML is in the DOM, initialize the mini-map if there's an address
  if (school.address) {
    setTimeout(function() {
      initSchoolDetailMap(school.address);
    }, 0);
  }
}

// =============================================
// SCHOOL VISIT HISTORY
// Renders all visit logs for a school inside the school detail page.
// Each card navigates to the full visit detail in the Visit Log.
// =============================================
function renderSchoolVisitHistory(schoolId) {
  const visits = getVisits().filter(function(v) { return v.schoolId === schoolId; });

  if (visits.length === 0) {
    return '<p class="empty-state">No visits logged for this school yet.</p>';
  }

  // Most recent first
  const sorted = visits.slice().sort(function(a, b) { return new Date(b.date) - new Date(a.date); });

  return sorted.map(function(v) {
    const d       = new Date(v.date);
    // Offset fix - date strings parse as UTC midnight, shift to local
    const dateStr = new Date(d.getTime() + d.getTimezoneOffset() * 60000)
      .toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const moodIcon   = { 'Great': '&#128512;', 'Good': '&#128578;', 'Okay': '&#128528;', 'Tough': '&#128533;' }[v.mood] || '&#128528;';
    const returnFlag = v.returnVisit ? '<span class="return-flag">&#128260; Return</span>' : '';
    return `
      <div class="school-visit-card" onclick="openVisitFromDirectory('${v.id}')">
        <div class="school-visit-card-left">
          <span class="visit-mood-icon">${moodIcon}</span>
          <div class="school-visit-card-info">
            <span class="school-visit-card-title">${v.title || dateStr}</span>
            ${v.title ? `<span class="school-visit-card-date">${dateStr}</span>` : ''}
            <span class="school-visit-card-meta">~${v.studentCount || 0} students talked to</span>
          </div>
        </div>
        <div class="school-visit-card-right">
          ${returnFlag}
          <span class="visit-chevron">&#8250;</span>
        </div>
      </div>
    `;
  }).join('');
}

// Navigates to the Visit Log page and immediately opens that visit's detail
function openVisitFromDirectory(visitId) {
  navigateTo('visits');
  // Small delay to let the visits page render before opening the detail view
  setTimeout(function() {
    openVisitDetail(visitId);
  }, 50);
}

// =============================================
// BACK NAVIGATION
// =============================================
function backToCounties() {
  dirView        = 'counties';
  activeCountyId = null;
  activeSchoolId = null;
  renderDirectory();
}

function backToSchools() {
  dirView        = 'schools';
  activeSchoolId = null;
  renderDirectory();
}

// =============================================
// SHOW/HIDE CONTROLS BAR
// The search + add buttons are only shown on the county pills view
// =============================================
function showDirectoryControls(visible) {
  const ctrl = document.querySelector('.directory-controls');
  if (ctrl) ctrl.style.display = visible ? '' : 'none';

  // When navigating away from the county list, always go back to list view
  // so the map doesn't linger behind a county/school detail screen
  if (!visible) {
    const mapWrap = document.getElementById('directory-map-wrap');
    const content = document.getElementById('directory-content');
    if (mapWrap) mapWrap.style.display = 'none';
    if (content) content.style.display = '';

    // Reset toggle button states - A-Z is the default, all others off
    const alphaBtn  = document.getElementById('dir-alpha-btn');
    const mapBtn    = document.getElementById('dir-map-btn');
    const regionBtn = document.getElementById('dir-region-btn');
    if (alphaBtn)  alphaBtn.classList.add('active-toggle');
    if (mapBtn)    mapBtn.classList.remove('active-toggle');
    if (regionBtn) regionBtn.classList.remove('active-toggle');
  }
}

// =============================================
// INLINE NOTES TOGGLE (schools view)
// =============================================
function toggleInlineNotes(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// =============================================
// SEARCH FILTER
// Works across all four directory tabs.
// Detects which tab is active and delegates accordingly.
// =============================================
function filterDirectory(term) {
  const q = term.trim().toLowerCase();

  const alphaBtn  = document.getElementById('dir-alpha-btn');
  const regionBtn = document.getElementById('dir-region-btn');
  const mapBtn    = document.getElementById('dir-map-btn');

  if (alphaBtn && alphaBtn.classList.contains('active-toggle')) {
    // A-Z tab - re-render with filter
    renderAlphaCountyView(q);
  } else if (regionBtn && regionBtn.classList.contains('active-toggle')) {
    // By Region tab - re-render with filter
    renderRegionView(q);
  } else if (mapBtn && mapBtn.classList.contains('active-toggle')) {
    // Map tab - search doesn't apply to the Leaflet map; no-op
  } else {
    // List tab (county pills) - show/hide pills by county name
    const pills = document.querySelectorAll('.county-pill');
    pills.forEach(function(pill) {
      const name  = pill.dataset.countyName || '';
      const match = !q || name.includes(q);
      pill.style.display = match ? '' : 'none';
    });
  }
}

// =============================================
// MODAL SYSTEM
// =============================================
function openModal(title, bodyHtml, onSave) {
  const existing = document.getElementById('acc-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'acc-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h2>${title}</h2>
        <button class="close-modal" onclick="closeModal()">&#10005;</button>
      </div>
      <div class="modal-body">
        ${bodyHtml}
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
        <button class="btn btn-accent" id="modal-save-btn">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById('modal-save-btn').addEventListener('click', onSave);

  modal._ctrlEnterHandler = function(e) {
    if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); onSave(); }
  };
  document.addEventListener('keydown', modal._ctrlEnterHandler);

  modal.addEventListener('click', function(e) {
    if (e.target === modal) closeModal();
  });
}

function closeModal() {
  const modal = document.getElementById('acc-modal');
  if (!modal) return;
  if (modal._ctrlEnterHandler) document.removeEventListener('keydown', modal._ctrlEnterHandler);
  modal.remove();
}

// =============================================
// GLOBAL ADD SCHOOL (from top controls)
// =============================================
function openAddSchoolGlobal() {
  const counties = getCounties();
  if (counties.length === 0) { alert('Add a county first.'); return; }
  openAddSchool(null);
}

// =============================================
// ADD SCHOOL FORM
// =============================================
function openAddSchool(countyId) {
  const counties = getCounties();
  const county   = countyId ? counties.find(c => c.id === countyId) : null;

  const countyField = county
    ? `<p class="form-note">Adding to: <strong>${county.name} County</strong></p>`
    : `<div class="form-group">
        <label>County <span class="required">*</span></label>
        <select id="f-county">
          <option value="">-- Select a county --</option>
          ${counties.map(c => `<option value="${c.id}">${c.name} County</option>`).join('')}
        </select>
       </div>`;

  const body = `
    <div class="form-group">
      <label>School Name <span class="required">*</span></label>
      <input type="text" id="f-name" placeholder="e.g. Oak Ridge High School" />
    </div>
    ${countyField}
    <div class="form-group">
      <label>Street Address</label>
      <input type="text" id="f-street" placeholder="e.g. 130 Trenton Hwy" />
    </div>
    <div class="address-city-zip-row">
      <div class="form-group" style="flex:1;">
        <label>City</label>
        <input type="text" id="f-city" placeholder="e.g. Dyer" />
      </div>
      <div class="form-group address-state-box">
        <label>State</label>
        <input type="text" value="TN" disabled style="opacity:0.5; cursor:not-allowed;" />
      </div>
      <div class="form-group" style="flex:0 0 90px;">
        <label>ZIP</label>
        <input type="text" id="f-zip" placeholder="38330" maxlength="5" />
      </div>
    </div>
    <div class="form-group">
      <label>Priority Level <span class="required">*</span></label>
      <select id="f-priority">
        <option value="Primary">Primary</option>
        <option value="Secondary">Secondary</option>
        <option value="Tertiary">Tertiary</option>
      </select>
    </div>
    <div class="form-group">
      <label>School Contact Name</label>
      <input type="text" id="f-contact" placeholder="e.g. Jane Smith" />
    </div>
    <div class="form-group">
      <label>Contact Email</label>
      <input type="email" id="f-contact-email" placeholder="jsmith@school.edu" />
    </div>
    <div class="form-group">
      <label>Contact Phone</label>
      <input type="tel" id="f-contact-phone" placeholder="(555) 000-0000" />
    </div>
  `;

  openModal('Add School', body, function() {
    const name = document.getElementById('f-name').value.trim();
    if (!name) { alert('School name is required.'); return; }

    const selectedCountyId = countyId || document.getElementById('f-county')?.value;
    if (!selectedCountyId) { alert('Please select a county.'); return; }

    const schools = getSchools();
    schools.push({
      id:           makeId(),
      countyId:     selectedCountyId,
      name:         name,
      address:      buildAddress(
                      document.getElementById('f-street').value.trim(),
                      document.getElementById('f-city').value.trim(),
                      document.getElementById('f-zip').value.trim()
                    ),
      priority:     document.getElementById('f-priority').value,
      contact:      document.getElementById('f-contact').value.trim(),
      contactEmail: document.getElementById('f-contact-email').value.trim(),
      contactPhone: document.getElementById('f-contact-phone').value.trim(),
    });

    saveSchools(schools);
    closeModal();
    renderDirectory();
    updateDashboardStats();
  });
}

// =============================================
// EDIT SCHOOL FORM
// =============================================
function openEditSchool(schoolId) {
  const schools = getSchools();
  const school  = schools.find(s => s.id === schoolId);
  if (!school) return;

  // Parse the stored address back into street / city / zip for pre-filling
  const parsedAddr = parseAddress(school.address || '');

  const body = `
    <div class="form-group">
      <label>School Name <span class="required">*</span></label>
      <input type="text" id="f-name" value="${school.name}" />
    </div>
    <div class="form-group">
      <label>Street Address</label>
      <input type="text" id="f-street" value="${parsedAddr.street}" placeholder="e.g. 130 Trenton Hwy" />
    </div>
    <div class="address-city-zip-row">
      <div class="form-group" style="flex:1;">
        <label>City</label>
        <input type="text" id="f-city" value="${parsedAddr.city}" placeholder="e.g. Dyer" />
      </div>
      <div class="form-group address-state-box">
        <label>State</label>
        <input type="text" value="TN" disabled style="opacity:0.5; cursor:not-allowed;" />
      </div>
      <div class="form-group" style="flex:0 0 90px;">
        <label>ZIP</label>
        <input type="text" id="f-zip" value="${parsedAddr.zip}" placeholder="38330" maxlength="5" />
      </div>
    </div>
    <div class="form-group">
      <label>Priority Level</label>
      <select id="f-priority">
        <option value="Primary"   ${school.priority === 'Primary'   ? 'selected' : ''}>Primary</option>
        <option value="Secondary" ${school.priority === 'Secondary' ? 'selected' : ''}>Secondary</option>
        <option value="Tertiary"  ${school.priority === 'Tertiary'  ? 'selected' : ''}>Tertiary</option>
      </select>
    </div>
    <div class="form-group">
      <label>School Contact Name</label>
      <input type="text" id="f-contact" value="${school.contact || ''}" />
    </div>
    <div class="form-group">
      <label>Contact Email</label>
      <input type="email" id="f-contact-email" value="${school.contactEmail || ''}" />
    </div>
    <div class="form-group">
      <label>Contact Phone</label>
      <input type="tel" id="f-contact-phone" value="${school.contactPhone || ''}" />
    </div>
  `;

  openModal('Edit School', body, function() {
    const name = document.getElementById('f-name').value.trim();
    if (!name) { alert('School name is required.'); return; }

    const idx = schools.findIndex(s => s.id === schoolId);
    schools[idx] = {
      ...schools[idx],
      name:         name,
      address:      buildAddress(
                      document.getElementById('f-street').value.trim(),
                      document.getElementById('f-city').value.trim(),
                      document.getElementById('f-zip').value.trim()
                    ),
      priority:     document.getElementById('f-priority').value,
      contact:      document.getElementById('f-contact').value.trim(),
      contactEmail: document.getElementById('f-contact-email').value.trim(),
      contactPhone: document.getElementById('f-contact-phone').value.trim(),
    };

    saveSchools(schools);
    closeModal();
    renderDirectory();
    updateDashboardStats();
  });
}

// =============================================
// DELETE SCHOOL
// =============================================
function confirmDeleteSchool(schoolId) {
  const schools = getSchools();
  const school  = schools.find(s => s.id === schoolId);
  if (!school) return;
  if (!confirm(`Remove "${school.name}"? This cannot be undone.`)) return;

  saveSchools(schools.filter(s => s.id !== schoolId));
  // If on detail view, go back to schools list after deleting
  if (dirView === 'detail') backToSchools();
  else renderDirectory();
  updateDashboardStats();
}

// =============================================
// ADD COUNTY FORM
// =============================================
function openAddCounty() {
  const body = `
    <div class="form-group">
      <label>County Name <span class="required">*</span></label>
      <input type="text" id="f-county-name" placeholder="e.g. Hamilton" />
    </div>
    <div class="form-group">
      <label>Region</label>
      <select id="f-county-region">
        <option value="">-- Not assigned --</option>
        <option value="West TN">West Tennessee</option>
        <option value="Middle TN">Middle Tennessee</option>
        <option value="East TN">East Tennessee</option>
      </select>
    </div>
    <div class="form-group">
      <label>Notes (optional)</label>
      <textarea id="f-county-notes" rows="3" placeholder="e.g. Exempt from housing rule..."></textarea>
    </div>
  `;

  openModal('Add County', body, function() {
    const name = document.getElementById('f-county-name').value.trim();
    if (!name) { alert('County name is required.'); return; }

    const counties = getCounties();
    counties.push({
      id:     makeId(),
      name:   name,
      region: document.getElementById('f-county-region').value,
      notes:  document.getElementById('f-county-notes').value.trim(),
    });
    saveCounties(counties);
    closeModal();
    renderDirectory();
  });
}

// =============================================
// EDIT COUNTY FORM
// =============================================
function openEditCounty(countyId) {
  const counties = getCounties();
  const county   = counties.find(c => c.id === countyId);
  if (!county) return;

  const body = `
    <div class="form-group">
      <label>County Name <span class="required">*</span></label>
      <input type="text" id="f-county-name" value="${county.name}" />
    </div>
    <div class="form-group">
      <label>Region</label>
      <select id="f-county-region">
        <option value=""           ${!county.region                  ? 'selected' : ''}>-- Not assigned --</option>
        <option value="West TN"   ${county.region === 'West TN'     ? 'selected' : ''}>West Tennessee</option>
        <option value="Middle TN" ${county.region === 'Middle TN'   ? 'selected' : ''}>Middle Tennessee</option>
        <option value="East TN"   ${county.region === 'East TN'     ? 'selected' : ''}>East Tennessee</option>
      </select>
    </div>
    <div class="form-group">
      <label>Notes</label>
      <textarea id="f-county-notes" rows="3">${county.notes || ''}</textarea>
    </div>
  `;

  openModal('Edit County', body, function() {
    const name = document.getElementById('f-county-name').value.trim();
    if (!name) { alert('County name is required.'); return; }

    const idx = counties.findIndex(c => c.id === countyId);
    counties[idx] = {
      ...counties[idx],
      name:   name,
      region: document.getElementById('f-county-region').value,
      notes:  document.getElementById('f-county-notes').value.trim(),
    };
    saveCounties(counties);
    closeModal();
    renderDirectory();
  });
}

// =============================================
// DELETE COUNTY
// =============================================
function confirmDeleteCounty(countyId) {
  const counties      = getCounties();
  const county        = counties.find(c => c.id === countyId);
  const countySchools = getSchools().filter(s => s.countyId === countyId);

  if (countySchools.length > 0) {
    alert(`Cannot delete "${county.name}" - it still has ${countySchools.length} school(s). Remove the schools first.`);
    return;
  }
  if (!confirm(`Delete "${county.name} County"? This cannot be undone.`)) return;

  saveCounties(counties.filter(c => c.id !== countyId));
  renderDirectory();
}

// =============================================
// A-Z COUNTY VIEW
// Shows all counties sorted alphabetically as a
// clean list with school count and region badge.
// Click any row to open that county's schools.
// =============================================
function showDirectoryAlpha() {
  const content   = document.getElementById('directory-content');
  const mapWrap   = document.getElementById('directory-map-wrap');
  const alphaBtn  = document.getElementById('dir-alpha-btn');
  const mapBtn    = document.getElementById('dir-map-btn');
  const regionBtn = document.getElementById('dir-region-btn');

  if (content)   content.style.display = '';
  if (mapWrap)   mapWrap.style.display = 'none';
  if (alphaBtn)  alphaBtn.classList.add('active-toggle');
  if (mapBtn)    mapBtn.classList.remove('active-toggle');
  if (regionBtn) regionBtn.classList.remove('active-toggle');

  // renderCountyPills is now always A-Z sorted - A-Z tab IS the county pills view
  renderCountyPills();
}

function renderAlphaCountyView(q) {
  // The county pills view IS now the A-Z view (renderCountyPills sorts A-Z).
  // Re-render pills fresh then apply the search filter via DOM show/hide.
  renderCountyPills();
  if (q) {
    document.querySelectorAll('.county-pill').forEach(function(pill) {
      const name  = pill.dataset.countyName || '';
      pill.style.display = name.includes(q) ? '' : 'none';
    });
  }
}

// =============================================
// REGION VIEW COLLAPSE TOGGLES
// Each click flips the open/closed state and re-renders.
// The search input value is preserved across re-renders.
// =============================================
function toggleRegion(regionKey) {
  regionOpenState[regionKey] = !regionOpenState[regionKey];
  const q = (document.getElementById('directory-search') || {}).value || '';
  renderRegionView(q.trim().toLowerCase());
}

function toggleCounty(countyId) {
  countyOpenState[countyId] = !countyOpenState[countyId];
  const q = (document.getElementById('directory-search') || {}).value || '';
  renderRegionView(q.trim().toLowerCase());
}

// =============================================
// REGION VIEW
// Groups schools by TN region with collapsible regions and counties.
// Regions default collapsed; search auto-expands matching items.
// =============================================
function showDirectoryRegion() {
  const content   = document.getElementById('directory-content');
  const mapWrap   = document.getElementById('directory-map-wrap');
  const listBtn   = document.getElementById('dir-list-btn');
  const mapBtn    = document.getElementById('dir-map-btn');
  const regionBtn = document.getElementById('dir-region-btn');

  if (content)   content.style.display  = '';
  if (mapWrap)   mapWrap.style.display  = 'none';
  if (listBtn)   listBtn.classList.remove('active-toggle');
  if (mapBtn)    mapBtn.classList.remove('active-toggle');
  if (regionBtn) regionBtn.classList.add('active-toggle');

  renderRegionView();
}

function renderRegionView(q) {
  const container = document.getElementById('directory-content');
  if (!container) return;

  showDirectoryControls(true);

  const filterTerm  = (q || '').toLowerCase();
  const isFiltering = !!filterTerm;
  const counties    = getCounties();
  const schools     = getSchools();

  if (counties.length === 0) {
    container.innerHTML = '<p class="empty-state" style="padding:40px; text-align:center;">No counties yet. Add one to get started.</p>';
    return;
  }

  const REGIONS = [
    { key: 'West TN',   label: 'West Tennessee' },
    { key: 'Middle TN', label: 'Middle Tennessee' },
    { key: 'East TN',   label: 'East Tennessee' },
  ];

  // Helper: builds the county blocks for a slice of counties.
  // Returns { html, schoolCount, countyCount }.
  function buildCountyBlocks(regionCounties) {
    let countyBlocksHtml = '';
    let totalSchools     = 0;
    let visibleCounties  = 0;

    regionCounties
      .slice()
      .sort(function(a, b) { return a.name.localeCompare(b.name); })
      .forEach(function(county) {
        const countyNameMatches = isFiltering && county.name.toLowerCase().includes(filterTerm);
        let countySchools = schools
          .filter(function(s) { return s.countyId === county.id; })
          .sort(function(a, b) { return a.name.localeCompare(b.name); });

        // When filtering: if county name matches, show all its schools;
        // otherwise only show schools whose names match.
        if (isFiltering && !countyNameMatches) {
          countySchools = countySchools.filter(function(s) {
            return s.name.toLowerCase().includes(filterTerm);
          });
          if (countySchools.length === 0) return; // skip - nothing matches
        }

        visibleCounties++;
        totalSchools += countySchools.length;

        // County is open if filtering (auto-expand) OR the user opened it
        const countyOpen  = isFiltering || !!countyOpenState[county.id];
        const countyArrow = countyOpen ? '&#9660;' : '&#9654;';
        const initials    = county.name.trim().split(' ').map(function(w) { return w[0]; }).join('').toUpperCase().slice(0, 2);

        const schoolChips = countySchools.length === 0
          ? '<p class="empty-state" style="padding:12px 16px; font-size:0.82rem;">No schools yet.</p>'
          : '<div class="region-school-chips">' +
            countySchools.map(function(s) {
              const priorityClass = {
                'Primary':   'priority-primary',
                'Secondary': 'priority-secondary',
                'Tertiary':  'priority-tertiary',
              }[s.priority] || '';
              return `
                <div class="region-school-chip" onclick="openSchoolDetail('${s.id}')">
                  <span class="priority-badge ${priorityClass}">${s.priority}</span>
                  <span class="region-chip-name">${s.name}</span>
                </div>
              `;
            }).join('') +
            '</div>';

        countyBlocksHtml += `
          <div class="region-county-chip-wrap">
            <div class="county-pill-inner region-county-pill" onclick="toggleCounty('${county.id}')">
              <div class="county-avatar">${initials}</div>
              <span class="county-pill-name">${county.name}</span>
              <span class="county-pill-count">${countySchools.length}</span>
              <span class="region-county-arrow">${countyArrow}</span>
            </div>
            ${countyOpen ? `<div class="region-county-schools">${schoolChips}</div>` : ''}
          </div>
        `;
      });

    return { html: countyBlocksHtml, schoolCount: totalSchools, countyCount: visibleCounties };
  }

  let html = '<div class="region-view">';

  // Build each named region
  REGIONS.forEach(function(region) {
    const regionCounties = counties.filter(function(c) { return c.region === region.key; });
    if (regionCounties.length === 0) return;

    const result = buildCountyBlocks(regionCounties);
    if (isFiltering && result.countyCount === 0) return; // nothing matched - skip region

    // Region is open if filtering (auto-expand) OR the user opened it
    const regionOpen  = isFiltering || !!regionOpenState[region.key];
    const regionArrow = regionOpen ? '&#9660;' : '&#9654;';

    const countySummary = result.countyCount + ' count' + (result.countyCount !== 1 ? 'ies' : 'y');
    const schoolSummary = result.schoolCount + ' school' + (result.schoolCount !== 1 ? 's' : '');

    html += `
      <div class="region-section">
        <div class="region-header region-header-toggle" onclick="toggleRegion('${region.key}')">
          <div class="region-header-left">
            <span class="region-arrow">${regionArrow}</span>
            <span class="region-title">${region.label}</span>
          </div>
          <span class="region-count">${countySummary} &middot; ${schoolSummary}</span>
        </div>
        ${regionOpen ? `<div class="region-county-chip-grid">${result.html}</div>` : ''}
      </div>
    `;
  });

  // Counties with no region assigned
  const unassignedCounties = counties.filter(function(c) { return !c.region; });
  if (unassignedCounties.length > 0) {
    const result = buildCountyBlocks(unassignedCounties);
    if (!isFiltering || result.countyCount > 0) {
      const regionOpen  = isFiltering || !!regionOpenState['unassigned'];
      const regionArrow = regionOpen ? '&#9660;' : '&#9654;';
      const countySummary = result.countyCount + ' count' + (result.countyCount !== 1 ? 'ies' : 'y');
      const schoolSummary = result.schoolCount + ' school' + (result.schoolCount !== 1 ? 's' : '');

      html += `
        <div class="region-section region-section-muted">
          <div class="region-header region-header-toggle" onclick="toggleRegion('unassigned')">
            <div class="region-header-left">
              <span class="region-arrow">${regionArrow}</span>
              <span class="region-title">No Region Assigned</span>
            </div>
            <span class="region-count">${countySummary} &middot; ${schoolSummary}</span>
          </div>
          ${regionOpen ? `<div class="region-county-chip-grid">${result.html}</div>` : ''}
        </div>
      `;
    }
  }

  html += '</div>';

  if (!html.includes('region-section')) {
    html = '<p class="empty-state" style="padding:40px; text-align:center;">No results for "' + q + '".</p>';
  }

  container.innerHTML = html;
}

// =============================================
// INIT DIRECTORY
// =============================================
function initDirectory() {
  dirView = 'counties';
  renderDirectory();
}
