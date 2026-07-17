// =============================================
// ACC - School Directory
// Manages counties and schools within them
// =============================================

// =============================================
// DATA HELPERS
// Load and save counties and schools from storage
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

// Generate a simple unique ID for new records
function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// =============================================
// RENDER DIRECTORY
// Builds the full directory view with county
// buckets collapsed by default for compact display
// =============================================
function renderDirectory() {
  const container = document.getElementById('directory-content');
  if (!container) return;

  const counties = getCounties();
  const schools  = getSchools();

  // Remember which counties are currently expanded so a re-render keeps their state
  const expanded = {};
  document.querySelectorAll('.county-body.open').forEach(el => {
    expanded[el.dataset.countyId] = true;
  });

  // Wrap all counties in a 4-column grid
  const grid = '<div class="county-grid">' + counties.map(county => {
    const countySchools = schools.filter(s => s.countyId === county.id);
    const isOpen        = expanded[county.id] ? 'open' : '';

    return `
      <div class="county-bucket" id="county-${county.id}" data-county-name="${county.name.toLowerCase()}">

        <!-- Header - click anywhere to expand/collapse -->
        <div class="county-header" onclick="toggleCounty('${county.id}')">
          <span class="county-chevron" id="chevron-${county.id}">${isOpen ? '&#9660;' : '&#9654;'}</span>
          <h2 class="county-name">${county.name}</h2>
          <span class="county-count">${countySchools.length}</span>
        </div>

        <!-- Collapsible body -->
        <div class="county-body ${isOpen}" id="county-body-${county.id}" data-county-id="${county.id}">

          <!-- Action buttons row inside the body so they don't crowd the header -->
          <div class="county-actions" onclick="event.stopPropagation()">
            <button class="btn-icon" onclick="toggleCountyNotes('${county.id}')" title="View notes">&#128221; Notes</button>
            <button class="btn-icon" onclick="openEditCounty('${county.id}')" title="Edit county">&#9998; Edit</button>
            <button class="btn-icon btn-icon-danger" onclick="confirmDeleteCounty('${county.id}')" title="Delete county">&#128465; Delete</button>
          </div>

          <!-- County notes section -->
          <div class="county-notes" id="county-notes-${county.id}" style="display:none;">
            <div class="county-notes-inner">
              <strong>County Notes:</strong>
              <p>${county.notes || '<em>No notes yet. Click Edit to add notes about this county.</em>'}</p>
            </div>
          </div>

          <!-- Schools list -->
          <div class="schools-list" id="schools-list-${county.id}">
            ${countySchools.length === 0
              ? '<p class="empty-state" style="padding: 16px;">No schools yet.</p>'
              : countySchools.map(school => renderSchoolCard(school)).join('')
            }
          </div>

          <!-- Add school button -->
          <div class="county-footer">
            <button class="btn btn-accent" style="width:100%; justify-content:center;" onclick="openAddSchool('${county.id}')">
              + Add School
            </button>
          </div>

        </div>
      </div>
    `;
  }).join('') + '</div>';

  container.innerHTML = grid + `
    <div class="add-county-row">
      <button class="btn btn-outline" onclick="openAddCounty()">+ Add New County</button>
    </div>
  `;
}

// =============================================
// TOGGLE COUNTY OPEN/CLOSED
// Expands or collapses a county's school list
// =============================================
function toggleCounty(countyId) {
  const body    = document.getElementById('county-body-' + countyId);
  const chevron = document.getElementById('chevron-' + countyId);
  if (!body) return;

  const isOpen = body.classList.toggle('open');
  if (chevron) chevron.innerHTML = isOpen ? '&#9660;' : '&#9654;';
}

// =============================================
// EXPAND / COLLAPSE ALL
// Opens or closes every county at once
// =============================================
function expandAll() {
  document.querySelectorAll('.county-body').forEach(body => {
    body.classList.add('open');
  });
  document.querySelectorAll('.county-chevron').forEach(ch => {
    ch.innerHTML = '&#9660;';
  });
}

function collapseAll() {
  document.querySelectorAll('.county-body').forEach(body => {
    body.classList.remove('open');
  });
  document.querySelectorAll('.county-chevron').forEach(ch => {
    ch.innerHTML = '&#9654;';
  });
}

// =============================================
// SEARCH / FILTER
// Filters counties and schools by search term
// Expands matching counties automatically
// =============================================
function filterDirectory(term) {
  const q        = term.trim().toLowerCase();
  const counties = document.querySelectorAll('.county-bucket');

  counties.forEach(bucket => {
    const countyName  = bucket.dataset.countyName || '';
    const schoolCards = bucket.querySelectorAll('.school-card');
    let   anySchoolMatch = false;

    // Check each school card for a name match
    schoolCards.forEach(card => {
      const schoolName = card.querySelector('.school-name')?.textContent.toLowerCase() || '';
      const match      = !q || schoolName.includes(q);
      card.style.display = match ? '' : 'none';
      if (match) anySchoolMatch = true;
    });

    // Show the county if its name matches OR any school inside it matches
    const countyMatch = !q || countyName.includes(q) || anySchoolMatch;
    bucket.style.display = countyMatch ? '' : 'none';

    // Auto-expand the county if there's a search term and it matched
    if (q && countyMatch) {
      const body    = bucket.querySelector('.county-body');
      const chevron = bucket.querySelector('.county-chevron');
      if (body && !body.classList.contains('open')) {
        body.classList.add('open');
        if (chevron) chevron.innerHTML = '&#9660;';
      }
    }
  });
}

// =============================================
// RENDER SCHOOL CARD
// Returns HTML for one school entry
// =============================================
function renderSchoolCard(school) {
  const priorityClass = {
    'Primary':   'priority-primary',
    'Secondary': 'priority-secondary',
    'Tertiary':  'priority-tertiary',
  }[school.priority] || '';

  return `
    <div class="school-card" id="school-${school.id}">
      <div class="school-card-top">
        <div class="school-info">
          <span class="priority-badge ${priorityClass}">${school.priority}</span>
          <h3 class="school-name">${school.name}</h3>
          <p class="school-address">${school.address || 'No address on file'}</p>
        </div>
        <div class="school-actions">
          <button class="btn-icon" onclick="openEditSchool('${school.id}')" title="Edit school">&#9998;</button>
          <button class="btn-icon btn-icon-danger" onclick="confirmDeleteSchool('${school.id}')" title="Delete school">&#128465;</button>
        </div>
      </div>
      ${school.contact ? `
        <div class="school-contact">
          <span class="contact-label">School Contact:</span>
          <span>${school.contact}</span>
          ${school.contactEmail ? `<a href="mailto:${school.contactEmail}" class="contact-link">${school.contactEmail}</a>` : ''}
          ${school.contactPhone ? `<a href="tel:${school.contactPhone}" class="contact-link">${school.contactPhone}</a>` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

// =============================================
// COUNTY NOTES TOGGLE
// Shows/hides the notes panel for a county
// =============================================
function toggleCountyNotes(countyId) {
  const notes = document.getElementById('county-notes-' + countyId);
  if (!notes) return;
  notes.style.display = notes.style.display === 'none' ? 'block' : 'none';
}

// =============================================
// MODAL SYSTEM
// A single reusable modal for all forms
// =============================================
function openModal(title, bodyHtml, onSave) {
  // Remove any existing modal first
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

  // Wire up the save button to the provided callback
  document.getElementById('modal-save-btn').addEventListener('click', onSave);

  // Close modal if user clicks outside the box
  modal.addEventListener('click', function(e) {
    if (e.target === modal) closeModal();
  });
}

function closeModal() {
  const modal = document.getElementById('acc-modal');
  if (modal) modal.remove();
}

// =============================================
// ADD SCHOOL FORM
// Opens a modal to add a new school to a county
// =============================================
function openAddSchool(countyId) {
  const counties = getCounties();
  const county   = counties.find(c => c.id === countyId);

  const body = `
    <div class="form-group">
      <label>School Name <span class="required">*</span></label>
      <input type="text" id="f-name" placeholder="e.g. Oak Ridge High School" />
    </div>
    <div class="form-group">
      <label>Address</label>
      <input type="text" id="f-address" placeholder="123 Main St, City, TN 37000" />
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
      <input type="text" id="f-contact" placeholder="e.g. Jane Smith - Counselor" />
    </div>
    <div class="form-group">
      <label>Contact Email</label>
      <input type="email" id="f-contact-email" placeholder="jsmith@school.edu" />
    </div>
    <div class="form-group">
      <label>Contact Phone</label>
      <input type="tel" id="f-contact-phone" placeholder="(555) 000-0000" />
    </div>
    <p class="form-note">Adding to: <strong>${county ? county.name + ' County' : ''}</strong></p>
  `;

  openModal('Add School', body, function() {
    const name = document.getElementById('f-name').value.trim();
    if (!name) { alert('School name is required.'); return; }

    const schools = getSchools();
    schools.push({
      id:           makeId(),
      countyId:     countyId,
      name:         name,
      address:      document.getElementById('f-address').value.trim(),
      priority:     document.getElementById('f-priority').value,
      contact:      document.getElementById('f-contact').value.trim(),
      contactEmail: document.getElementById('f-contact-email').value.trim(),
      contactPhone: document.getElementById('f-contact-phone').value.trim(),
    });

    saveSchools(schools);
    closeModal();
    renderDirectory();
    updateDashboardStats();  // keep dashboard stats in sync
  });
}

// =============================================
// EDIT SCHOOL FORM
// Pre-fills the form with existing school data
// =============================================
function openEditSchool(schoolId) {
  const schools = getSchools();
  const school  = schools.find(s => s.id === schoolId);
  if (!school) return;

  const body = `
    <div class="form-group">
      <label>School Name <span class="required">*</span></label>
      <input type="text" id="f-name" value="${school.name}" />
    </div>
    <div class="form-group">
      <label>Address</label>
      <input type="text" id="f-address" value="${school.address || ''}" />
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

    // Update the matching school in the array
    const idx = schools.findIndex(s => s.id === schoolId);
    schools[idx] = {
      ...schools[idx],
      name:         name,
      address:      document.getElementById('f-address').value.trim(),
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
// Confirms before removing a school permanently
// =============================================
function confirmDeleteSchool(schoolId) {
  const schools = getSchools();
  const school  = schools.find(s => s.id === schoolId);
  if (!school) return;

  if (!confirm(`Remove "${school.name}" from the directory? This cannot be undone.`)) return;

  saveSchools(schools.filter(s => s.id !== schoolId));
  renderDirectory();
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
      <label>Notes (optional)</label>
      <textarea id="f-county-notes" rows="4" placeholder="e.g. Exempt from housing rule, contact admissions office first..."></textarea>
    </div>
  `;

  openModal('Add County', body, function() {
    const name = document.getElementById('f-county-name').value.trim();
    if (!name) { alert('County name is required.'); return; }

    const counties = getCounties();
    counties.push({
      id:    makeId(),
      name:  name,
      notes: document.getElementById('f-county-notes').value.trim(),
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
      <label>Notes</label>
      <textarea id="f-county-notes" rows="4" placeholder="e.g. Exempt from housing rule...">${county.notes || ''}</textarea>
    </div>
  `;

  openModal('Edit County', body, function() {
    const name = document.getElementById('f-county-name').value.trim();
    if (!name) { alert('County name is required.'); return; }

    const idx = counties.findIndex(c => c.id === countyId);
    counties[idx] = {
      ...counties[idx],
      name:  name,
      notes: document.getElementById('f-county-notes').value.trim(),
    };

    saveCounties(counties);
    closeModal();
    renderDirectory();
  });
}

// =============================================
// DELETE COUNTY
// Only allowed if the county has no schools
// =============================================
function confirmDeleteCounty(countyId) {
  const counties = getCounties();
  const county   = counties.find(c => c.id === countyId);
  if (!county) return;

  const schools        = getSchools();
  const countySchools  = schools.filter(s => s.countyId === countyId);

  if (countySchools.length > 0) {
    alert(`Cannot delete "${county.name} County" - it still has ${countySchools.length} school(s). Remove the schools first.`);
    return;
  }

  if (!confirm(`Delete "${county.name} County"? This cannot be undone.`)) return;

  saveCounties(counties.filter(c => c.id !== countyId));
  renderDirectory();
}

// =============================================
// INIT DIRECTORY
// Called when the user navigates to the directory page
// =============================================
function initDirectory() {
  renderDirectory();
}
