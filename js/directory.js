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
// CONTACT HELPERS
// Schools now store contacts as an array so you can track
// multiple people per school, each with a title/role.
// Older schools used single-contact fields (contact,
// contactEmail, contactPhone). getSchoolContacts() handles
// both formats so no migration script is needed.
// =============================================

// Returns the contacts array for a school, migrating old
// single-contact fields on the fly if the new format isn't present.
function getSchoolContacts(school) {
  if (Array.isArray(school.contacts) && school.contacts.length > 0) {
    return school.contacts;
  }
  // Migrate legacy single-contact fields
  if (school.contact || school.contactEmail || school.contactPhone) {
    return [{
      id:    'legacy',
      title: '',
      name:  school.contact      || '',
      email: school.contactEmail || '',
      phone: school.contactPhone || '',
    }];
  }
  return [];
}

// Returns the HTML for one contact entry row inside the add/edit modal.
// prefill is an optional existing contact object to pre-populate the fields.
function contactRowHtml(prefill) {
  const c = prefill || {};
  return `
    <div class="contact-entry">
      <div class="contact-entry-header">
        <span class="contact-entry-label">Contact</span>
        <button type="button" class="btn-icon btn-icon-danger contact-remove-btn"
          onclick="removeSchoolContact(this)" title="Remove this contact">&#10005;</button>
      </div>
      <input type="hidden" class="c-id" value="${escapeHtml(c.id || makeId())}">
      <div class="form-group">
        <label>Title / Role</label>
        <input type="text" class="c-title" value="${escapeHtml(c.title || '')}"
          placeholder="e.g. Admissions Director, Counselor">
      </div>
      <div class="form-group">
        <label>Name</label>
        <input type="text" class="c-name" value="${escapeHtml(c.name || '')}"
          placeholder="e.g. Jane Smith">
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" class="c-email" value="${escapeHtml(c.email || '')}"
          placeholder="jsmith@school.edu">
      </div>
      <div class="form-group">
        <label>Phone</label>
        <input type="tel" class="c-phone" value="${escapeHtml(c.phone || '')}"
          placeholder="(555) 000-0000">
      </div>
    </div>
  `;
}

// Appends a new contact row to the contacts list inside the modal.
// Called from the "Add Contact" button and from pre-populating the edit form.
function addSchoolContact(prefill) {
  const list = document.getElementById('contacts-list');
  if (!list) return;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = contactRowHtml(prefill);
  list.appendChild(wrapper.firstElementChild);
}

// Removes the contact row that contains the clicked Remove button.
function removeSchoolContact(btn) {
  const entry = btn.closest('.contact-entry');
  if (entry) entry.remove();
}

// Reads all contact rows from the modal and returns a clean array.
// Rows with no name and no email are silently dropped.
function readSchoolContacts() {
  const entries = document.querySelectorAll('#contacts-list .contact-entry');
  return Array.from(entries).map(function(entry) {
    return {
      id:    entry.querySelector('.c-id').value  || makeId(),
      title: entry.querySelector('.c-title').value.trim(),
      name:  entry.querySelector('.c-name').value.trim(),
      email: entry.querySelector('.c-email').value.trim(),
      phone: formatPhone(entry.querySelector('.c-phone').value.trim()),
    };
  }).filter(function(c) { return c.name || c.email; });
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
  // Nothing filled in means no address at all
  if (!street && !city && !zip) return '';
  // Join the filled-in parts with commas, then fix "TN, ZIP" to read "TN ZIP"
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
            return `<span class="popup-primary-school" onclick="event.stopPropagation(); openSchoolDetail('${s.id}')">&#11088; ${escapeHtml(s.name)}</span>`;
          }).join('')
        : '<span class="popup-no-primary">No primary schools yet</span>';

      return `
        <div class="county-pill" id="county-pill-${county.id}" data-county-name="${escapeHtml(county.name.toLowerCase())}">
          <div class="county-pill-inner" onclick="openCountyView('${county.id}')">
            <div class="county-avatar">${initials}</div>
            <div class="county-pill-label-stack">
              <span class="county-pill-name">${escapeHtml(county.name)}</span>
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
        <h2 class="view-county-title">${county ? escapeHtml(county.name) + ' County' : 'County'}</h2>
        <button class="btn btn-accent" onclick="openAddSchool('${countyId}')">+ Add School</button>
        <button class="btn btn-ghost" id="copy-emails-btn" onclick="copyCountyEmails('${countyId}')" title="Copy all contact emails in this county to clipboard">&#9993; Copy All Emails</button>
        ${county && county.notes ? `<button class="btn btn-ghost" onclick="toggleInlineNotes('county-inline-notes')">&#128221; Notes</button>` : ''}
        <button class="btn btn-ghost" onclick="openEditCounty('${countyId}')">&#9998; Edit County</button>
      </div>
      ${county && county.notes ? `
        <div id="county-inline-notes" class="inline-notes" style="display:none;">
          <strong>County Notes:</strong> ${escapeHtml(county.notes)}
        </div>` : ''}
    </div>

    <!-- Search bar for filtering within this county only -->
    <div style="margin-bottom: 16px;">
      <input
        type="text"
        class="directory-search"
        id="county-school-search"
        placeholder="Search schools in ${county ? escapeHtml(county.name) : 'this county'}..."
        oninput="filterCountySchools('${countyId}', this.value)"
        autocomplete="off"
      />
    </div>

    <!-- Schools grid, grouped under A-Z letter headers -->
    <div class="schools-pill-grid">
      ${countySchools.length === 0
        ? '<p class="empty-state" style="padding:40px; text-align:center;">No schools in this county yet. Add one above.</p>'
        : (function() {
            var html = '';
            var currentLetter = '';
            countySchools.forEach(function(s) {
              // Get the first letter of the school name (uppercase, fallback to #)
              var letter = s.name.trim()[0].toUpperCase();
              if (!/[A-Z]/.test(letter)) letter = '#';
              // Insert a letter divider whenever the letter changes
              if (letter !== currentLetter) {
                currentLetter = letter;
                html += '<div class="school-alpha-divider">' + letter + '</div>';
              }
              html += renderSchoolPill(s);
            });
            return html;
          })()
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
      ${school.priority ? `<span class="priority-badge ${priorityClass}">${school.priority}</span>` : ''}
      <span class="school-pill-name" onclick="openSchoolDetail('${school.id}')">${escapeHtml(school.name)}</span>
      <div class="school-pill-actions">
        <button class="btn-icon" onclick="openEditSchool('${school.id}')">&#9998;</button>
        <button class="btn-icon btn-icon-danger" onclick="confirmDeleteSchool('${school.id}')">&#128465;</button>
      </div>
    </div>
  `;
}

// =============================================
// COUNTY SCHOOL SEARCH
// Filters schools within a single county view.
// Only re-renders the grid - does not reload the
// whole page so the back button and header stay intact.
// =============================================
function filterCountySchools(countyId, term) {
  const grid = document.querySelector('.schools-pill-grid');
  if (!grid) return;

  const q = term.trim().toLowerCase();

  // Get all schools for this county, sorted A-Z
  var countySchools = getSchools()
    .filter(function(s) { return s.countyId === countyId; })
    .sort(function(a, b) { return a.name.localeCompare(b.name); });

  // Narrow to matching names when a search term is present
  if (q) {
    countySchools = countySchools.filter(function(s) {
      return s.name.toLowerCase().includes(q);
    });
  }

  // Empty state - no schools in county or nothing matched the search
  if (countySchools.length === 0) {
    grid.innerHTML = '<p class="empty-state" style="padding:40px; text-align:center;">' +
      (q ? 'No schools match &ldquo;' + escapeHtml(q) + '&rdquo;.' : 'No schools in this county yet. Add one above.') +
      '</p>';
    return;
  }

  // During a search, show a flat list - no letter dividers (cleaner to scan)
  // With no search term, restore the full A-Z list with letter dividers
  var html = '';
  if (q) {
    countySchools.forEach(function(s) {
      html += renderSchoolPill(s);
    });
  } else {
    var currentLetter = '';
    countySchools.forEach(function(s) {
      var letter = s.name.trim()[0].toUpperCase();
      if (!/[A-Z]/.test(letter)) letter = '#';
      if (letter !== currentLetter) {
        currentLetter = letter;
        html += '<div class="school-alpha-divider">' + letter + '</div>';
      }
      html += renderSchoolPill(s);
    });
  }

  grid.innerHTML = html;
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
  // Check if any visit for this school has the return-visit flag set
  const hasReturnFlag = schoolVisits.some(function(v) { return v.returnVisit; });
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
      <button class="btn btn-ghost back-btn" onclick="backToSchools()">&#8592; Back to ${county ? escapeHtml(county.name) : 'County'}</button>
    </div>

    <!-- Outer row: info card on the left, map panel on the right -->
    <div class="school-detail-outer">

      <div class="school-detail-card">
        <div class="school-detail-header">
          <div>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
              ${school.priority ? `<span class="priority-badge ${priorityClass}">${school.priority}</span>` : ''}
              ${hasReturnFlag ? '<span class="return-flag">&#8617; Return Visit Flagged</span>' : ''}
            </div>
            <h2 class="school-detail-name">${escapeHtml(school.name)}</h2>
            <p class="school-detail-county">${county ? escapeHtml(county.name) + ' County' : ''}</p>
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
            ${school.address
              ? `<span class="detail-value copy-value"
                  data-copy="${escapeHtml(school.address)}"
                  onclick="copyToClipboard(this.dataset.copy, this)"
                  title="Click to copy">${escapeHtml(school.address)}</span>`
              : '<span class="detail-value">Not on file</span>'
            }
          </div>
          ${(function() {
            const contacts = getSchoolContacts(school);
            if (contacts.length === 0) {
              return `
                <div class="detail-field">
                  <span class="detail-label">Contacts</span>
                  <span class="detail-value" style="color:var(--text-muted);">Not on file</span>
                </div>`;
            }
            return contacts.map(function(c, i) {
              return `
                <div class="detail-contact-block${i > 0 ? ' detail-contact-block-sep' : ''}">
                  <div class="detail-contact-title">${c.title ? escapeHtml(c.title) : 'Contact ' + (i + 1)}</div>
                  ${c.name  ? `<div class="detail-contact-row">&#128100; ${escapeHtml(c.name)}</div>` : ''}
                  ${c.email ? `<div class="detail-contact-row">
                    <span class="copy-value" data-copy="${escapeHtml(c.email)}" onclick="copyToClipboard(this.dataset.copy, this)" title="Click to copy">
                      &#9993; ${escapeHtml(c.email)}
                    </span></div>` : ''}
                  ${c.phone ? `<div class="detail-contact-row">
                    <span class="copy-value" data-copy="${escapeHtml(c.phone)}" onclick="copyToClipboard(this.dataset.copy, this)" title="Click to copy">
                      &#128222; ${escapeHtml(c.phone)}
                    </span></div>` : ''}
                </div>`;
            }).join('');
          })()}
          ${school.notes ? `
          <div class="detail-field detail-field-notes">
            <span class="detail-label">Notes</span>
            <span class="detail-value">${escapeHtml(school.notes)}</span>
          </div>
          ` : ''}
        </div>
      </div>

      <!-- Map panel - only shown when the school has an address -->
      ${school.address ? `
        <div class="school-detail-map-wrap">
          <div id="school-detail-map"></div>
          <p class="school-detail-map-note">&#128205; ${escapeHtml(school.address)} &nbsp;&middot;&nbsp; <span style="opacity:0.6;">Drag pin to correct position</span></p>
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

  // After the HTML is in the DOM, initialize the mini-map if there's an address.
  // Pass the full school object so the map can use county name as a last-resort fallback.
  if (school.address) {
    setTimeout(function() {
      initSchoolDetailMap(school.address, school);
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
            <span class="school-visit-card-title">${v.title ? escapeHtml(v.title) : dateStr}</span>
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

  const alphaBtn    = document.getElementById('dir-alpha-btn');
  const regionBtn   = document.getElementById('dir-region-btn');
  const mapBtn      = document.getElementById('dir-map-btn');
  const priorityBtn = document.getElementById('dir-priority-btn');

  if (alphaBtn && alphaBtn.classList.contains('active-toggle')) {
    // A-Z tab - re-render with filter
    renderAlphaCountyView(q);
  } else if (regionBtn && regionBtn.classList.contains('active-toggle')) {
    // By Region tab - re-render with filter
    renderRegionView(q);
  } else if (mapBtn && mapBtn.classList.contains('active-toggle')) {
    // Map tab - search doesn't apply to the Leaflet map; no-op
  } else if (priorityBtn && priorityBtn.classList.contains('active-toggle')) {
    // By Priority tab - re-render the current priority tier filtered by the search term
    renderPriorityView(activePriorityFilter, q);
  } else {
    // Default county pills view - delegate to the shared search renderer
    renderAlphaCountyView(q);
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

  // If no save handler is provided, hide the Save button (view-only modal)
  const saveBtn = document.getElementById('modal-save-btn');
  if (onSave) {
    saveBtn.addEventListener('click', onSave);
  } else {
    saveBtn.style.display = 'none';
  }

  modal._ctrlEnterHandler = function(e) {
    if (e.key === 'Enter' && e.ctrlKey && onSave) { e.preventDefault(); onSave(); }
  };
  document.addEventListener('keydown', modal._ctrlEnterHandler);

  modal.addEventListener('click', function(e) {
    if (e.target === modal) closeModal();
  });

  // Auto-focus the first text input or textarea in the modal body
  // so the user can start typing immediately without tapping the field.
  // Timeout needed to let the DOM finish rendering before focusing.
  setTimeout(function() {
    const firstInput = modal.querySelector('.modal-body input[type="text"], .modal-body input[type="email"], .modal-body input[type="tel"], .modal-body textarea');
    if (firstInput) firstInput.focus();
  }, 50);
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
    ? `<p class="form-note">Adding to: <strong>${escapeHtml(county.name)} County</strong></p>`
    : `<div class="form-group">
        <label>County <span class="required">*</span></label>
        <select id="f-county">
          <option value="">-- Select a county --</option>
          ${counties.map(c => `<option value="${c.id}">${escapeHtml(c.name)} County</option>`).join('')}
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
      <label>Priority Level</label>
      <select id="f-priority">
        <option value="">-- Not Set --</option>
        <option value="Primary">Primary</option>
        <option value="Secondary">Secondary</option>
        <option value="Tertiary">Tertiary</option>
      </select>
    </div>
    <div class="contacts-section-label">Contacts</div>
    <div id="contacts-list"></div>
    <button type="button" class="btn btn-ghost btn-sm" onclick="addSchoolContact()" style="margin-bottom:14px;">+ Add Contact</button>
    <div class="form-group">
      <label>Notes</label>
      <textarea id="f-notes" rows="3" placeholder="e.g. Park in back lot, contact prefers email..."></textarea>
    </div>
  `;

  openModal('Add School', body, function() {
    const name = document.getElementById('f-name').value.trim();
    if (!name) { alert('School name is required.'); return; }

    const selectedCountyId = countyId || document.getElementById('f-county')?.value;
    if (!selectedCountyId) { alert('Please select a county.'); return; }

    const schools = getSchools();

    // Block duplicate school names within the same county
    const duplicate = schools.find(function(s) {
      return s.countyId === selectedCountyId && s.name.toLowerCase() === name.toLowerCase();
    });
    if (duplicate) { alert('"' + name + '" already exists in this county.'); return; }

    schools.push({
      id:       makeId(),
      countyId: selectedCountyId,
      name:     name,
      address:  buildAddress(
                  document.getElementById('f-street').value.trim(),
                  document.getElementById('f-city').value.trim(),
                  document.getElementById('f-zip').value.trim()
                ),
      priority: document.getElementById('f-priority').value,
      contacts: readSchoolContacts(),
      notes:    document.getElementById('f-notes').value.trim(),
    });

    saveSchools(schools);
    closeModal();
    renderDirectory();
    updateDashboardStats();
  });

  // Start with one empty contact row so the form is ready to fill in
  addSchoolContact();
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

  // Build county options sorted A-Z, pre-selecting the school's current county
  const allCounties = getCounties().slice().sort(function(a, b) {
    return a.name.localeCompare(b.name);
  });
  const countyOptions = allCounties.map(function(c) {
    return `<option value="${escapeHtml(c.id)}" ${c.id === school.countyId ? 'selected' : ''}>${escapeHtml(c.name)} County</option>`;
  }).join('');

  const body = `
    <div class="form-group">
      <label>School Name <span class="required">*</span></label>
      <input type="text" id="f-name" value="${escapeHtml(school.name)}" />
    </div>
    <div class="form-group">
      <label>County <span class="required">*</span></label>
      <select id="f-county">${countyOptions}</select>
    </div>
    <div class="form-group">
      <label>Street Address</label>
      <input type="text" id="f-street" value="${escapeHtml(parsedAddr.street)}" placeholder="e.g. 130 Trenton Hwy" />
    </div>
    <div class="address-city-zip-row">
      <div class="form-group" style="flex:1;">
        <label>City</label>
        <input type="text" id="f-city" value="${escapeHtml(parsedAddr.city)}" placeholder="e.g. Dyer" />
      </div>
      <div class="form-group address-state-box">
        <label>State</label>
        <input type="text" value="TN" disabled style="opacity:0.5; cursor:not-allowed;" />
      </div>
      <div class="form-group" style="flex:0 0 90px;">
        <label>ZIP</label>
        <input type="text" id="f-zip" value="${escapeHtml(parsedAddr.zip)}" placeholder="38330" maxlength="5" />
      </div>
    </div>
    <div class="form-group">
      <label>Priority Level</label>
      <select id="f-priority">
        <option value=""          ${!school.priority                 ? 'selected' : ''}>-- Not Set --</option>
        <option value="Primary"   ${school.priority === 'Primary'   ? 'selected' : ''}>Primary</option>
        <option value="Secondary" ${school.priority === 'Secondary' ? 'selected' : ''}>Secondary</option>
        <option value="Tertiary"  ${school.priority === 'Tertiary'  ? 'selected' : ''}>Tertiary</option>
      </select>
    </div>
    <div class="contacts-section-label">Contacts</div>
    <div id="contacts-list"></div>
    <button type="button" class="btn btn-ghost btn-sm" onclick="addSchoolContact()" style="margin-bottom:14px;">+ Add Contact</button>
    <div class="form-group">
      <label>Notes</label>
      <textarea id="f-notes" rows="3">${escapeHtml(school.notes || '')}</textarea>
    </div>
  `;

  openModal('Edit School', body, function() {
    const name     = document.getElementById('f-name').value.trim();
    const countyId = document.getElementById('f-county').value;
    if (!name)     { alert('School name is required.'); return; }
    if (!countyId) { alert('Please select a county.'); return; }

    // Block saving if another school in the target county has the same name.
    const duplicate = schools.find(function(s) {
      return s.id !== schoolId && s.countyId === countyId && s.name.toLowerCase() === name.toLowerCase();
    });
    if (duplicate) { alert('"' + name + '" already exists in that county.'); return; }

    const idx = schools.findIndex(s => s.id === schoolId);
    schools[idx] = {
      ...schools[idx],
      name:     name,
      countyId: countyId,
      address:  buildAddress(
                  document.getElementById('f-street').value.trim(),
                  document.getElementById('f-city').value.trim(),
                  document.getElementById('f-zip').value.trim()
                ),
      priority: document.getElementById('f-priority').value,
      contacts: readSchoolContacts(),
      // Clear old single-contact fields so migrated data doesn't linger
      contact:      undefined,
      contactEmail: undefined,
      contactPhone: undefined,
      notes:    document.getElementById('f-notes').value.trim(),
    };

    saveSchools(schools);
    closeModal();
    renderDirectory();
    updateDashboardStats();
  });

  // Pre-populate existing contacts; add one empty row if there are none
  const existingContacts = getSchoolContacts(school);
  if (existingContacts.length > 0) {
    existingContacts.forEach(function(c) { addSchoolContact(c); });
  } else {
    addSchoolContact();
  }
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

    // Block duplicate county names (case-insensitive)
    const duplicate = counties.find(function(c) {
      return c.name.toLowerCase() === name.toLowerCase();
    });
    if (duplicate) { alert('"' + name + '" county already exists.'); return; }

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
      <input type="text" id="f-county-name" value="${escapeHtml(county.name)}" />
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
      <textarea id="f-county-notes" rows="3">${escapeHtml(county.notes || '')}</textarea>
    </div>
  `;

  openModal('Edit County', body, function() {
    const name = document.getElementById('f-county-name').value.trim();
    if (!name) { alert('County name is required.'); return; }

    // Block renaming to a name that already belongs to a different county
    const duplicate = counties.find(function(c) {
      return c.id !== countyId && c.name.toLowerCase() === name.toLowerCase();
    });
    if (duplicate) { alert('"' + name + '" county already exists.'); return; }

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
  // With no search term, show the normal county pill grid.
  // With a term, show a flat results list of matching counties AND schools.
  if (!q) {
    renderCountyPills();
    return;
  }

  const container = document.getElementById('directory-content');
  if (!container) return;

  const counties = getCounties();
  const schools  = getSchools();

  // Find counties whose name contains the search term
  const matchedCounties = counties.filter(function(c) {
    return c.name.toLowerCase().includes(q);
  }).sort(function(a, b) { return a.name.localeCompare(b.name); });

  // Find schools whose name contains the search term
  const matchedSchools = schools.filter(function(s) {
    return s.name.toLowerCase().includes(q);
  }).sort(function(a, b) { return a.name.localeCompare(b.name); });

  // Nothing matched at all
  if (matchedCounties.length === 0 && matchedSchools.length === 0) {
    container.innerHTML = '<p class="empty-state" style="padding:40px; text-align:center;">No counties or schools match "' + escapeHtml(q) + '".</p>';
    return;
  }

  var html = '<div class="dir-search-results">';

  // -- County results --
  if (matchedCounties.length > 0) {
    html += '<p class="dir-search-section-label">Counties</p>';
    matchedCounties.forEach(function(county) {
      const schoolCount = schools.filter(function(s) { return s.countyId === county.id; }).length;
      html += `
        <div class="dir-search-row" onclick="openCountyView('${county.id}')">
          <span class="dir-search-row-name">${escapeHtml(county.name)}</span>
          <span class="dir-search-row-meta">${schoolCount} school${schoolCount !== 1 ? 's' : ''}</span>
        </div>
      `;
    });
  }

  // -- School results --
  if (matchedSchools.length > 0) {
    html += '<p class="dir-search-section-label">Schools</p>';
    matchedSchools.forEach(function(school) {
      const county     = counties.find(function(c) { return c.id === school.countyId; });
      const countyName = county ? county.name : '';
      const priorityClass = {
        'Primary':   'priority-primary',
        'Secondary': 'priority-secondary',
        'Tertiary':  'priority-tertiary',
      }[school.priority] || '';
      html += `
        <div class="dir-search-row" onclick="openSchoolDetail('${school.id}')">
          <span class="dir-search-row-name">${escapeHtml(school.name)}</span>
          <span class="dir-search-row-meta">
            ${countyName ? escapeHtml(countyName) + ' &nbsp;' : ''}
            ${school.priority ? '<span class="priority-badge ' + priorityClass + '">' + school.priority + '</span>' : ''}
          </span>
        </div>
      `;
    });
  }

  html += '</div>';
  container.innerHTML = html;
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
                  ${s.priority ? `<span class="priority-badge ${priorityClass}">${s.priority}</span>` : ''}
                  <span class="region-chip-name">${escapeHtml(s.name)}</span>
                </div>
              `;
            }).join('') +
            '</div>';

        countyBlocksHtml += `
          <div class="region-county-chip-wrap">
            <div class="county-pill-inner region-county-pill" onclick="toggleCounty('${county.id}')">
              <div class="county-avatar">${initials}</div>
              <span class="county-pill-name">${escapeHtml(county.name)}</span>
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
    html = '<p class="empty-state" style="padding:40px; text-align:center;">No results for "' + escapeHtml(q) + '".</p>';
  }

  container.innerHTML = html;
}

// =============================================
// COPY COUNTY EMAILS
// Collects every contact email from every school
// in a county and copies them as a comma-separated
// list - ready to paste into a To: or BCC: field.
// =============================================
function copyCountyEmails(countyId) {
  const schools = getSchools().filter(function(s) { return s.countyId === countyId; });

  // Pull all email addresses across all contacts in the county,
  // using getSchoolContacts() to handle both old and new contact formats.
  const emails = [];
  schools.forEach(function(school) {
    getSchoolContacts(school).forEach(function(c) {
      if (c.email && c.email.trim()) emails.push(c.email.trim());
    });
  });

  if (emails.length === 0) {
    alert('No contact emails found for schools in this county.');
    return;
  }

  // Join with comma+space - works for most email clients
  const emailList = emails.join(', ');

  const btn = document.getElementById('copy-emails-btn');

  navigator.clipboard.writeText(emailList).then(function() {
    // Brief confirmation feedback on the button
    if (btn) {
      const original = btn.innerHTML;
      btn.innerHTML = '&#10003; Copied ' + emails.length + ' email' + (emails.length !== 1 ? 's' : '') + '!';
      btn.style.color = 'var(--success)';
      setTimeout(function() {
        btn.innerHTML = original;
        btn.style.color = '';
      }, 2500);
    }
  }).catch(function() {
    // Fallback: show in a selectable textarea modal if clipboard access is denied
    openModal(
      'Copy Emails',
      `<p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:12px;">
        Clipboard access was denied. Select all the text below and copy it manually.
      </p>
      <textarea rows="4" style="width:100%; font-family:monospace; font-size:0.8rem; resize:vertical;"
        onclick="this.select()">${escapeHtml(emailList)}</textarea>`,
      null
    );
  });
}

// =============================================
// BY PRIORITY VIEW
// Shows all schools filtered by priority level.
// Filter pills at the top let Sol switch between
// Primary, Secondary, and Tertiary.
// Includes a Copy All Emails button per tier.
// =============================================

// Tracks which priority filter is active in this view.
// Defaults to Primary when the tab is first opened.
var activePriorityFilter = 'Primary';

// Switches to the By Priority tab and renders the view.
function showDirectoryPriority() {
  const content     = document.getElementById('directory-content');
  const mapWrap     = document.getElementById('directory-map-wrap');
  const alphaBtn    = document.getElementById('dir-alpha-btn');
  const mapBtn      = document.getElementById('dir-map-btn');
  const regionBtn   = document.getElementById('dir-region-btn');
  const priorityBtn = document.getElementById('dir-priority-btn');

  if (content)     content.style.display   = '';
  if (mapWrap)     mapWrap.style.display   = 'none';
  if (alphaBtn)    alphaBtn.classList.remove('active-toggle');
  if (mapBtn)      mapBtn.classList.remove('active-toggle');
  if (regionBtn)   regionBtn.classList.remove('active-toggle');
  if (priorityBtn) priorityBtn.classList.add('active-toggle');

  renderPriorityView(activePriorityFilter);
}

// Renders the priority view for the given tier (Primary/Secondary/Tertiary).
// Stores the active filter so switching tabs and back remembers the choice.
// priority: which tier to show (Primary/Secondary/Tertiary)
// q: optional search term passed from filterDirectory(); if omitted,
//    the function reads the current search input so clicking a priority
//    pill preserves any active search without needing extra wiring.
function renderPriorityView(priority, q) {
  activePriorityFilter = priority;

  const container = document.getElementById('directory-content');
  if (!container) return;

  showDirectoryControls(true);

  const schools  = getSchools();
  const counties = getCounties();

  // Resolve the search term - prefer the passed value, fall back to the input
  const filterTerm = (q !== undefined
    ? q
    : ((document.getElementById('directory-search') || {}).value || '')
  ).trim().toLowerCase();

  // Filter to the selected priority, then narrow by search term if one exists, sorted A-Z
  const filtered = schools
    .filter(function(s) {
      if (s.priority !== priority) return false;
      if (filterTerm && !s.name.toLowerCase().includes(filterTerm)) return false;
      return true;
    })
    .sort(function(a, b) { return a.name.localeCompare(b.name); });

  // Build the three filter pills at the top
  var pillsHtml = ['Primary', 'Secondary', 'Tertiary'].map(function(tier) {
    const count     = schools.filter(function(s) { return s.priority === tier; }).length;
    const isActive  = tier === priority;
    const cssClass  = isActive ? 'pv-pill pv-pill-active pv-pill-' + tier.toLowerCase() : 'pv-pill pv-pill-' + tier.toLowerCase();
    return `<button class="${cssClass}" onclick="renderPriorityView('${tier}')">${tier} <span class="pv-pill-count">${count}</span></button>`;
  }).join('');

  // Empty state - either no schools at all or search returned nothing
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="pv-filter-row">${pillsHtml}</div>
      <p class="empty-state" style="padding:40px; text-align:center;">
        ${filterTerm
          ? 'No ' + priority + ' schools match &ldquo;' + escapeHtml(filterTerm) + '&rdquo;.'
          : 'No ' + priority + ' schools yet.'}
      </p>
    `;
    return;
  }

  // Build school rows
  var rowsHtml = filtered.map(function(school) {
    const county     = counties.find(function(c) { return c.id === school.countyId; });
    const countyName = county ? county.name : '';
    return `
      <div class="pv-school-row" onclick="openSchoolDetail('${school.id}')">
        <div class="pv-school-name">${escapeHtml(school.name)}</div>
        <div class="pv-school-county">${escapeHtml(countyName)}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="pv-filter-row">${pillsHtml}</div>
    <div class="pv-toolbar">
      <span class="pv-count-label">${filtered.length} school${filtered.length !== 1 ? 's' : ''}${filterTerm ? ' matching &ldquo;' + escapeHtml(filterTerm) + '&rdquo;' : ''}</span>
      <button class="btn btn-ghost btn-sm" id="pv-copy-emails-btn" onclick="copyPriorityEmails('${priority}')">&#9993; Copy All Emails</button>
    </div>
    <div class="pv-school-list">${rowsHtml}</div>
  `;
}

// Copies all contact emails from schools of the given priority to the clipboard.
// Reuses the same pattern as copyCountyEmails() in the county detail view.
function copyPriorityEmails(priority) {
  const schools = getSchools().filter(function(s) { return s.priority === priority; });

  const emails = [];
  schools.forEach(function(school) {
    getSchoolContacts(school).forEach(function(c) {
      if (c.email && c.email.trim()) emails.push(c.email.trim());
    });
  });

  if (emails.length === 0) {
    alert('No contact emails found for ' + priority + ' schools.');
    return;
  }

  const emailList = emails.join(', ');
  const btn       = document.getElementById('pv-copy-emails-btn');

  navigator.clipboard.writeText(emailList).then(function() {
    if (btn) {
      const original = btn.innerHTML;
      btn.innerHTML  = '&#10003; Copied ' + emails.length + ' email' + (emails.length !== 1 ? 's' : '') + '!';
      btn.style.color = 'var(--success)';
      setTimeout(function() {
        btn.innerHTML   = original;
        btn.style.color = '';
      }, 2500);
    }
  }).catch(function() {
    openModal(
      'Copy Emails',
      `<p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:12px;">
        Clipboard access was denied. Select all the text below and copy it manually.
      </p>
      <textarea rows="4" style="width:100%; font-family:monospace; font-size:0.8rem; resize:vertical;"
        onclick="this.select()">${escapeHtml(emailList)}</textarea>`,
      null
    );
  });
}

// =============================================
// PRINT / EXPORT
// Generates clean print-ready pages in a new tab.
// No frameworks - just plain HTML written into
// a new window, then window.print() fires.
// =============================================

// Opens the print options modal so Sol can pick what to export.
function openPrintMenu() {
  var body = `
    <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:16px;">
      Choose what to print. Each option opens a new tab formatted for printing or saving as PDF.
    </p>

    <p class="dir-search-section-label" style="padding-top:0;">By Priority</p>
    <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:16px;">
      <button class="print-menu-btn" onclick="closeModal(); printByPriority('Primary')">&#11088; Primary Schools</button>
      <button class="print-menu-btn" onclick="closeModal(); printByPriority('Secondary')">&#11088; Secondary Schools</button>
      <button class="print-menu-btn" onclick="closeModal(); printByPriority('Tertiary')">&#11088; Tertiary Schools</button>
      <button class="print-menu-btn" onclick="closeModal(); printAllPriorities()">&#11088; All Priorities (3 sections)</button>
    </div>

    <p class="dir-search-section-label">Full Directory</p>
    <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:16px;">
      <button class="print-menu-btn" onclick="closeModal(); printAlphabetical()">&#128218; All Schools - A to Z</button>
      <button class="print-menu-btn" onclick="closeModal(); printByCounty()">&#128218; All Schools - By County</button>
    </div>

    <p class="dir-search-section-label">Map</p>
    <div style="display:flex; flex-direction:column; gap:8px;">
      <!-- Toggle row for school markers - read before closing modal -->
      <label class="print-map-toggle-row">
        <span>Show school markers on map</span>
        <div class="print-map-toggle-wrap">
          <input type="checkbox" id="print-map-markers" checked>
          <span class="print-map-toggle-slider"></span>
        </div>
      </label>
      <!-- Read toggle value before closeModal() removes the DOM -->
      <button class="print-menu-btn" onclick="var show = document.getElementById('print-map-markers').checked; closeModal(); printMap(show);">&#128205; Print Tennessee Map</button>
    </div>
  `;

  // null for onSave hides the Save button - this modal is selection only
  openModal('Print / Export', body, null);
}

// Returns a formatted date string for print headers (e.g. "July 21, 2026")
function getPrintDate() {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Builds the HTML block for one school - used in all print functions.
// Shows name, county, priority, address, all contacts, and notes.
function buildSchoolPrintCard(school, countyName) {
  var contacts = getSchoolContacts(school);

  // Build contacts section - one row per contact
  var contactsHtml = '';
  if (contacts.length > 0) {
    contactsHtml = '<div class="pc-contacts">';
    contacts.forEach(function(c) {
      var parts = [];
      if (c.title) parts.push('<span class="pc-contact-title">' + escapeHtml(c.title) + '</span>');
      if (c.name)  parts.push(escapeHtml(c.name));
      if (c.email) parts.push('<a href="mailto:' + escapeHtml(c.email) + '">' + escapeHtml(c.email) + '</a>');
      if (c.phone) parts.push(escapeHtml(c.phone));
      contactsHtml += '<div class="pc-contact-row">' + parts.join(' &nbsp;|&nbsp; ') + '</div>';
    });
    contactsHtml += '</div>';
  } else {
    contactsHtml = '<div class="pc-no-contact">No contacts on file</div>';
  }

  var priorityLabel = school.priority || 'Not Set';
  var addressHtml   = school.address
    ? '<div class="pc-address">&#128205; ' + escapeHtml(school.address) + '</div>'
    : '';
  var notesHtml     = school.notes
    ? '<div class="pc-notes"><strong>Notes:</strong> ' + escapeHtml(school.notes) + '</div>'
    : '';

  return `
    <div class="pc-school-card">
      <div class="pc-school-header">
        <span class="pc-school-name">${escapeHtml(school.name)}</span>
        <span class="pc-priority-badge pc-priority-${priorityLabel.toLowerCase()}">${priorityLabel}</span>
      </div>
      <div class="pc-county">${escapeHtml(countyName)}</div>
      ${addressHtml}
      ${contactsHtml}
      ${notesHtml}
    </div>
  `;
}

// Shared CSS used by all print windows - clean, black-on-white, printable.
function getPrintStyles() {
  return `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 11pt;
        color: #111;
        background: #fff;
        padding: 20px 32px;
      }
      h1.print-title {
        font-size: 18pt;
        font-weight: 700;
        margin-bottom: 2px;
        color: #1a0a2e;
      }
      .print-date {
        font-size: 9pt;
        color: #666;
        margin-bottom: 20px;
      }
      h2.priority-section-title {
        font-size: 14pt;
        font-weight: 700;
        color: #1a0a2e;
        border-bottom: 2px solid #1a0a2e;
        padding-bottom: 4px;
        margin: 24px 0 14px;
        page-break-after: avoid;
      }
      h2.county-section-title {
        font-size: 12pt;
        font-weight: 700;
        color: #333;
        border-bottom: 1px solid #ccc;
        padding-bottom: 3px;
        margin: 20px 0 10px;
        page-break-after: avoid;
      }
      .pc-school-card {
        border: 1px solid #ddd;
        border-radius: 6px;
        padding: 12px 16px;
        margin-bottom: 10px;
        page-break-inside: avoid;
      }
      .pc-school-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 3px;
      }
      .pc-school-name {
        font-size: 12pt;
        font-weight: 700;
        color: #111;
      }
      .pc-priority-badge {
        font-size: 8pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        padding: 2px 8px;
        border-radius: 20px;
        white-space: nowrap;
        border: 1px solid #999;
        color: #333;
      }
      .pc-priority-primary   { border-color: #6b21a8; color: #6b21a8; }
      .pc-priority-secondary { border-color: #15803d; color: #15803d; }
      .pc-priority-tertiary  { border-color: #b45309; color: #b45309; }
      .pc-county {
        font-size: 9pt;
        color: #555;
        margin-bottom: 4px;
      }
      .pc-address {
        font-size: 9.5pt;
        color: #444;
        margin-bottom: 5px;
      }
      .pc-contacts {
        margin: 6px 0;
        border-left: 3px solid #ddd;
        padding-left: 10px;
      }
      .pc-contact-row {
        font-size: 9.5pt;
        color: #333;
        margin-bottom: 3px;
      }
      .pc-contact-title {
        font-weight: 700;
        color: #111;
      }
      .pc-contact-row a {
        color: #1a0a6e;
        text-decoration: none;
      }
      .pc-no-contact {
        font-size: 9pt;
        color: #999;
        font-style: italic;
        margin: 4px 0;
      }
      .pc-notes {
        font-size: 9.5pt;
        color: #444;
        margin-top: 6px;
        font-style: italic;
      }
      .print-footer {
        margin-top: 30px;
        font-size: 8pt;
        color: #aaa;
        text-align: center;
        border-top: 1px solid #eee;
        padding-top: 8px;
      }
      @media print {
        body { padding: 12px 20px; }
        .pc-school-card { page-break-inside: avoid; }
      }
    </style>
  `;
}

// Opens a new tab, writes the given HTML into it, and fires window.print().
function openPrintWindow(titleText, htmlContent) {
  var win = window.open('', '_blank');
  if (!win) {
    alert('Pop-up blocked. Please allow pop-ups for this page and try again.');
    return;
  }
  win.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${escapeHtml(titleText)}</title>
      ${getPrintStyles()}
    </head>
    <body>
      ${htmlContent}
      <div class="print-footer">Admissions Command Center - printed ${getPrintDate()}</div>
      <script>window.onload = function() { window.print(); }<\/script>
    </body>
    </html>
  `);
  win.document.close();
}

// Prints all schools of a single priority tier (Primary, Secondary, or Tertiary).
function printByPriority(priority) {
  var schools  = getSchools().filter(function(s) { return s.priority === priority; })
                             .sort(function(a, b) { return a.name.localeCompare(b.name); });
  var counties = getCounties();

  if (schools.length === 0) {
    alert('No ' + priority + ' schools to print.');
    return;
  }

  var cardsHtml = schools.map(function(s) {
    var county = counties.find(function(c) { return c.id === s.countyId; });
    return buildSchoolPrintCard(s, county ? county.name : '');
  }).join('');

  var html = `
    <h1 class="print-title">${priority} Schools</h1>
    <div class="print-date">${getPrintDate()} &nbsp;|&nbsp; ${schools.length} school${schools.length !== 1 ? 's' : ''}</div>
    ${cardsHtml}
  `;

  openPrintWindow(priority + ' Schools', html);
}

// Prints all three priority tiers in one document with a section header each.
function printAllPriorities() {
  var schools  = getSchools();
  var counties = getCounties();
  var html     = '<h1 class="print-title">All Schools by Priority</h1><div class="print-date">' + getPrintDate() + '</div>';

  ['Primary', 'Secondary', 'Tertiary'].forEach(function(priority) {
    var tier = schools.filter(function(s) { return s.priority === priority; })
                      .sort(function(a, b) { return a.name.localeCompare(b.name); });
    html += '<h2 class="priority-section-title">' + priority + ' (' + tier.length + ')</h2>';
    if (tier.length === 0) {
      html += '<p style="color:#999; font-style:italic; margin-bottom:12px;">No ' + priority + ' schools.</p>';
    } else {
      tier.forEach(function(s) {
        var county = counties.find(function(c) { return c.id === s.countyId; });
        html += buildSchoolPrintCard(s, county ? county.name : '');
      });
    }
  });

  openPrintWindow('All Schools by Priority', html);
}

// Prints every school sorted A-Z by name.
function printAlphabetical() {
  var schools  = getSchools().sort(function(a, b) { return a.name.localeCompare(b.name); });
  var counties = getCounties();

  if (schools.length === 0) {
    alert('No schools to print.');
    return;
  }

  var cardsHtml = schools.map(function(s) {
    var county = counties.find(function(c) { return c.id === s.countyId; });
    return buildSchoolPrintCard(s, county ? county.name : '');
  }).join('');

  var html = `
    <h1 class="print-title">All Schools - A to Z</h1>
    <div class="print-date">${getPrintDate()} &nbsp;|&nbsp; ${schools.length} school${schools.length !== 1 ? 's' : ''}</div>
    ${cardsHtml}
  `;

  openPrintWindow('All Schools - A to Z', html);
}

// Prints every school grouped by county, counties sorted A-Z,
// schools within each county sorted A-Z.
function printByCounty() {
  var schools  = getSchools();
  var counties = getCounties().slice().sort(function(a, b) { return a.name.localeCompare(b.name); });

  if (schools.length === 0) {
    alert('No schools to print.');
    return;
  }

  var html = '<h1 class="print-title">All Schools by County</h1><div class="print-date">' + getPrintDate() + '</div>';

  counties.forEach(function(county) {
    var countySchools = schools
      .filter(function(s) { return s.countyId === county.id; })
      .sort(function(a, b) { return a.name.localeCompare(b.name); });
    if (countySchools.length === 0) return;

    html += '<h2 class="county-section-title">' + escapeHtml(county.name) + ' (' + countySchools.length + ')</h2>';
    countySchools.forEach(function(s) {
      html += buildSchoolPrintCard(s, county.name);
    });
  });

  openPrintWindow('All Schools by County', html);
}

// Prints the Leaflet map fitted to Tennessee.
// showMarkers = true  -> school dots are visible in the capture
// showMarkers = false -> dots are hidden before capture, restored after
// Uses html2canvas because cross-origin OpenStreetMap tiles can't print directly.
function printMap(showMarkers) {
  // Default to showing markers if called without argument
  if (showMarkers === undefined) showMarkers = true;

  // Switch to the map tab so the Leaflet instance is rendered and visible
  showDirectoryMap();

  // Tighter Tennessee bounds - just enough to show the full state
  var tnBounds = [[35.00, -90.10], [36.68, -81.70]];

  // mapInstance is the global Leaflet map created in map.js
  if (typeof mapInstance === 'undefined' || !mapInstance) {
    alert('Map not ready. Open the Map tab and wait for it to load, then try again.');
    return;
  }

  // Resize the map container to a TN-shaped aspect ratio before fitBounds.
  // The live map is 100% wide x 560px tall - much wider than TN's shape.
  // If we fitBounds on a wide container, Leaflet zooms out to fill the height
  // and shows a lot of surrounding states. A 900x300 container (3:1) matches
  // TN's proportions and keeps the crop tight.
  var mapEl = document.getElementById('school-map');
  if (!mapEl) {
    alert('Map element not found. Make sure the Map tab is active.');
    return;
  }
  var origWidth  = mapEl.style.width;
  var origHeight = mapEl.style.height;
  mapEl.style.width  = '900px';
  mapEl.style.height = '300px';
  mapInstance.invalidateSize({ animate: false }); // tell Leaflet about the new size

  mapInstance.fitBounds(tnBounds, { animate: false, padding: [12, 12] });

  // Find the active tile layer so we can listen for its load event
  // instead of guessing with a fixed timeout.
  var tileLayer = null;
  mapInstance.eachLayer(function(layer) {
    if (layer instanceof L.TileLayer) tileLayer = layer;
  });

  // Restores the map container to its original size after capture.
  function restoreMapSize() {
    mapEl.style.width  = origWidth;
    mapEl.style.height = origHeight;
    mapInstance.invalidateSize({ animate: false });
    mapInstance.fitBounds(tnBounds, { animate: false });
  }

  // Captures the map div with html2canvas and opens a print window.
  // Called either by the tile load event or the fallback timeout below.
  function doCapture() {
    // Hide Leaflet controls (zoom buttons, layer toggle) so they don't
    // appear in the captured image.
    var controls = mapEl.querySelector('.leaflet-control-container');
    if (controls) controls.style.visibility = 'hidden';

    // If hiding markers: save each CircleMarker's opacity and set to 0
    var savedStyles = [];
    if (!showMarkers) {
      mapInstance.eachLayer(function(layer) {
        if (layer instanceof L.CircleMarker) {
          savedStyles.push({
            layer:       layer,
            opacity:     layer.options.opacity,
            fillOpacity: layer.options.fillOpacity
          });
          layer.setStyle({ opacity: 0, fillOpacity: 0 });
        }
      });
    }

    // Capture the map div as a high-resolution image
    html2canvas(mapEl, {
      useCORS:    true,   // load cross-origin tile images
      allowTaint: true,   // allow cross-origin content on the canvas
      logging:    false,
      scale:      2       // 2x for sharper output when printing
    }).then(function(canvas) {

      // Restore controls, markers, and map size
      if (controls) controls.style.visibility = '';
      savedStyles.forEach(function(s) {
        s.layer.setStyle({ opacity: s.opacity, fillOpacity: s.fillOpacity });
      });
      restoreMapSize();

      var imgData    = canvas.toDataURL('image/png');
      var markerNote = showMarkers ? '' : '<p style="font-size:9pt; color:#666; margin-top:6px;">School markers hidden.</p>';

      var html = `
        <h1 class="print-title">Tennessee Coverage Map</h1>
        <div class="print-date">${getPrintDate()}</div>
        ${markerNote}
        <div style="margin-top:10px;">
          <img src="${imgData}" style="width:100%; height:auto; border:1px solid #ddd; border-radius:6px;" />
        </div>
      `;

      openPrintWindow('Tennessee Coverage Map', html);

    }).catch(function(err) {
      // Restore everything even if capture failed
      if (controls) controls.style.visibility = '';
      savedStyles.forEach(function(s) {
        s.layer.setStyle({ opacity: s.opacity, fillOpacity: s.fillOpacity });
      });
      restoreMapSize();
      alert('Map capture failed. Try again after the map fully loads.');
      console.error('html2canvas error:', err);
    });
  }

  if (tileLayer) {
    // Wait for the tile layer to signal all visible tiles are loaded,
    // then add a tiny extra delay so SVG county polygons finish painting.
    // _done prevents both the event and the fallback from firing.
    var _done = false;
    tileLayer.once('load', function() {
      if (_done) return;
      _done = true;
      setTimeout(doCapture, 200); // 200ms for county polygon SVG to settle
    });
    // Fallback: if tiles haven't loaded after 6s, capture whatever is there
    setTimeout(function() {
      if (_done) return;
      _done = true;
      doCapture();
    }, 6000);
  } else {
    // No tile layer found - fall back to a longer fixed delay
    setTimeout(doCapture, 3000);
  }
}

// =============================================
// INIT DIRECTORY
// Called by app.js whenever the user navigates
// to the directory tab. Resets to county pills view.
// =============================================
function initDirectory() {
  dirView = 'counties';
  renderDirectory();
}

// =============================================
// PRIORITY TRIAGE MODE
// Entire flow runs inside the modal - scope picker
// first, then each school card replaces the modal
// body in place. No page navigation needed.
// =============================================

// Holds the list of school IDs queued for triage in the current session.
var triageQueue = [];
// Index of the school currently being shown.
var triageIndex = 0;

// Opens the modal with the scope picker.
// When the user clicks "Start Triage", the modal body
// swaps to show the first school card without closing.
function openTriagePrompt() {
  var counties = getCounties().slice().sort(function(a, b) {
    return a.name.localeCompare(b.name);
  });

  // Build county dropdown options
  var countyOptions = counties.map(function(c) {
    return '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>';
  }).join('');

  // Three clickable option boxes - no radio dots.
  // Clicking a box sets it as selected (highlighted border).
  // The county dropdown only appears when "county" box is active.
  var body = `
    <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:14px;">
      Choose which schools to go through. Tap a priority to assign it - saves instantly and moves to the next school.
    </p>

    <div class="triage-option-box triage-option-active" data-scope="unset" onclick="selectTriageOption(this)">
      Schools with no priority set
    </div>

    <div class="triage-option-box" data-scope="county" onclick="selectTriageOption(this)">
      One county
    </div>

    <!-- County dropdown - hidden until "One county" is selected -->
    <div id="triage-county-wrap" style="display:none; margin-bottom:8px;">
      <select id="triage-county-select" class="form-control">
        ${countyOptions}
      </select>
    </div>

    <div class="triage-option-box" data-scope="all" onclick="selectTriageOption(this)">
      All schools
    </div>
  `;

  // Save button kicks off the triage - stays inside the modal
  openModal('Triage Priorities', body, function() {
    var activeBox = document.querySelector('.triage-option-active');
    var scope     = activeBox ? activeBox.getAttribute('data-scope') : 'unset';
    var schools   = getSchools();
    var queue     = [];

    if (scope === 'unset') {
      queue = schools.filter(function(s) { return !s.priority; });
    } else if (scope === 'county') {
      var countyId = document.getElementById('triage-county-select').value;
      queue = schools.filter(function(s) { return s.countyId === countyId; });
    } else {
      queue = schools.slice();
    }

    if (queue.length === 0) {
      alert('No schools found for that selection.');
      return;
    }

    // Hide the footer - priority buttons replace Save/Cancel from here on
    var footer = document.querySelector('#acc-modal .modal-footer');
    if (footer) footer.style.display = 'none';

    triageQueue = queue.map(function(s) { return s.id; });
    triageIndex = 0;
    renderTriageInModal();
  });
}

// Highlights the clicked option box and deselects the others.
// Shows the county dropdown only when the "county" box is active.
function selectTriageOption(el) {
  // Remove active state from all boxes
  document.querySelectorAll('.triage-option-box').forEach(function(box) {
    box.classList.remove('triage-option-active');
  });
  // Activate the clicked one
  el.classList.add('triage-option-active');

  // Show/hide county dropdown based on which option is active
  var wrap = document.getElementById('triage-county-wrap');
  if (wrap) {
    wrap.style.display = el.getAttribute('data-scope') === 'county' ? 'block' : 'none';
  }
}

// Updates the modal title and body to show the current school card.
// Called after scope is chosen and after each priority tap.
function renderTriageInModal() {
  var titleEl = document.querySelector('#acc-modal .modal-header h2');
  var bodyEl  = document.querySelector('#acc-modal .modal-body');
  if (!bodyEl) return;

  // All done - show the completion screen inside the modal
  if (triageIndex >= triageQueue.length) {
    if (titleEl) titleEl.textContent = 'All Done!';
    bodyEl.innerHTML = `
      <div class="triage-done">
        <div class="triage-done-icon">&#10003;</div>
        <p class="triage-done-sub">You reviewed ${triageQueue.length} school${triageQueue.length !== 1 ? 's' : ''}.</p>
        <button class="btn btn-primary-solid" onclick="closeModal()">Close</button>
      </div>
    `;
    return;
  }

  var schools  = getSchools();
  var counties = getCounties();
  var schoolId = triageQueue[triageIndex];
  var school   = schools.find(function(s) { return s.id === schoolId; });

  // School deleted mid-session - skip silently
  if (!school) {
    triageIndex++;
    renderTriageInModal();
    return;
  }

  var county     = counties.find(function(c) { return c.id === school.countyId; });
  var countyName = county ? county.name : 'Unknown County';

  var currentPriority = school.priority || 'None';
  var priorityClass   = {
    'Primary':   'priority-primary',
    'Secondary': 'priority-secondary',
    'Tertiary':  'priority-tertiary',
  }[school.priority] || 'priority-none';

  var done  = triageIndex;
  var total = triageQueue.length;
  var pct   = Math.round((done / total) * 100);

  // Update the modal title to show progress
  if (titleEl) titleEl.textContent = done + ' of ' + total + ' schools';

  bodyEl.innerHTML = `
    <!-- Thin progress bar -->
    <div class="triage-progress-bar-wrap" style="margin-bottom:20px;">
      <div class="triage-progress-bar" style="width:${pct}%"></div>
    </div>

    <!-- School info -->
    <div style="text-align:center; margin-bottom:20px;">
      <div class="triage-county-label">${escapeHtml(countyName)}</div>
      <div class="triage-school-name">${escapeHtml(school.name)}</div>
      <div class="triage-current-priority">
        Current: <span class="priority-badge ${priorityClass}">${currentPriority}</span>
      </div>
    </div>

    <!-- Priority buttons - full width, easy to tap -->
    <div class="triage-btn-grid">
      <button class="triage-btn triage-primary"   onclick="setTriagePriority('Primary')">Primary</button>
      <button class="triage-btn triage-secondary" onclick="setTriagePriority('Secondary')">Secondary</button>
      <button class="triage-btn triage-tertiary"  onclick="setTriagePriority('Tertiary')">Tertiary</button>
      <button class="triage-btn triage-skip"      onclick="setTriagePriority(null)">Skip</button>
    </div>
  `;
}

// Saves the chosen priority (or skips if null) then advances to the next school.
// Runs entirely inside the modal - no page navigation.
function setTriagePriority(priority) {
  var schools  = getSchools();
  var schoolId = triageQueue[triageIndex];
  var school   = schools.find(function(s) { return s.id === schoolId; });

  if (school && priority !== null) {
    school.priority = priority;
    saveSchools(schools);
  }

  triageIndex++;
  renderTriageInModal();
}
