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

// =============================================
// RENDER ROLODEX
// Builds the full colleague list with search
// =============================================
function renderRolodex(filterTerm) {
  const container = document.getElementById('rolodex-content');
  if (!container) return;

  let colleagues = getColleagues();

  // Apply search filter if a term is provided
  if (filterTerm && filterTerm.trim()) {
    const q = filterTerm.trim().toLowerCase();
    colleagues = colleagues.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.institution.toLowerCase().includes(q) ||
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
// Clickable chip - clicking opens the full detail modal
// =============================================
function renderColleagueCard(c) {
  // Build initials for the avatar circle
  const initials = c.name.trim().split(' ')
    .map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return `
    <div class="colleague-card" id="colleague-${c.id}" onclick="openColleagueDetail('${c.id}')">
      <div class="colleague-avatar">${escapeHtml(initials)}</div>
      <div class="colleague-card-text">
        <span class="colleague-name">${escapeHtml(c.name)}</span>
        <span class="colleague-institution">${escapeHtml(c.institution)}</span>
      </div>

      <!-- Hover popup - stopPropagation on all items so they don't also fire the card's detail opener -->
      <div class="colleague-popup" onclick="event.stopPropagation()">
        <p class="popup-institution">${escapeHtml(c.institution)}</p>
        ${c.email ? `<span class="popup-link popup-copy" data-copy="${escapeHtml(c.email)}" onclick="copyToClipboard(this.dataset.copy, this)" title="Click to copy">&#9993; ${escapeHtml(c.email)}</span>` : ''}
        ${c.phone ? `<span class="popup-link popup-copy" data-copy="${escapeHtml(c.phone)}" onclick="copyToClipboard(this.dataset.copy, this)" title="Click to copy">&#128222; ${escapeHtml(c.phone)}</span>` : ''}
        <div class="colleague-actions">
          <button class="btn-icon" onclick="openEditColleague('${c.id}')">&#9998; Edit</button>
          <button class="btn-icon btn-icon-danger" onclick="confirmDeleteColleague('${c.id}')">&#128465; Delete</button>
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
  const c = getColleagues().find(function(x) { return x.id === id; });
  if (!c) return;

  const body = `
    <div class="colleague-detail-view">
      <div class="colleague-detail-row">
        <span class="detail-label">Institution</span>
        <span class="detail-value">${escapeHtml(c.institution)}</span>
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
      ${c.phone ? `
      <div class="colleague-detail-row">
        <span class="detail-label">Phone</span>
        <span class="detail-value">
          <span class="copy-value" data-copy="${escapeHtml(c.phone)}" onclick="copyToClipboard(this.dataset.copy, this)" title="Click to copy">
            &#128222; ${escapeHtml(c.phone)}
          </span>
        </span>
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
      <label>Institution <span class="required">*</span></label>
      <input type="text" id="f-institution" placeholder="e.g. UT Knoxville" list="institution-list" autocomplete="off" />
    </div>
    <div class="form-group">
      <label>Email</label>
      <input type="email" id="f-email" placeholder="mjohnson@utk.edu" />
    </div>
    <div class="form-group">
      <label>Phone</label>
      <input type="tel" id="f-phone" placeholder="(555) 000-0000" />
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
      institution: institution,
      email:       document.getElementById('f-email').value.trim(),
      phone:       formatPhone(document.getElementById('f-phone').value.trim()),
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
  const c          = colleagues.find(x => x.id === id);
  if (!c) return;

  const body = `
    ${buildInstitutionDatalist()}
    <div class="form-group">
      <label>Full Name <span class="required">*</span></label>
      <input type="text" id="f-name" value="${escapeHtml(c.name)}" />
    </div>
    <div class="form-group">
      <label>Institution <span class="required">*</span></label>
      <input type="text" id="f-institution" value="${escapeHtml(c.institution)}" list="institution-list" autocomplete="off" />
    </div>
    <div class="form-group">
      <label>Email</label>
      <input type="email" id="f-email" value="${escapeHtml(c.email || '')}" />
    </div>
    <div class="form-group">
      <label>Phone</label>
      <input type="tel" id="f-phone" value="${escapeHtml(c.phone || '')}" />
    </div>
    <div class="form-group">
      <label>Notes</label>
      <textarea id="f-notes" rows="3">${escapeHtml(c.notes || '')}</textarea>
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
      institution: institution,
      email:       document.getElementById('f-email').value.trim(),
      phone:       formatPhone(document.getElementById('f-phone').value.trim()),
      notes:       document.getElementById('f-notes').value.trim(),
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
