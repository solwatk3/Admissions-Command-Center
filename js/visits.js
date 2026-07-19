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
  // Clear search and all filter controls every time we land on the Visit Log page
  var searchEl = document.getElementById('visit-search');  if (searchEl) searchEl.value = '';
  var sel = document.getElementById('vf-school');          if (sel) sel.value = '';
  var moodEl = document.getElementById('vf-mood');         if (moodEl) moodEl.value = '';
  var dfEl = document.getElementById('vf-date-from');      if (dfEl) dfEl.value = '';
  var dtEl = document.getElementById('vf-date-to');        if (dtEl) dtEl.value = '';
  var roEl = document.getElementById('vf-return-only');    if (roEl) roEl.checked = false;
  // Reset school dropdown so it repopulates on next open
  var schSel = document.getElementById('vf-school');       if (schSel) delete schSel.dataset.populated;
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
// Shows all visits, most recent first.
// query    - text search string (optional)
// filters  - object with { schoolId, mood, dateFrom, dateTo, returnOnly }
// =============================================
function renderVisitList(query, filters) {
  const container = document.getElementById('visits-content');
  if (!container) return;

  const visits  = getVisits();
  const schools = getSchools();
  const f       = filters || {};

  // Sort most recent first
  let sorted = [...visits].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Apply text search
  if (query && query.trim()) {
    const q = query.trim().toLowerCase();
    sorted = sorted.filter(function(v) {
      const school = schools.find(function(s) { return s.id === v.schoolId; });
      const schoolName = (school ? school.name : v.schoolName || '').toLowerCase();
      return (
        schoolName.includes(q) ||
        (v.title            || '').toLowerCase().includes(q) ||
        (v.commonQuestions  || '').toLowerCase().includes(q) ||
        (v.newQuestions     || '').toLowerCase().includes(q) ||
        (v.nextTimeNotes    || '').toLowerCase().includes(q)
      );
    });
  }

  // School filter
  if (f.schoolId) {
    sorted = sorted.filter(function(v) { return v.schoolId === f.schoolId; });
  }

  // Mood filter
  if (f.mood) {
    sorted = sorted.filter(function(v) { return v.mood === f.mood; });
  }

  // Date range filters - compare date strings directly (they're ISO YYYY-MM-DD)
  if (f.dateFrom) {
    sorted = sorted.filter(function(v) { return v.date >= f.dateFrom; });
  }
  if (f.dateTo) {
    sorted = sorted.filter(function(v) { return v.date <= f.dateTo; });
  }

  // Return-flagged only filter
  if (f.returnOnly) {
    sorted = sorted.filter(function(v) { return !!v.returnVisit; });
  }

  if (sorted.length === 0) {
    const isFiltering = (query && query.trim()) || f.schoolId || f.mood || f.dateFrom || f.dateTo || f.returnOnly;
    const msg = isFiltering
      ? 'No visits match your search or filters.'
      : 'No visits logged yet. Hit "+ Log Visit" to add your first one.';
    container.innerHTML = `<div class="visits-empty"><p>${msg}</p></div>`;
    return;
  }

  // Group visits by month for easy scanning
  const groups = {};
  sorted.forEach(function(v) {
    const d     = new Date(v.date);
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (!groups[label]) groups[label] = [];
    groups[label].push(v);
  });

  container.innerHTML = Object.keys(groups).map(function(month) {
    return `
    <div class="visit-group">
      <div class="visit-month-label">${month}</div>
      <div class="visit-cards">
        ${groups[month].map(function(v) { return renderVisitCard(v, schools); }).join('')}
      </div>
    </div>
    `;
  }).join('');
}

// =============================================
// VISIT FILTERS
// The search box and filter panel all funnel into
// applyVisitFilters(), which reads every control
// and passes the combined query to renderVisitList().
// =============================================

// Toggles the filter panel open or closed
function toggleVisitFilters() {
  var panel = document.getElementById('visit-filter-panel');
  var btn   = document.getElementById('visit-filter-btn');
  if (!panel) return;
  var isHidden = panel.classList.contains('hidden');
  panel.classList.toggle('hidden', !isHidden);
  if (btn) btn.classList.toggle('active-toggle', isHidden);

  // Populate the school dropdown the first time the panel opens
  if (isHidden) populateVisitSchoolFilter();
}

// Fills the school dropdown in the filter panel with all schools that have visits
function populateVisitSchoolFilter() {
  var sel = document.getElementById('vf-school');
  if (!sel || sel.dataset.populated) return;

  var schools = getSchools().sort(function(a, b) { return a.name.localeCompare(b.name); });
  var visits  = getVisits();
  var usedIds = new Set(visits.map(function(v) { return v.schoolId; }));

  var options = schools
    .filter(function(s) { return usedIds.has(s.id); })
    .map(function(s) { return '<option value="' + s.id + '">' + escapeHtml(s.name) + '</option>'; });

  sel.innerHTML = '<option value="">All schools</option>' + options.join('');
  sel.dataset.populated = 'yes';
}

// Reads all filter controls and re-renders the visit list
function applyVisitFilters() {
  if (visitsView !== 'list') return;

  var q          = (document.getElementById('visit-search')   || {}).value  || '';
  var schoolId   = (document.getElementById('vf-school')      || {}).value  || '';
  var mood       = (document.getElementById('vf-mood')        || {}).value  || '';
  var dateFrom   = (document.getElementById('vf-date-from')   || {}).value  || '';
  var dateTo     = (document.getElementById('vf-date-to')     || {}).value  || '';
  var returnOnly = document.getElementById('vf-return-only') ? document.getElementById('vf-return-only').checked : false;

  renderVisitList(q, { schoolId: schoolId, mood: mood, dateFrom: dateFrom, dateTo: dateTo, returnOnly: returnOnly });
}

// Resets all filter controls and re-renders unfiltered
function clearVisitFilters() {
  var sel = document.getElementById('vf-school');
  if (sel) sel.value = '';
  var mood = document.getElementById('vf-mood');
  if (mood) mood.value = '';
  var dateFrom = document.getElementById('vf-date-from');
  if (dateFrom) dateFrom.value = '';
  var dateTo = document.getElementById('vf-date-to');
  if (dateTo) dateTo.value = '';
  var returnOnly = document.getElementById('vf-return-only');
  if (returnOnly) returnOnly.checked = false;
  applyVisitFilters();
}

// Legacy alias - kept in case anything still calls filterVisits(q)
function filterVisits(q) {
  if (visitsView !== 'list') return;
  renderVisitList(q);
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
  // Clear search and filters, then re-render the full list
  var searchEl = document.getElementById('visit-search');
  if (searchEl) searchEl.value = '';
  // Reset filter controls without triggering another render
  var sel = document.getElementById('vf-school');        if (sel) sel.value = '';
  var moodEl = document.getElementById('vf-mood');       if (moodEl) moodEl.value = '';
  var dfEl = document.getElementById('vf-date-from');    if (dfEl) dfEl.value = '';
  var dtEl = document.getElementById('vf-date-to');      if (dtEl) dtEl.value = '';
  var roEl = document.getElementById('vf-return-only');  if (roEl) roEl.checked = false;
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
      <div class="label-with-mic">
        <label>Most asked questions</label>
        <button type="button" class="btn-mic" id="mic-f-common-q" onclick="startVoiceMemo('f-common-q', this)" title="Tap to dictate">&#127908;</button>
      </div>
      <textarea id="f-common-q" rows="3" placeholder="What questions came up most often?"></textarea>
    </div>
    <div class="form-group">
      <div class="label-with-mic">
        <label>New questions (never heard before)</label>
        <button type="button" class="btn-mic" id="mic-f-new-q" onclick="startVoiceMemo('f-new-q', this)" title="Tap to dictate">&#127908;</button>
      </div>
      <textarea id="f-new-q" rows="3" placeholder="Any questions that surprised you?"></textarea>
    </div>
    <div class="form-group">
      <div class="label-with-mic">
        <label>Notes for next time</label>
        <button type="button" class="btn-mic" id="mic-f-next-notes" onclick="startVoiceMemo('f-next-notes', this)" title="Tap to dictate">&#127908;</button>
      </div>
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
      <div class="label-with-mic">
        <label>Most asked questions</label>
        <button type="button" class="btn-mic" id="mic-f-common-q" onclick="startVoiceMemo('f-common-q', this)" title="Tap to dictate">&#127908;</button>
      </div>
      <textarea id="f-common-q" rows="3">${visit.commonQuestions || ''}</textarea>
    </div>
    <div class="form-group">
      <div class="label-with-mic">
        <label>New questions (never heard before)</label>
        <button type="button" class="btn-mic" id="mic-f-new-q" onclick="startVoiceMemo('f-new-q', this)" title="Tap to dictate">&#127908;</button>
      </div>
      <textarea id="f-new-q" rows="3">${visit.newQuestions || ''}</textarea>
    </div>
    <div class="form-group">
      <div class="label-with-mic">
        <label>Notes for next time</label>
        <button type="button" class="btn-mic" id="mic-f-next-notes" onclick="startVoiceMemo('f-next-notes', this)" title="Tap to dictate">&#127908;</button>
      </div>
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
// VOICE MEMO - SPEECH TO TEXT
// Uses the browser's built-in Web Speech API to
// transcribe spoken words and append them to a textarea.
// Works on Chrome desktop, Chrome Android, and iOS Safari (HTTPS required).
// =============================================

// Tracks the active recognition session so we can stop it if the user taps again
let activeRecognition = null;
let activeMicBtn      = null;

function startVoiceMemo(textareaId, btnEl) {
  // Check if the browser supports speech recognition
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('Your browser does not support voice input. Try Chrome or Safari on iOS.');
    return;
  }

  // If already recording, stop the current session
  if (activeRecognition) {
    activeRecognition.stop();
    return;
  }

  const textarea = document.getElementById(textareaId);
  if (!textarea) return;

  const recognition       = new SpeechRecognition();
  recognition.lang        = 'en-US';
  recognition.continuous  = false;   // single utterance per tap
  recognition.interimResults = false; // only return final results

  activeRecognition = recognition;
  activeMicBtn      = btnEl;

  // Show recording state on the button
  btnEl.classList.add('btn-mic-recording');
  btnEl.title = 'Recording... tap to stop';

  recognition.onresult = function(event) {
    // Get the transcribed text from the result
    const transcript = event.results[0][0].transcript;

    // Append to existing text with a space separator
    const existing = textarea.value.trim();
    textarea.value = existing ? existing + ' ' + transcript : transcript;
  };

  recognition.onerror = function(event) {
    // Permission denied is a common one - tell the user clearly
    if (event.error === 'not-allowed') {
      alert('Microphone access was blocked. Please allow microphone permission and try again.');
    }
  };

  recognition.onend = function() {
    // Reset button state once the session ends (either naturally or stopped)
    if (activeMicBtn) {
      activeMicBtn.classList.remove('btn-mic-recording');
      activeMicBtn.title = 'Tap to dictate';
    }
    activeRecognition = null;
    activeMicBtn      = null;
  };

  recognition.start();
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
