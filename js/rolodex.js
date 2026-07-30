// =============================================
// ACC - Colleague Rolodex
// Stores contact info for other admissions counselors
// No student data - colleagues only
// =============================================

// =============================================
// DATA HELPERS
// =============================================
function getColleagues() {
  return loadData('colleagues', []);
}

function saveColleagues(colleagues) {
  saveData('colleagues', colleagues);
}

// Normalizes a raw colleague object to the current data shape.
// Handles two migrations:
// 1. Old single phone string -> phones array with a generic label
// 2. Missing acronym or address fields -> safe empty defaults
// Called on read so old records work without a manual migration script.
function normalizeColleague(c) {
  // Migrate old single phone string to phones array
  var phones;
  if (Array.isArray(c.phones)) {
    phones = c.phones;
  } else if (c.phone && c.phone.trim()) {
    phones = [{ label: 'Phone', number: c.phone.trim() }];
  } else {
    phones = [];
  }

  return {
    id:          c.id          || '',
    name:        c.name        || '',
    institution: c.institution || '',
    acronym:     c.acronym     || '',
    email:       c.email       || '',
    phones:      phones,
    address:     c.address     || { street: '', city: '', zip: '' },
    notes:       c.notes       || '',
  };
}

// Phone label options shown in the dropdown for each phone row
var PHONE_LABELS = ['Office', 'Cell', 'Text', 'Personal', 'Fax', 'Other'];

// Returns the HTML for one phone row (label dropdown + number input + remove button).
// prefill is an optional {label, number} object.
// isFirst controls whether the first row gets the "+ Add Phone" button or an "x".
function phoneRowHtml(prefill, isFirst) {
  var p = prefill || {};
  var labelOptions = PHONE_LABELS.map(function(lbl) {
    return '<option value="' + lbl + '"' + (p.label === lbl ? ' selected' : '') + '>' + lbl + '</option>';
  }).join('');

  return '<div class="c-phone-row">' +
    '<select class="c-phone-label">' + labelOptions + '</select>' +
    '<input type="tel" class="c-phone-number" value="' + escapeHtml(p.number || '') + '" placeholder="(555) 000-0000">' +
    (isFirst
      ? '<button type="button" class="btn-icon btn-icon-add" onclick="addColleaguePhoneRow(this)" title="Add another phone">+</button>'
      : '<button type="button" class="btn-icon btn-icon-danger" onclick="removeColleaguePhoneRow(this)" title="Remove">&#10005;</button>'
    ) +
    '</div>';
}

// Adds a new blank phone row inside the phone list that contains the clicked "+" button.
function addColleaguePhoneRow(btn) {
  var list = btn.closest('.c-phones-list');
  if (!list) return;
  var div = document.createElement('div');
  div.innerHTML = phoneRowHtml(null, false);
  list.appendChild(div.firstElementChild);
}

// Removes the phone row containing the clicked "x" button.
function removeColleaguePhoneRow(btn) {
  var row = btn.closest('.c-phone-row');
  if (row) row.remove();
}

// Reads all phone rows from the modal and returns a clean [{label, number}] array.
// Rows with no number filled in are dropped.
function readColleaguePhones(container) {
  var rows = container.querySelectorAll('.c-phone-row');
  return Array.from(rows).map(function(row) {
    return {
      label:  row.querySelector('.c-phone-label').value,
      number: formatPhone(row.querySelector('.c-phone-number').value.trim()),
    };
  }).filter(function(p) { return p.number.length > 0; });
}

// =============================================
// RENDER ROLODEX
// Builds the full colleague list with search
// =============================================
function renderRolodex(filterTerm) {
  const container = document.getElementById('rolodex-content');
  if (!container) return;

  let colleagues = getColleagues();

  // Apply search filter if a term is provided.
  // Searches name, institution, acronym, and notes.
  if (filterTerm && filterTerm.trim()) {
    const q = filterTerm.trim().toLowerCase();
    colleagues = colleagues.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.institution.toLowerCase().includes(q) ||
      (c.acronym && c.acronym.toLowerCase().includes(q)) ||
      (c.notes && c.notes.toLowerCase().includes(q))
    );
  }

  if (colleagues.length === 0) {
    container.innerHTML = `
      <div class="rolodex-empty">
        <p>${filterTerm ? 'No colleagues match your search.' : 'No colleagues yet. Add your first one above.'}</p>
      </div>
    `;
    return;
  }

  // Sort alphabetically by last name (falls back to full name)
  colleagues.sort((a, b) => {
    const lastName = name => name.trim().split(' ').pop().toLowerCase();
    return lastName(a.name).localeCompare(lastName(b.name));
  });

  // Group by first letter of last name for the A-Z index
  const groups = {};
  colleagues.forEach(c => {
    const letter = c.name.trim().split(' ').pop()[0].toUpperCase();
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(c);
  });

  container.innerHTML = Object.keys(groups).sort().map(letter => `
    <div class="rolodex-group">
      <div class="rolodex-letter">${letter}</div>
      <div class="rolodex-cards">
        ${groups[letter].map(c => renderColleagueCard(c)).join('')}
      </div>
    </div>
  `).join('');
}

// =============================================
// RENDER COLLEAGUE CARD
// Clickable chip - clicking opens the full detail modal.
// Shows acronym as the institution label if set,
// falls back to full institution name if not.
// =============================================
function renderColleagueCard(c) {
  var col = normalizeColleague(c);

  // Build initials for the avatar circle
  const initials = col.name.trim().split(' ')
    .map(w => w[0]).join('').toUpperCase().slice(0, 2);

  // Acronym replaces institution on the card; fall back to full name if blank
  const institutionDisplay = col.acronym || col.institution;

  // First phone in the list for the hover popup (if any)
  const firstPhone = col.phones.length > 0 ? col.phones[0] : null;

  return `
    <div class="colleague-card" id="colleague-${col.id}" onclick="openColleagueDetail('${col.id}')">
      <div class="colleague-avatar">${escapeHtml(initials)}</div>
      <div class="colleague-card-text">
        <span class="colleague-name">${escapeHtml(col.name)}</span>
        <span class="colleague-institution">${escapeHtml(institutionDisplay)}</span>
      </div>

      <!-- Hover popup - stopPropagation so clicks here don't fire the card opener -->
      <div class="colleague-popup" onclick="event.stopPropagation()">
        <p class="popup-institution">${escapeHtml(col.institution)}${col.acronym ? ' <span style="opacity:0.6;">(' + escapeHtml(col.acronym) + ')</span>' : ''}</p>
        ${col.email ? `<span class="popup-link popup-copy" data-copy="${escapeHtml(col.email)}" onclick="copyToClipboard(this.dataset.copy, this)" title="Click to copy">&#9993; ${escapeHtml(col.email)}</span>` : ''}
        ${firstPhone ? `<span class="popup-link popup-copy" data-copy="${escapeHtml(firstPhone.number)}" onclick="copyToClipboard(this.dataset.copy, this)" title="Click to copy">&#128222; ${escapeHtml(firstPhone.number)}</span>` : ''}
        <div class="colleague-actions">
          <button class="btn-icon" onclick="openEditColleague('${col.id}')">&#9998; Edit</button>
          <button class="btn-icon btn-icon-danger" onclick="confirmDeleteColleague('${col.id}')">&#128465; Delete</button>
        </div>
      </div>

    </div>
  `;
}

// =============================================
// COLLEAGUE DETAIL MODAL
// Opens a view-only modal with all contact info
// and Edit / Delete action buttons
// =============================================
function openColleagueDetail(id) {
  const raw = getColleagues().find(function(x) { return x.id === id; });
  if (!raw) return;
  const c = normalizeColleague(raw);

  // Build one clickable row per phone number, showing the label next to the number
  const phonesHtml = c.phones.map(function(p) {
    return `
      <div class="colleague-detail-row">
        <span class="detail-label">${escapeHtml(p.label)}</span>
        <span class="detail-value">
          <span class="copy-value" data-copy="${escapeHtml(p.number)}" onclick="copyToClipboard(this.dataset.copy, this)" title="Click to copy">
            &#128222; ${escapeHtml(p.number)}
          </span>
        </span>
      </div>`;
  }).join('');

  // Build address line if any part is filled in
  const addrParts = [c.address.street, c.address.city, c.address.zip ? 'TN ' + c.address.zip : 'TN'].filter(Boolean);
  const addrDisplay = (c.address.street || c.address.city || c.address.zip)
    ? addrParts.join(', ')
    : '';

  const body = `
    <div class="colleague-detail-view">
      ${c.title ? `
      <div class="colleague-detail-row">
        <span class="detail-label">Title</span>
        <span class="detail-value">${escapeHtml(c.title)}</span>
      </div>` : ''}
      <div class="colleague-detail-row">
        <span class="detail-label">Institution</span>
        <span class="detail-value">
          ${c.acronym ? '<strong>' + escapeHtml(c.acronym) + '</strong> &nbsp;' : ''}
          <span style="opacity:0.8;">${escapeHtml(c.institution)}</span>
        </span>
      </div>
      ${c.email ? `
      <div class="colleague-detail-row">
        <span class="detail-label">Email</span>
        <span class="detail-value">
          <span class="copy-value" data-copy="${escapeHtml(c.email)}" onclick="copyToClipboard(this.dataset.copy, this)" title="Click to copy">
            &#9993; ${escapeHtml(c.email)}
          </span>
        </span>
      </div>` : ''}
      ${phonesHtml}
      ${addrDisplay ? `
      <div class="colleague-detail-row">
        <span class="detail-label">Address</span>
        <span class="detail-value">&#128205; ${escapeHtml(addrDisplay)}</span>
      </div>` : ''}
      ${c.notes ? `
      <div class="colleague-detail-row">
        <span class="detail-label">Notes</span>
        <span class="detail-value">${escapeHtml(c.notes)}</span>
      </div>` : ''}
      <div class="colleague-detail-actions">
        <button class="btn btn-secondary" onclick="closeModal(); openEditColleague('${c.id}')">&#9998; Edit</button>
        <button class="btn btn-danger"    onclick="closeModal(); confirmDeleteColleague('${c.id}')">&#128465; Delete</button>
      </div>
    </div>
  `;

  // null as onSave hides the Save button - this is a view/action modal
  openModal(escapeHtml(c.name), body, null);
}

// =============================================
// INSTITUTION DATALIST
// Returns a datalist element with all unique
// institutions already saved in the rolodex
// =============================================
function buildInstitutionDatalist() {
  const colleagues   = getColleagues();
  const institutions = [...new Set(colleagues.map(c => c.institution).filter(Boolean))].sort();
  return `
    <datalist id="institution-list">
      ${institutions.map(i => `<option value="${escapeHtml(i)}">`).join('')}
    </datalist>
  `;
}

// =============================================
// ADD COLLEAGUE FORM
// =============================================
function openAddColleague() {
  const body = `
    ${buildInstitutionDatalist()}
    <div class="form-group">
      <label>Full Name <span class="required">*</span></label>
      <input type="text" id="f-name" placeholder="e.g. Marcus Johnson" />
    </div>
    <div class="form-group">
      <label>Title</label>
      <input type="text" id="f-title" placeholder="e.g. Associate Director of Admissions" />
    </div>
    <div class="form-group">
      <label>Institution <span class="required">*</span></label>
      <input type="text" id="f-institution" placeholder="e.g. University of Tennessee Knoxville" list="institution-list" autocomplete="off" />
    </div>
    <div class="form-group">
      <label>Acronym</label>
      <input type="text" id="f-acronym" placeholder="e.g. UTK" style="width:120px;" maxlength="12" />
    </div>
    <div class="form-group">
      <label>Email</label>
      <input type="email" id="f-email" placeholder="mjohnson@utk.edu" />
    </div>
    <div class="form-group">
      <label>Phone</label>
      <div class="c-phones-list">${phoneRowHtml(null, true)}</div>
    </div>
    <div class="form-group">
      <label>Street Address</label>
      <input type="text" id="f-street" placeholder="e.g. 615 McCallie Ave" />
    </div>
    <div class="address-city-zip-row">
      <div class="form-group" style="flex:1;">
        <label>City</label>
        <input type="text" id="f-city" placeholder="e.g. Chattanooga" />
      </div>
      <div class="form-group address-state-box">
        <label>State</label>
        <input type="text" value="TN" disabled style="opacity:0.5; cursor:not-allowed;" />
      </div>
      <div class="form-group" style="flex:0 0 90px;">
        <label>ZIP</label>
        <input type="text" id="f-zip" placeholder="37403" maxlength="5" />
      </div>
    </div>
    <div class="form-group">
      <label>Notes</label>
      <textarea id="f-notes" rows="3" placeholder="e.g. Covers same territory, met at Gibson County Fair 2024..."></textarea>
    </div>
  `;

  openModal('Add Colleague', body, function() {
    const name        = document.getElementById('f-name').value.trim();
    const institution = document.getElementById('f-institution').value.trim();
    if (!name)        { alert('Name is required.'); return; }
    if (!institution) { alert('Institution is required.'); return; }

    const colleagues = getColleagues();
    colleagues.push({
      id:          makeId(),
      name:        name,
      title:       document.getElementById('f-title').value.trim(),
      institution: institution,
      acronym:     document.getElementById('f-acronym').value.trim().toUpperCase(),
      email:       document.getElementById('f-email').value.trim(),
      phones:      readColleaguePhones(document.querySelector('.modal-body')),
      address: {
        street: document.getElementById('f-street').value.trim(),
        city:   document.getElementById('f-city').value.trim(),
        zip:    document.getElementById('f-zip').value.trim(),
      },
      notes:       document.getElementById('f-notes').value.trim(),
    });

    saveColleagues(colleagues);
    closeModal();
    renderRolodex(document.getElementById('rolodex-search')?.value);
    updateDashboardStats();
  });
}

// =============================================
// EDIT COLLEAGUE FORM
// =============================================
function openEditColleague(id) {
  const colleagues = getColleagues();
  const raw        = colleagues.find(x => x.id === id);
  if (!raw) return;
  const c = normalizeColleague(raw);

  // Pre-build phone rows from existing data
  const phonesHtml = c.phones.length > 0
    ? c.phones.map(function(p, i) { return phoneRowHtml(p, i === 0); }).join('')
    : phoneRowHtml(null, true);

  const body = `
    ${buildInstitutionDatalist()}
    <div class="form-group">
      <label>Full Name <span class="required">*</span></label>
      <input type="text" id="f-name" value="${escapeHtml(c.name)}" />
    </div>
    <div class="form-group">
      <label>Title</label>
      <input type="text" id="f-title" value="${escapeHtml(c.title || '')}" placeholder="e.g. Associate Director of Admissions" />
    </div>
    <div class="form-group">
      <label>Institution <span class="required">*</span></label>
      <input type="text" id="f-institution" value="${escapeHtml(c.institution)}" list="institution-list" autocomplete="off" />
    </div>
    <div class="form-group">
      <label>Acronym</label>
      <input type="text" id="f-acronym" value="${escapeHtml(c.acronym)}" placeholder="e.g. UTK" style="width:120px;" maxlength="12" />
    </div>
    <div class="form-group">
      <label>Email</label>
      <input type="email" id="f-email" value="${escapeHtml(c.email)}" />
    </div>
    <div class="form-group">
      <label>Phone</label>
      <div class="c-phones-list">${phonesHtml}</div>
    </div>
    <div class="form-group">
      <label>Street Address</label>
      <input type="text" id="f-street" value="${escapeHtml(c.address.street)}" placeholder="e.g. 615 McCallie Ave" />
    </div>
    <div class="address-city-zip-row">
      <div class="form-group" style="flex:1;">
        <label>City</label>
        <input type="text" id="f-city" value="${escapeHtml(c.address.city)}" placeholder="e.g. Chattanooga" />
      </div>
      <div class="form-group address-state-box">
        <label>State</label>
        <input type="text" value="TN" disabled style="opacity:0.5; cursor:not-allowed;" />
      </div>
      <div class="form-group" style="flex:0 0 90px;">
        <label>ZIP</label>
        <input type="text" id="f-zip" value="${escapeHtml(c.address.zip)}" placeholder="37403" maxlength="5" />
      </div>
    </div>
    <div class="form-group">
      <label>Notes</label>
      <textarea id="f-notes" rows="3">${escapeHtml(c.notes)}</textarea>
    </div>
  `;

  openModal('Edit Colleague', body, function() {
    const name        = document.getElementById('f-name').value.trim();
    const institution = document.getElementById('f-institution').value.trim();
    if (!name)        { alert('Name is required.'); return; }
    if (!institution) { alert('Institution is required.'); return; }

    const idx = colleagues.findIndex(x => x.id === id);
    colleagues[idx] = {
      ...colleagues[idx],
      name:        name,
      title:       document.getElementById('f-title').value.trim(),
      institution: institution,
      acronym:     document.getElementById('f-acronym').value.trim().toUpperCase(),
      email:       document.getElementById('f-email').value.trim(),
      phones:      readColleaguePhones(document.querySelector('.modal-body')),
      address: {
        street: document.getElementById('f-street').value.trim(),
        city:   document.getElementById('f-city').value.trim(),
        zip:    document.getElementById('f-zip').value.trim(),
      },
      notes:       document.getElementById('f-notes').value.trim(),
      // Clear old single-phone field so migrated data doesn't linger
      phone: undefined,
    };

    saveColleagues(colleagues);
    closeModal();
    renderRolodex(document.getElementById('rolodex-search')?.value);
  });
}

// =============================================
// DELETE COLLEAGUE
// =============================================
function confirmDeleteColleague(id) {
  const colleagues = getColleagues();
  const c          = colleagues.find(x => x.id === id);
  if (!c) return;

  if (!confirm(`Remove ${c.name} from your rolodex?`)) return;

  saveColleagues(colleagues.filter(x => x.id !== id));
  renderRolodex(document.getElementById('rolodex-search')?.value);
  updateDashboardStats();
}

// =============================================
// INIT ROLODEX
// Called when the user navigates to this page
// =============================================
function initRolodex() {
  // Clear the search bar on each visit
  const search = document.getElementById('rolodex-search');
  if (search) search.value = '';
  renderRolodex();
}
