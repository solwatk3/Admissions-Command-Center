// =============================================
// ACC - Visit Log
// Records notes from school and fair visits
// No student personal information stored
// =============================================

// Tracks which visit is open for detail view
let activeVisitId = null;
let visitsView    = 'list'; // 'list' or 'detail'

// =============================================
// DATA HELPERS
// =============================================
function getVisits() {
  return loadData('visits', []);
}

function saveVisits(visits) {
  saveData('visits', visits);
}

// =============================================
// INIT VISITS
// Called when navigating to the Visit Log page
// =============================================
function initVisits() {
  visitsView    = 'list';
  activeVisitId = null;
  renderVisits();
}

// =============================================
// ROUTER
// =============================================
function renderVisits() {
  if (visitsView === 'list')   renderVisitList();
  if (visitsView === 'detail') renderVisitDetail(activeVisitId);
}

// =============================================
// VIEW 1 - VISIT LIST
// Shows all visits, most recent first
// =============================================
function renderVisitList() {
  const container = document.getElementById('visits-content');
  if (!container) return;

  const visits  = getVisits();
  const schools = getSchools();

  // Sort most recent first
  const sorted = [...visits].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Group visits by month for easy scanning
  const groups = {};
  sorted.forEach(v => {
    const d     = new Date(v.date);
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (!groups[label]) groups[label] = [];
    groups[label].push(v);
  });

  if (sorted.length === 0) {
    container.innerHTML = `
      <div class="visits-empty">
        <p>No visits logged yet. Hit "+ Log Visit" to add your first one.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = Object.keys(groups).map(month => `
    <div class="visit-group">
      <div class="visit-month-label">${month}</div>
      <div class="visit-cards">
        ${groups[month].map(v => renderVisitCard(v, schools)).join('')}
      </div>
    </div>
  `).join('');
}

// =============================================
// RENDER VISIT CARD
// Summary card for one visit in the list
// =============================================
function renderVisitCard(visit, schools) {
  const school    = schools.find(s => s.id === visit.schoolId);
  const schoolName = school ? school.name : visit.schoolName || 'Unknown School';
  const d         = new Date(visit.date);
  const dateStr   = d.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' });

  const moodIcon = { 'Great': '&#128512;', 'Good': '&#128578;', 'Okay': '&#128528;', 'Tough': '&#128533;' }[visit.mood] || '&#128528;';
  const returnFlag = visit.returnVisit
    ? '<span class="return-flag">&#128260; Return Flagged</span>'
    : '';

  return `
    <div class="visit-card" onclick="openVisitDetail('${visit.id}')">
      <div class="visit-card-left">
        <div class="visit-mood-icon">${moodIcon}</div>
        <div class="visit-card-info">
          <h3 class="visit-school-name">${visit.title || schoolName}</h3>
          ${visit.title ? `<p class="visit-card-school">${schoolName}</p>` : ''}
          <p class="visit-meta">${dateStr} &nbsp;|&nbsp; ~${visit.studentCount || 0} students</p>
        </div>
      </div>
      <div class="visit-card-right">
        ${returnFlag}
        <span class="visit-chevron">&#8250;</span>
      </div>
    </div>
  `;
}

// =============================================
// VIEW 2 - VISIT DETAIL
// Full info for one visit
// =============================================
function openVisitDetail(visitId) {
  visitsView    = 'detail';
  activeVisitId = visitId;
  renderVisits();
}

function renderVisitDetail(visitId) {
  const container = document.getElementById('visits-content');
  if (!container) return;

  const visits  = getVisits();
  const visit   = visits.find(v => v.id === visitId);
  if (!visit) { initVisits(); return; }

  const schools    = getSchools();
  const school     = schools.find(s => s.id === visit.schoolId);
  const schoolName = school ? school.name : visit.schoolName || 'Unknown School';
  const d          = new Date(visit.date);
  const dateStr    = d.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const moodIcon  = { 'Great': '&#128512;', 'Good': '&#128578;', 'Okay': '&#128528;', 'Tough': '&#128533;' }[visit.mood] || '&#128528;';
  const moodLabel = visit.mood || 'Not rated';

  container.innerHTML = `
    <div class="view-header">
      <button class="btn btn-ghost back-btn" onclick="backToVisitList()">&#8592; Back to Visit Log</button>
    </div>

    <div class="visit-detail-card">
      <div class="visit-detail-header">
        <div class="visit-detail-title">
          <h2>${visit.title || schoolName}</h2>
          ${visit.title ? `<p class="visit-detail-school-sub">${schoolName}</p>` : ''}
          <p class="visit-detail-date">${dateStr}</p>
        </div>
        <div class="visit-detail-actions">
          <button class="btn btn-ghost" onclick="openEditVisit('${visit.id}')">&#9998; Edit</button>
          <button class="btn btn-danger" onclick="confirmDeleteVisit('${visit.id}')">&#128465; Delete</button>
        </div>
      </div>

      <div class="visit-detail-body">

        <!-- Top stats row -->
        <div class="visit-stats-row">
          <div class="visit-stat">
            <span class="visit-stat-icon">${moodIcon}</span>
            <span class="visit-stat-label">How it went</span>
            <span class="visit-stat-value">${moodLabel}</span>
          </div>
          <div class="visit-stat">
            <span class="visit-stat-icon">&#128101;</span>
            <span class="visit-stat-label">Students talked to</span>
            <span class="visit-stat-value">~${visit.studentCount || 0}</span>
          </div>
          ${visit.promoCount ? `
          <div class="visit-stat">
            <span class="visit-stat-icon">&#128196;</span>
            <span class="visit-stat-label">Promo materials</span>
            <span class="visit-stat-value">${visit.promoCount}</span>
          </div>` : ''}
          ${visit.returnVisit ? `
          <div class="visit-stat return-stat">
            <span class="visit-stat-icon">&#128260;</span>
            <span class="visit-stat-label">Return visit</span>
            <span class="visit-stat-value">Flagged</span>
          </div>` : ''}
        </div>

        <!-- Notes sections -->
        ${visit.commonQuestions ? `
        <div class="visit-section">
          <h4 class="visit-section-title">&#128172; Most Asked Questions</h4>
          <p class="visit-section-text">${visit.commonQuestions}</p>
        </div>` : ''}

        ${visit.newQuestions ? `
        <div class="visit-section">
          <h4 class="visit-section-title">&#10024; New Questions (Never Heard Before)</h4>
          <p class="visit-section-text">${visit.newQuestions}</p>
        </div>` : ''}

        ${visit.nextTimeNotes ? `
        <div class="visit-section">
          <h4 class="visit-section-title">&#128203; Notes for Next Time</h4>
          <p class="visit-section-text">${visit.nextTimeNotes}</p>
        </div>` : ''}

      </div>
    </div>
  `;
}

function backToVisitList() {
  visitsView    = 'list';
  activeVisitId = null;
  renderVisits();
}

// =============================================
// LOG VISIT FORM
// =============================================
function openLogVisit(preselectedSchoolId) {
  const schools = getSchools().sort((a, b) => a.name.localeCompare(b.name));

  // Pre-fill name if a school is preselected
  const preselectedName = preselectedSchoolId
    ? (schools.find(s => s.id === preselectedSchoolId)?.name || '')
    : '';

  const body = `
    <div class="form-group">
      <label>School <span class="required">*</span></label>
      <div class="school-dropdown-wrapper">
        <input type="text" id="f-school-name" placeholder="Type to search schools..." value="${preselectedName}" autocomplete="off" />
        <ul class="school-dropdown-list hidden" id="school-dd-list"></ul>
      </div>
    </div>
    <div class="form-group">
      <label>Visit Title (optional)</label>
      <input type="text" id="f-title" placeholder="e.g. Fall Visit, College Fair..." />
    </div>
    <div class="form-group">
      <label>Visit Date <span class="required">*</span></label>
      <input type="date" id="f-date" value="${new Date().toISOString().split('T')[0]}" />
    </div>
    <div class="form-group">
      <label>How did it go?</label>
      <select id="f-mood">
        <option value="Great">&#128512; Great</option>
        <option value="Good" selected>&#128578; Good</option>
        <option value="Okay">&#128528; Okay</option>
        <option value="Tough">&#128533; Tough</option>
      </select>
    </div>
    <div class="form-group">
      <label>Approx. students talked to</label>
      <input type="number" id="f-students" placeholder="e.g. 25" min="0" />
    </div>
    <div class="form-group">
      <label>Most asked questions</label>
      <textarea id="f-common-q" rows="3" placeholder="What questions came up most often?"></textarea>
    </div>
    <div class="form-group">
      <label>New questions (never heard before)</label>
      <textarea id="f-new-q" rows="3" placeholder="Any questions that surprised you?"></textarea>
    </div>
    <div class="form-group">
      <label>Notes for next time</label>
      <textarea id="f-next-notes" rows="3" placeholder="What should you remember for the next visit?"></textarea>
    </div>
    <div class="form-group">
      <label>Promo materials handed out (optional)</label>
      <input type="number" id="f-promo" placeholder="e.g. 30" min="0" />
    </div>
    <div class="form-group-inline">
      <input type="checkbox" id="f-return" />
      <label for="f-return">&#128260; Flag for return visit</label>
    </div>
  `;

  openModal('Log a Visit', body, function() {
    // Look up the school by the typed/selected name
    const typedName = document.getElementById('f-school-name').value.trim();
    const school    = schools.find(s => s.name.toLowerCase() === typedName.toLowerCase());
    const date      = document.getElementById('f-date').value;
    if (!typedName || !school) { alert('Please select a valid school from the list.'); return; }
    if (!date)                 { alert('Please enter a date.'); return; }

    const schoolId = school.id;
    const visits   = getVisits();

    visits.push({
      id:             makeId(),
      schoolId:       schoolId,
      schoolName:     school ? school.name : '',   // cache name in case school is deleted later
      title:          document.getElementById('f-title').value.trim(),
      date:           date,
      mood:           document.getElementById('f-mood').value,
      studentCount:   parseInt(document.getElementById('f-students').value) || 0,
      commonQuestions: document.getElementById('f-common-q').value.trim(),
      newQuestions:   document.getElementById('f-new-q').value.trim(),
      nextTimeNotes:  document.getElementById('f-next-notes').value.trim(),
      promoCount:     parseInt(document.getElementById('f-promo').value) || 0,
      returnVisit:    document.getElementById('f-return').checked,
    });

    saveVisits(visits);
    closeModal();
    renderVisits();
    updateDashboardStats();
  });

  // Wire up the custom school dropdown after the modal HTML is in the DOM
  setTimeout(() => initSchoolDropdown('f-school-name', 'school-dd-list', schools), 0);
}

// =============================================
// EDIT VISIT FORM
// =============================================
function openEditVisit(visitId) {
  const visits = getVisits();
  const visit  = visits.find(v => v.id === visitId);
  if (!visit) return;

  const schools = getSchools().sort((a, b) => a.name.localeCompare(b.name));

  // Pre-fill the current school name
  const currentSchool = schools.find(s => s.id === visit.schoolId);
  const currentName   = currentSchool ? currentSchool.name : visit.schoolName || '';

  const body = `
    <div class="form-group">
      <label>School <span class="required">*</span></label>
      <div class="school-dropdown-wrapper">
        <input type="text" id="f-school-name" placeholder="Type to search schools..." value="${currentName}" autocomplete="off" />
        <ul class="school-dropdown-list hidden" id="school-dd-list"></ul>
      </div>
    </div>
    <div class="form-group">
      <label>Visit Title (optional)</label>
      <input type="text" id="f-title" placeholder="e.g. Fall Visit, College Fair..." value="${visit.title || ''}" />
    </div>
    <div class="form-group">
      <label>Visit Date <span class="required">*</span></label>
      <input type="date" id="f-date" value="${visit.date}" />
    </div>
    <div class="form-group">
      <label>How did it go?</label>
      <select id="f-mood">
        <option value="Great" ${visit.mood === 'Great' ? 'selected' : ''}>&#128512; Great</option>
        <option value="Good"  ${visit.mood === 'Good'  ? 'selected' : ''}>&#128578; Good</option>
        <option value="Okay"  ${visit.mood === 'Okay'  ? 'selected' : ''}>&#128528; Okay</option>
        <option value="Tough" ${visit.mood === 'Tough' ? 'selected' : ''}>&#128533; Tough</option>
      </select>
    </div>
    <div class="form-group">
      <label>Approx. students talked to</label>
      <input type="number" id="f-students" value="${visit.studentCount || ''}" min="0" />
    </div>
    <div class="form-group">
      <label>Most asked questions</label>
      <textarea id="f-common-q" rows="3">${visit.commonQuestions || ''}</textarea>
    </div>
    <div class="form-group">
      <label>New questions (never heard before)</label>
      <textarea id="f-new-q" rows="3">${visit.newQuestions || ''}</textarea>
    </div>
    <div class="form-group">
      <label>Notes for next time</label>
      <textarea id="f-next-notes" rows="3">${visit.nextTimeNotes || ''}</textarea>
    </div>
    <div class="form-group">
      <label>Promo materials handed out (optional)</label>
      <input type="number" id="f-promo" value="${visit.promoCount || ''}" min="0" />
    </div>
    <div class="form-group-inline">
      <input type="checkbox" id="f-return" ${visit.returnVisit ? 'checked' : ''} />
      <label for="f-return">&#128260; Flag for return visit</label>
    </div>
  `;

  openModal('Edit Visit', body, function() {
    // Look up the school by the typed/selected name
    const typedName = document.getElementById('f-school-name').value.trim();
    const school    = schools.find(s => s.name.toLowerCase() === typedName.toLowerCase());
    const date      = document.getElementById('f-date').value;
    if (!typedName || !school) { alert('Please select a valid school from the list.'); return; }
    if (!date)                 { alert('Please enter a date.'); return; }

    const schoolId = school.id;
    const idx    = visits.findIndex(v => v.id === visitId);

    visits[idx] = {
      ...visits[idx],
      schoolId:        schoolId,
      schoolName:      school ? school.name : '',
      title:           document.getElementById('f-title').value.trim(),
      date:            date,
      mood:            document.getElementById('f-mood').value,
      studentCount:    parseInt(document.getElementById('f-students').value) || 0,
      commonQuestions: document.getElementById('f-common-q').value.trim(),
      newQuestions:    document.getElementById('f-new-q').value.trim(),
      nextTimeNotes:   document.getElementById('f-next-notes').value.trim(),
      promoCount:      parseInt(document.getElementById('f-promo').value) || 0,
      returnVisit:     document.getElementById('f-return').checked,
    };

    saveVisits(visits);
    closeModal();
    renderVisits();
    updateDashboardStats();
  });

  // Wire up the custom school dropdown after the modal HTML is in the DOM
  setTimeout(() => initSchoolDropdown('f-school-name', 'school-dd-list', schools), 0);
}

// =============================================
// CUSTOM SCHOOL SEARCH DROPDOWN
// Powers the school input in both Log and Edit forms.
// Replaces the native datalist with a fully themed list.
// =============================================
function initSchoolDropdown(inputId, listId, schools) {
  const input = document.getElementById(inputId);
  const list  = document.getElementById(listId);
  if (!input || !list) return;

  // Build and show list items, filtering by whatever is in the input
  function renderOptions(filter) {
    const q       = (filter || '').toLowerCase();
    const matches = schools.filter(s => s.name.toLowerCase().includes(q));
    list.innerHTML = matches.length
      ? matches.map(s =>
          `<li class="school-dd-item" data-id="${s.id}" data-name="${escapeHtml(s.name)}">${escapeHtml(s.name)}</li>`
        ).join('')
      : '<li class="school-dd-item school-dd-no-match">No schools found</li>';
  }

  function showList() {
    renderOptions(input.value);
    list.classList.remove('hidden');
  }

  function hideList() {
    list.classList.add('hidden');
  }

  // Re-filter every keystroke
  input.addEventListener('input', showList);

  // Show all options when the field is focused
  input.addEventListener('focus', showList);

  // Delay hiding so a click on an item can register before blur fires
  input.addEventListener('blur', () => setTimeout(hideList, 150));

  // Clicking an item fills the input and closes the list
  list.addEventListener('mousedown', function(e) {
    const item = e.target.closest('.school-dd-item');
    if (!item || item.classList.contains('school-dd-no-match')) return;
    input.value = item.dataset.name;
    hideList();
  });
}

// Escapes special HTML characters so school names are safe to inject into innerHTML
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// =============================================
// DELETE VISIT
// =============================================
function confirmDeleteVisit(visitId) {
  if (!confirm('Delete this visit log entry? This cannot be undone.')) return;
  const visits = getVisits();
  saveVisits(visits.filter(v => v.id !== visitId));
  backToVisitList();
  updateDashboardStats();
}
