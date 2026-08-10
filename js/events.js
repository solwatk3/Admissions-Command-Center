// =============================================
// ACC - Upcoming Events
// Non-school events assigned by boss:
// fairs, conferences, open houses, etc.
// =============================================

// =============================================
// DATA HELPERS
// =============================================
function getEvents() {
  return loadData('events', []);
}

function saveEvents(events) {
  saveData('events', events);
}

// Event types the user has created - persist in the dropdown for reuse
function getEventTypes() {
  return loadData('event_types', []);
}

function saveEventTypes(types) {
  saveData('event_types', types);
}

// Save a new type to the list if it doesn't already exist (case-insensitive check)
function addEventTypeIfNew(typeName) {
  if (!typeName || !typeName.trim()) return;
  const normalized = typeName.trim();
  const types = getEventTypes();
  const exists = types.some(function(t) {
    return t.toLowerCase() === normalized.toLowerCase();
  });
  if (!exists) {
    types.push(normalized);
    saveEventTypes(types);
  }
}

// =============================================
// DATALIST FOR EVENT TYPES
// Builds the <datalist> element so the user
// sees their saved types as autocomplete options
// =============================================
function buildEventTypeDatalist() {
  const types = getEventTypes();
  return `
    <datalist id="event-type-list">
      ${types.map(function(t) { return '<option value="' + escapeHtml(t) + '">'; }).join('')}
    </datalist>
  `;
}

// =============================================
// RENDER EVENTS PAGE
// Shows upcoming events first (soonest first),
// then past events (newest first)
// =============================================
function renderEvents() {
  const container = document.getElementById('events-content');
  if (!container) return;

  const events = getEvents();

  if (events.length === 0 && getTentativeEvents().length === 0) {
    container.innerHTML = `
      <div class="events-empty">
        <p>No events yet. Use the buttons above to add your first one.</p>
      </div>
    `;
    return;
  }

  const today = new Date().toISOString().split('T')[0];

  // Split into upcoming (today or later) and past
  const upcoming = events
    .filter(function(e) { return e.date >= today; })
    .sort(function(a, b) { return a.date.localeCompare(b.date); });

  const past = events
    .filter(function(e) { return e.date < today; })
    .sort(function(a, b) { return b.date.localeCompare(a.date); }); // newest first

  let html = '';

  // Tentative events always appear first
  html += renderTentativeEventsSection();

  if (upcoming.length > 0) {
    html += '<div class="events-section-label">Upcoming</div>';
    html += upcoming.map(renderEventRow).join('');
  }

  if (past.length > 0) {
    html += '<div class="events-section-label events-section-past">Past</div>';
    html += past.map(renderEventRow).join('');
  }

  container.innerHTML = html;
}

// =============================================
// RENDER SINGLE EVENT ROW
// Clicking the row opens the edit modal
// =============================================
function renderEventRow(ev) {
  const d = new Date(ev.date);
  // Offset fix - date strings parse as UTC midnight, shift to local time
  const dateStr = new Date(d.getTime() + d.getTimezoneOffset() * 60000)
    .toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  // Build end date label if event spans multiple days
  var endDateLabel = '';
  if (ev.endDate && ev.endDate !== ev.date) {
    var ed    = new Date(ev.endDate);
    var edLoc = new Date(ed.getTime() + ed.getTimezoneOffset() * 60000);
    endDateLabel = ' - ' + edLoc.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // Append formatted time range if times are set (e.g. "· 9:00 AM - 11:00 AM")
  var timeLabel = '';
  if (ev.time) {
    timeLabel = ' &middot; ' + formatEventTime(ev.time);
    if (ev.endTime) timeLabel += ' - ' + formatEventTime(ev.endTime);
  }

  const notesHtml = ev.notes
    ? '<div class="event-notes">' + escapeHtml(ev.notes).replace(/\n/g, '<br>') + '</div>'
    : '';

  // Build the tagged school name list if any schools are associated
  var schoolsHtml = '';
  if (ev.schoolIds && ev.schoolIds.length > 0) {
    var schools     = getSchools();
    var schoolNames = ev.schoolIds.map(function(id) {
      var s = schools.find(function(s) { return s.id === id; });
      return s ? escapeHtml(s.name) : null;
    }).filter(Boolean);
    if (schoolNames.length > 0) {
      schoolsHtml = '<div class="event-school-list">&#127979; ' + schoolNames.join(' &middot; ') + '</div>';
    }
  }

  // Show "Create Route" button if this event has schools tagged
  var createRouteBtn = (ev.schoolIds && ev.schoolIds.length > 0)
    ? `<button class="btn btn-ghost btn-sm event-route-btn"
         onclick="event.stopPropagation(); buildRouteFromEvent('${ev.id}')"
         title="Create a route from the schools at this event">&#128205; Create Route</button>`
    : '';

  return `
    <div class="event-row" onclick="openEditEvent('${ev.id}')">
      <div class="event-row-left">
        <div class="event-type-badge">${escapeHtml(ev.type || 'General')}</div>
        <div class="event-row-info">
          <span class="event-name">${escapeHtml(ev.name)}</span>
          ${notesHtml}
          ${schoolsHtml}
        </div>
      </div>
      <div class="event-row-right">
        <span class="event-date">${dateStr}${endDateLabel}${timeLabel}</span>
        ${createRouteBtn}
        <button class="btn-icon btn-icon-danger event-delete-btn"
          onclick="event.stopPropagation(); confirmDeleteEvent('${ev.id}')"
          title="Delete event">&#128465;</button>
      </div>
    </div>
  `;
}

// =============================================
// SCHOOL PICKER FOR EVENTS
// Tracks which schools are selected in the
// currently open add/edit event modal.
// Stored as an array of school IDs.
// =============================================

// Holds the IDs of schools currently selected in the open modal
var eventSchoolIds = [];

// Builds the school multi-picker HTML - used in both add and edit forms
function buildEventSchoolPicker(preselectedIds) {
  eventSchoolIds = preselectedIds ? preselectedIds.slice() : [];
  return `
    <div class="form-group">
      <label>Schools at This Event <span class="form-optional">(optional)</span></label>
      <div class="event-school-picker">
        <div class="event-school-chips" id="event-school-chips"></div>
        <div class="school-dropdown-wrapper">
          <input type="text" id="f-event-school-search"
            placeholder="Type to search schools..."
            autocomplete="off" />
          <ul class="school-dropdown-list hidden" id="event-school-dd-list"></ul>
        </div>
      </div>
      <small class="form-hint">Tag which schools will be represented at this event.</small>
    </div>
  `;
}

// Renders the selected school chips inside the picker
function renderEventSchoolChips() {
  var chipsEl = document.getElementById('event-school-chips');
  if (!chipsEl) return;
  var schools = getSchools();
  chipsEl.innerHTML = eventSchoolIds.map(function(id) {
    var school = schools.find(function(s) { return s.id === id; });
    var name   = school ? school.name : 'Unknown';
    return `<span class="event-school-chip">
      ${escapeHtml(name)}
      <button type="button" class="chip-remove" onclick="removeEventSchool('${id}')">&times;</button>
    </span>`;
  }).join('');
}

// Adds a school to the selection (ignores duplicates)
function addEventSchool(schoolId) {
  if (!eventSchoolIds.includes(schoolId)) {
    eventSchoolIds.push(schoolId);
    renderEventSchoolChips();
  }
  // Clear and close the dropdown after selection
  var input = document.getElementById('f-event-school-search');
  var list  = document.getElementById('event-school-dd-list');
  if (input) input.value = '';
  if (list)  list.classList.add('hidden');
}

// Removes a school from the selection
function removeEventSchool(schoolId) {
  eventSchoolIds = eventSchoolIds.filter(function(id) { return id !== schoolId; });
  renderEventSchoolChips();
}

// Wires up the school search dropdown inside the event modal
function initEventSchoolDropdown() {
  var input = document.getElementById('f-event-school-search');
  var list  = document.getElementById('event-school-dd-list');
  if (!input || !list) return;

  var schools = getSchools().sort(function(a, b) { return a.name.localeCompare(b.name); });

  function showOptions(filter) {
    var q       = (filter || '').toLowerCase();
    var matches = schools.filter(function(s) { return s.name.toLowerCase().includes(q); });
    list.innerHTML = matches.length
      ? matches.map(function(s) {
          var selected = eventSchoolIds.includes(s.id) ? ' style="opacity:0.4"' : '';
          return `<li class="school-dd-item" data-id="${s.id}" data-name="${escapeHtml(s.name)}"${selected}>${escapeHtml(s.name)}</li>`;
        }).join('')
      : '<li class="school-dd-item school-dd-no-match">No schools found</li>';
    list.classList.remove('hidden');
  }

  input.addEventListener('input',  function() { showOptions(input.value); });
  input.addEventListener('focus',  function() { showOptions(input.value); });
  input.addEventListener('blur',   function() { setTimeout(function() { list.classList.add('hidden'); }, 150); });

  list.addEventListener('mousedown', function(e) {
    var item = e.target.closest('.school-dd-item');
    if (!item || item.classList.contains('school-dd-no-match')) return;
    addEventSchool(item.dataset.id);
  });

  // Render any pre-selected schools right away
  renderEventSchoolChips();
}

// =============================================
// ADD EVENT FORM
// =============================================
function openAddEvent() {
  // Default date to today
  const today = new Date().toISOString().split('T')[0];

  const body = `
    ${buildEventTypeDatalist()}
    <div class="form-group">
      <label>Event Name <span class="required">*</span></label>
      <input type="text" id="f-event-name" placeholder="e.g. Gibson County College Fair" />
    </div>
    <div class="form-group">
      <label>Event Type <span class="required">*</span></label>
      <input type="text" id="f-event-type" placeholder="e.g. College Fair"
        list="event-type-list" autocomplete="off" />
      <small class="form-hint">
        Pick a saved type from the list, or type a new one - it will be saved for next time.
      </small>
    </div>
    <div class="form-row-split">
      <div class="form-group">
        <label>Start Date <span class="required">*</span></label>
        <input type="date" id="f-event-date" value="${today}" />
      </div>
      <div class="form-group">
        <label>End Date <span class="form-optional">(optional)</span></label>
        <input type="date" id="f-event-end-date" />
      </div>
    </div>
    <div class="form-row-split">
      <div class="form-group">
        <label>Start Time <span class="form-optional">(optional)</span></label>
        <input type="time" id="f-event-time" />
      </div>
      <div class="form-group">
        <label>End Time <span class="form-optional">(optional)</span></label>
        <input type="time" id="f-event-end-time" />
      </div>
    </div>
    ${buildEventSchoolPicker([])}
    <div class="form-group">
      <label>Notes</label>
      <textarea id="f-event-notes" rows="4" style="min-height:100px; resize:vertical;"
        placeholder="Optional: location, prep needed, who else is attending..."></textarea>
    </div>
  `;

  openModal('Add Event', body, function() {
    const name    = document.getElementById('f-event-name').value.trim();
    const type    = document.getElementById('f-event-type').value.trim();
    const date    = document.getElementById('f-event-date').value;
    const endDate = document.getElementById('f-event-end-date').value;
    const time    = document.getElementById('f-event-time').value;
    const endTime = document.getElementById('f-event-end-time').value;
    const notes   = document.getElementById('f-event-notes').value.trim();

    if (!name) { alert('Event name is required.'); return; }
    if (!type) { alert('Event type is required.'); return; }
    if (!date) { alert('Date is required.'); return; }

    // Save the type to the persistent list if it's new
    addEventTypeIfNew(type);

    const events = getEvents();
    events.push({
      id:        makeId(),
      name:      name,
      type:      type,
      date:      date,
      endDate:   endDate,
      time:      time,
      endTime:   endTime,
      notes:     notes,
      schoolIds: eventSchoolIds.slice(), // copy of selected school IDs
    });

    saveEvents(events);
    closeModal();
    renderEvents();
    // Refresh the unified dashboard calendar so the new event appears
    if (typeof renderDashboardCalendar === 'function') renderDashboardCalendar();
  });

  // Wire up the school picker after the modal is in the DOM
  setTimeout(initEventSchoolDropdown, 0);
}

// =============================================
// EDIT EVENT FORM
// =============================================
function openEditEvent(id) {
  const events = getEvents();
  const ev = events.find(function(e) { return e.id === id; });
  if (!ev) return;

  const body = `
    ${buildEventTypeDatalist()}
    <div class="form-group">
      <label>Event Name <span class="required">*</span></label>
      <input type="text" id="f-event-name" value="${escapeHtml(ev.name)}" />
    </div>
    <div class="form-group">
      <label>Event Type <span class="required">*</span></label>
      <input type="text" id="f-event-type" value="${escapeHtml(ev.type || '')}"
        list="event-type-list" autocomplete="off" />
      <small class="form-hint">
        Pick a saved type from the list, or type a new one - it will be saved for next time.
      </small>
    </div>
    <div class="form-row-split">
      <div class="form-group">
        <label>Start Date <span class="required">*</span></label>
        <input type="date" id="f-event-date" value="${ev.date}" />
      </div>
      <div class="form-group">
        <label>End Date <span class="form-optional">(optional)</span></label>
        <input type="date" id="f-event-end-date" value="${ev.endDate || ''}" />
      </div>
    </div>
    <div class="form-row-split">
      <div class="form-group">
        <label>Start Time <span class="form-optional">(optional)</span></label>
        <input type="time" id="f-event-time" value="${ev.time || ''}" />
      </div>
      <div class="form-group">
        <label>End Time <span class="form-optional">(optional)</span></label>
        <input type="time" id="f-event-end-time" value="${ev.endTime || ''}" />
      </div>
    </div>
    ${buildEventSchoolPicker(ev.schoolIds || [])}
    <div class="form-group">
      <label>Notes</label>
      <textarea id="f-event-notes" rows="4" style="min-height:100px; resize:vertical;">${escapeHtml(ev.notes || '')}</textarea>
    </div>
  `;

  openModal('Edit Event', body, function() {
    const name    = document.getElementById('f-event-name').value.trim();
    const type    = document.getElementById('f-event-type').value.trim();
    const date    = document.getElementById('f-event-date').value;
    const endDate = document.getElementById('f-event-end-date').value;
    const time    = document.getElementById('f-event-time').value;
    const endTime = document.getElementById('f-event-end-time').value;
    const notes   = document.getElementById('f-event-notes').value.trim();

    if (!name) { alert('Event name is required.'); return; }
    if (!type) { alert('Event type is required.'); return; }
    if (!date) { alert('Date is required.'); return; }

    addEventTypeIfNew(type);

    const idx = events.findIndex(function(e) { return e.id === id; });
    events[idx] = {
      id:        events[idx].id,
      name:      name,
      type:      type,
      date:      date,
      endDate:   endDate,
      time:      time,
      endTime:   endTime,
      notes:     notes,
      schoolIds: eventSchoolIds.slice(), // copy of selected school IDs
    };

    saveEvents(events);
    closeModal();
    renderEvents();
    // Refresh the unified dashboard calendar so the edit appears
    if (typeof renderDashboardCalendar === 'function') renderDashboardCalendar();
  });

  // Wire up the school picker after the modal is in the DOM
  setTimeout(initEventSchoolDropdown, 0);
}

// =============================================
// DELETE EVENT
// =============================================
function confirmDeleteEvent(id) {
  const events = getEvents();
  const ev = events.find(function(e) { return e.id === id; });
  if (!ev) return;

  if (!confirm('Delete "' + ev.name + '"?')) return;

  saveEvents(events.filter(function(e) { return e.id !== id; }));
  renderEvents();
  // Remove the corresponding GCal event if synced
  if (typeof deleteCalendarAccEvent === 'function') deleteCalendarAccEvent(id);
  // Refresh the unified dashboard calendar so the deleted event is removed
  if (typeof renderDashboardCalendar === 'function') renderDashboardCalendar();
}

// =============================================
// DASHBOARD CARD - UPCOMING EVENTS
// Shows the next few events on the main dashboard.
// Called from updateDashboardStats() in app.js.
// =============================================
function renderUpcomingEvents() {
  const container = document.getElementById('dashboard-events');
  if (!container) return;

  const today = new Date().toISOString().split('T')[0];
  const upcoming = getEvents()
    .filter(function(e) { return e.date >= today; })
    .sort(function(a, b) { return a.date.localeCompare(b.date); })
    .slice(0, 5); // show at most 5 on the dashboard

  if (upcoming.length === 0) {
    container.innerHTML = '<p class="empty-state">No upcoming events. Add one on the Events page.</p>';
    return;
  }

  container.innerHTML = upcoming.map(function(ev) {
    const d = new Date(ev.date);
    const dateStr = new Date(d.getTime() + d.getTimezoneOffset() * 60000)
      .toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' });
    return `
      <div class="upcoming-event-row" onclick="navigateTo('events')">
        <div class="upcoming-event-icon">&#128197;</div>
        <div class="upcoming-event-info">
          <span class="upcoming-event-name">${escapeHtml(ev.name)}</span>
          <span class="upcoming-event-meta">${dateStr} &nbsp;&middot;&nbsp; ${escapeHtml(ev.type || 'General')}</span>
        </div>
      </div>
    `;
  }).join('');
}

// =============================================
// INIT EVENTS PAGE
// Called by navigateTo() each time the user
// navigates to the Events section
// =============================================
function initEvents() {
  renderEvents();
}

// =============================================
// TENTATIVE EVENTS
// Events not yet confirmed. Stored separately
// in acc_tentative_events so they never appear
// in the main Events list until confirmed.
// Structure: {id, name, type, date, notes,
//             hostSchoolId, schoolIds[]}
// =============================================

// Tracks form state while the add-tentative modal is open
var tentativeHostSchoolId       = null;
var tentativeAttendingSchoolIds = [];

function getTentativeEvents() {
  return loadData('tentative_events', []);
}

function saveTentativeEvents(events) {
  saveData('tentative_events', events);
}

function resetTentativeFormState() {
  tentativeHostSchoolId       = null;
  tentativeAttendingSchoolIds = [];
}

// =============================================
// ADD TENTATIVE EVENT FORM
// =============================================
function openAddTentativeEvent() {
  resetTentativeFormState();
  var today = new Date().toISOString().split('T')[0];

  var body = `
    ${buildEventTypeDatalist()}
    <div class="form-group">
      <label>Event Name <span class="required">*</span></label>
      <input type="text" id="f-tent-name" placeholder="e.g. Gibson County College Fair" />
    </div>
    <div class="form-group">
      <label>Event Type <span class="form-optional">(optional)</span></label>
      <input type="text" id="f-tent-type" placeholder="e.g. College Fair"
        list="event-type-list" autocomplete="off" />
    </div>
    <div class="form-group">
      <label>Expected Date <span class="required">*</span></label>
      <input type="date" id="f-tent-date" value="${today}" />
    </div>
    <div class="form-group">
      <label>Host School <span class="required">*</span></label>
      <small class="form-hint">The school where the event will be physically held.</small>
      <div class="school-dropdown-wrapper" style="margin-top:0.4rem;">
        <input type="text" id="f-tent-host-school"
          placeholder="Type to search schools..." autocomplete="off" />
        <ul class="school-dropdown-list hidden" id="tent-host-dd-list"></ul>
      </div>
      <div id="tent-host-selected"></div>
    </div>
    <div class="form-group">
      <label>Attending Schools <span class="form-optional">(optional)</span></label>
      <small class="form-hint">Other schools whose students will be at this event.</small>
      <div class="event-school-picker" style="margin-top:0.4rem;">
        <div class="event-school-chips" id="tent-attending-chips"></div>
        <div class="school-dropdown-wrapper">
          <input type="text" id="f-tent-attending-search"
            placeholder="Type to search schools..." autocomplete="off" />
          <ul class="school-dropdown-list hidden" id="tent-attending-dd-list"></ul>
        </div>
      </div>
    </div>
    <div class="form-group">
      <label>Notes <span class="form-optional">(optional)</span></label>
      <textarea id="f-tent-notes" rows="3"
        placeholder="Location, contact, what you are waiting on..."></textarea>
    </div>
  `;

  openModal('Add Tentative Event', body, function() {
    var name  = document.getElementById('f-tent-name').value.trim();
    var type  = document.getElementById('f-tent-type').value.trim();
    var date  = document.getElementById('f-tent-date').value;
    var notes = document.getElementById('f-tent-notes').value.trim();

    if (!name)                  { alert('Event name is required.'); return; }
    if (!date)                  { alert('Date is required.'); return; }
    if (!tentativeHostSchoolId) { alert('Please select a host school.'); return; }

    if (type) addEventTypeIfNew(type);

    var events = getTentativeEvents();
    events.push({
      id:           makeId(),
      name:         name,
      type:         type,
      date:         date,
      notes:        notes,
      hostSchoolId: tentativeHostSchoolId,
      schoolIds:    tentativeAttendingSchoolIds.slice(),
    });
    saveTentativeEvents(events);
    closeModal();
    renderEvents();
    if (typeof renderDashboardCalendar === 'function') renderDashboardCalendar();
  });

  setTimeout(function() {
    initTentativeHostPicker();
    initTentativeAttendingPicker();
  }, 0);
}

// Single-select host school picker - replaces previous selection on click
function initTentativeHostPicker() {
  var input    = document.getElementById('f-tent-host-school');
  var list     = document.getElementById('tent-host-dd-list');
  var selectedEl = document.getElementById('tent-host-selected');
  if (!input || !list) return;

  var schools = getSchools().sort(function(a, b) { return a.name.localeCompare(b.name); });

  function showOptions(filter) {
    var q       = (filter || '').toLowerCase();
    var matches = schools.filter(function(s) { return s.name.toLowerCase().includes(q); });
    list.innerHTML = matches.length
      ? matches.map(function(s) {
          return '<li class="school-dd-item" data-id="' + s.id + '" data-name="'
            + escapeHtml(s.name) + '">' + escapeHtml(s.name) + '</li>';
        }).join('')
      : '<li class="school-dd-item school-dd-no-match">No schools found</li>';
    list.classList.remove('hidden');
  }

  input.addEventListener('input', function() { showOptions(input.value); });
  input.addEventListener('focus', function() { showOptions(input.value); });
  input.addEventListener('blur',  function() { setTimeout(function() { list.classList.add('hidden'); }, 150); });

  list.addEventListener('mousedown', function(e) {
    var item = e.target.closest('.school-dd-item');
    if (!item || item.classList.contains('school-dd-no-match')) return;
    tentativeHostSchoolId = item.dataset.id;
    // Show selected chip and clear the input
    if (selectedEl) {
      selectedEl.innerHTML = '<span class="event-school-chip tent-host-chip">'
        + '&#128205; ' + escapeHtml(item.dataset.name)
        + '<button type="button" class="chip-remove" onclick="clearTentativeHost()">&times;</button>'
        + '</span>';
    }
    input.value = '';
    list.classList.add('hidden');
  });
}

// Clears the selected host school
function clearTentativeHost() {
  tentativeHostSchoolId = null;
  var el = document.getElementById('tent-host-selected');
  if (el) el.innerHTML = '';
}

// Multi-select attending schools picker - same chip pattern as event school picker
function initTentativeAttendingPicker() {
  var input = document.getElementById('f-tent-attending-search');
  var list  = document.getElementById('tent-attending-dd-list');
  if (!input || !list) return;

  var schools = getSchools().sort(function(a, b) { return a.name.localeCompare(b.name); });

  function renderAttendingChips() {
    var chips = document.getElementById('tent-attending-chips');
    if (!chips) return;
    chips.innerHTML = tentativeAttendingSchoolIds.map(function(id) {
      var s    = schools.find(function(s) { return s.id === id; });
      var name = s ? s.name : 'Unknown';
      return '<span class="event-school-chip">' + escapeHtml(name)
        + '<button type="button" class="chip-remove" '
        + 'onclick="removeTentativeAttendingSchool(\'' + id + '\')">&times;</button></span>';
    }).join('');
  }

  function showOptions(filter) {
    var q       = (filter || '').toLowerCase();
    // Exclude the host school and already-selected schools from the list
    var matches = schools.filter(function(s) {
      return s.name.toLowerCase().includes(q)
        && s.id !== tentativeHostSchoolId
        && !tentativeAttendingSchoolIds.includes(s.id);
    });
    list.innerHTML = matches.length
      ? matches.map(function(s) {
          return '<li class="school-dd-item" data-id="' + s.id + '" data-name="'
            + escapeHtml(s.name) + '">' + escapeHtml(s.name) + '</li>';
        }).join('')
      : '<li class="school-dd-item school-dd-no-match">No schools found</li>';
    list.classList.remove('hidden');
  }

  input.addEventListener('input', function() { showOptions(input.value); });
  input.addEventListener('focus', function() { showOptions(input.value); });
  input.addEventListener('blur',  function() { setTimeout(function() { list.classList.add('hidden'); }, 150); });

  list.addEventListener('mousedown', function(e) {
    var item = e.target.closest('.school-dd-item');
    if (!item || item.classList.contains('school-dd-no-match')) return;
    tentativeAttendingSchoolIds.push(item.dataset.id);
    renderAttendingChips();
    input.value = '';
    list.classList.add('hidden');
  });
}

// Removes one school from the attending list and re-renders chips
function removeTentativeAttendingSchool(schoolId) {
  tentativeAttendingSchoolIds = tentativeAttendingSchoolIds.filter(function(id) { return id !== schoolId; });
  var chips   = document.getElementById('tent-attending-chips');
  if (!chips) return;
  var schools = getSchools();
  chips.innerHTML = tentativeAttendingSchoolIds.map(function(id) {
    var s    = schools.find(function(s) { return s.id === id; });
    var name = s ? s.name : 'Unknown';
    return '<span class="event-school-chip">' + escapeHtml(name)
      + '<button type="button" class="chip-remove" '
      + 'onclick="removeTentativeAttendingSchool(\'' + id + '\')">&times;</button></span>';
  }).join('');
}

// =============================================
// CONFIRM TENTATIVE EVENT
// Moves the record from acc_tentative_events
// into acc_events. Host school is merged into
// schoolIds so the tag carries over.
// =============================================
function confirmTentativeEvent(tentativeId) {
  if (!confirm('Confirm this event? It will move to your main Events list.')) return;

  var tentative = getTentativeEvents();
  var ev        = tentative.find(function(e) { return e.id === tentativeId; });
  if (!ev) return;

  // Include host school in the schoolIds tag list on the confirmed event
  var allSchoolIds = [ev.hostSchoolId]
    .concat(ev.schoolIds || [])
    .filter(function(id, idx, arr) { return id && arr.indexOf(id) === idx; });

  var events = getEvents();
  events.push({
    id:        makeId(),
    name:      ev.name,
    type:      ev.type || '',
    date:      ev.date,
    endDate:   '',
    time:      '',
    endTime:   '',
    notes:     ev.notes || '',
    schoolIds: allSchoolIds,
  });
  saveEvents(events);

  // Remove from tentative list
  saveTentativeEvents(tentative.filter(function(e) { return e.id !== tentativeId; }));

  // Re-render both pages
  if (typeof renderDirectory === 'function') renderDirectory();
  renderEvents();
  if (typeof renderDashboardCalendar === 'function') renderDashboardCalendar();
  alert('"' + ev.name + '" confirmed and moved to your Events list.');
}

// =============================================
// DELETE TENTATIVE EVENT
// =============================================
function deleteTentativeEvent(tentativeId) {
  if (!confirm('Remove this tentative event?')) return;
  saveTentativeEvents(getTentativeEvents().filter(function(e) { return e.id !== tentativeId; }));
  if (typeof renderDirectory === 'function') renderDirectory();
  renderEvents();
}

// =============================================
// RENDER TENTATIVE EVENTS ON SCHOOL DETAIL PAGE
// Shows events where this school is the host OR
// an attending school, with the correct badge.
// Returns HTML string (empty string if none).
// =============================================
function renderSchoolTentativeEvents(schoolId) {
  var all = getTentativeEvents();

  var relevant = all.filter(function(ev) {
    return ev.hostSchoolId === schoolId
      || (ev.schoolIds || []).includes(schoolId);
  });

  if (relevant.length === 0) return '';

  relevant.sort(function(a, b) { return a.date.localeCompare(b.date); });

  var schools = getSchools();

  return relevant.map(function(ev) {
    var isHost = ev.hostSchoolId === schoolId;

    var roleBadge = isHost
      ? '<span class="tent-role-badge tent-hosting">&#128205; Hosting</span>'
      : '<span class="tent-role-badge tent-attending">&#128206; Attending</span>';

    var d       = new Date(ev.date);
    var dateStr = new Date(d.getTime() + d.getTimezoneOffset() * 60000)
      .toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

    // Show context - attending schools if hosting, or host school if attending
    var contextLine = '';
    if (isHost && ev.schoolIds && ev.schoolIds.length > 0) {
      var attendingNames = ev.schoolIds.map(function(id) {
        var s = schools.find(function(s) { return s.id === id; });
        return s ? s.name : null;
      }).filter(Boolean);
      if (attendingNames.length > 0) {
        contextLine = '<span class="school-visit-card-meta">Also attending: '
          + escapeHtml(attendingNames.join(', ')) + '</span>';
      }
    } else if (!isHost) {
      var host = schools.find(function(s) { return s.id === ev.hostSchoolId; });
      if (host) {
        contextLine = '<span class="school-visit-card-meta">Hosted at: '
          + escapeHtml(host.name) + '</span>';
      }
    }

    return `
      <div class="school-visit-card tentative-card">
        <div class="school-visit-card-left">
          <span class="visit-mood-icon">&#10067;</span>
          <div class="school-visit-card-info">
            <span class="school-visit-card-title">${escapeHtml(ev.name)}</span>
            <span class="school-visit-card-date">${dateStr}&nbsp;&nbsp;${roleBadge}</span>
            ${ev.type ? '<span class="school-visit-card-meta">' + escapeHtml(ev.type) + '</span>' : ''}
            ${contextLine}
            ${ev.notes ? '<span class="school-visit-card-meta">' + escapeHtml(ev.notes) + '</span>' : ''}
          </div>
        </div>
        <div class="school-visit-card-right">
          <button class="btn btn-sm btn-confirm-event"
            onclick="confirmTentativeEvent('${ev.id}')">&#10003; Confirm</button>
          <button class="btn-icon-danger"
            onclick="deleteTentativeEvent('${ev.id}')" title="Remove">&#10005;</button>
        </div>
      </div>
    `;
  }).join('');
}

// =============================================
// RENDER TENTATIVE SECTION ON EVENTS PAGE
// Shows a "Pending Confirmation" section above
// the confirmed events list.
// =============================================
function renderTentativeEventsSection() {
  var all = getTentativeEvents();
  if (all.length === 0) return '';

  all.sort(function(a, b) { return a.date.localeCompare(b.date); });

  var schools = getSchools();

  var rows = all.map(function(ev) {
    var d       = new Date(ev.date);
    var dateStr = new Date(d.getTime() + d.getTimezoneOffset() * 60000)
      .toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

    var host        = schools.find(function(s) { return s.id === ev.hostSchoolId; });
    var hostName    = host ? host.name : 'Unknown school';
    var attendCount = (ev.schoolIds || []).length;
    var attendLabel = attendCount > 0 ? ' + ' + attendCount + ' attending' : '';

    return `
      <div class="event-row tentative-event-row">
        <div class="event-row-left">
          <div class="event-type-badge tentative-badge">Tentative</div>
          <div class="event-row-info">
            <span class="event-name">${escapeHtml(ev.name)}</span>
            <div class="event-school-list">&#128205; ${escapeHtml(hostName)}${escapeHtml(attendLabel)}</div>
          </div>
        </div>
        <div class="event-row-right">
          <span class="event-date">${dateStr}</span>
          <button class="btn btn-sm btn-confirm-event"
            onclick="event.stopPropagation(); confirmTentativeEvent('${ev.id}')">&#10003; Confirm</button>
          <button class="btn-icon btn-icon-danger"
            onclick="event.stopPropagation(); deleteTentativeEvent('${ev.id}')"
            title="Remove tentative event">&#128465;</button>
        </div>
      </div>
    `;
  }).join('');

  return '<div class="events-section-label events-tentative-label">&#10067; Pending Confirmation</div>'
    + rows;
}
