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

  if (events.length === 0) {
    container.innerHTML = `
      <div class="events-empty">
        <p>No events yet. Use the button above to add your first one.</p>
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

  // Append formatted time range if times are set (e.g. "Mon, Jul 21, 2026 · 9:00 AM - 11:00 AM")
  var timeLabel = '';
  if (ev.time) {
    timeLabel = ' &middot; ' + formatEventTime(ev.time);
    if (ev.endTime) timeLabel += ' - ' + formatEventTime(ev.endTime);
  }

  const notesHtml = ev.notes
    ? '<div class="event-notes">' + escapeHtml(ev.notes).replace(/\n/g, '<br>') + '</div>'
    : '';

  return `
    <div class="event-row" onclick="openEditEvent('${ev.id}')">
      <div class="event-row-left">
        <div class="event-type-badge">${escapeHtml(ev.type || 'General')}</div>
        <div class="event-row-info">
          <span class="event-name">${escapeHtml(ev.name)}</span>
          ${notesHtml}
        </div>
      </div>
      <div class="event-row-right">
        <span class="event-date">${dateStr}${timeLabel}</span>
        <button class="btn-icon btn-icon-danger event-delete-btn"
          onclick="event.stopPropagation(); confirmDeleteEvent('${ev.id}')"
          title="Delete event">&#128465;</button>
      </div>
    </div>
  `;
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
        <label>Date <span class="required">*</span></label>
        <input type="date" id="f-event-date" value="${today}" />
      </div>
      <div class="form-group">
        <label>Start Time <span class="form-optional">(optional)</span></label>
        <input type="time" id="f-event-time" />
      </div>
    </div>
    <div class="form-row-split">
      <div class="form-group">
        <label>End Time <span class="form-optional">(optional)</span></label>
        <input type="time" id="f-event-end-time" />
      </div>
      <div class="form-group"></div>
    </div>
    <div class="form-group">
      <label>Notes</label>
      <textarea id="f-event-notes" rows="6" style="min-height:120px; resize:vertical;"
        placeholder="Optional: location, prep needed, who else is attending..."></textarea>
    </div>
  `;

  openModal('Add Event', body, function() {
    const name    = document.getElementById('f-event-name').value.trim();
    const type    = document.getElementById('f-event-type').value.trim();
    const date    = document.getElementById('f-event-date').value;
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
      id:      makeId(),
      name:    name,
      type:    type,
      date:    date,
      time:    time,
      endTime: endTime,
      notes:   notes,
    });

    saveEvents(events);
    closeModal();
    renderEvents();
    // Refresh the unified dashboard calendar so the new event appears
    if (typeof renderDashboardCalendar === 'function') renderDashboardCalendar();
  });
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
        <label>Date <span class="required">*</span></label>
        <input type="date" id="f-event-date" value="${ev.date}" />
      </div>
      <div class="form-group">
        <label>Start Time <span class="form-optional">(optional)</span></label>
        <input type="time" id="f-event-time" value="${ev.time || ''}" />
      </div>
    </div>
    <div class="form-row-split">
      <div class="form-group">
        <label>End Time <span class="form-optional">(optional)</span></label>
        <input type="time" id="f-event-end-time" value="${ev.endTime || ''}" />
      </div>
      <div class="form-group"></div>
    </div>
    <div class="form-group">
      <label>Notes</label>
      <textarea id="f-event-notes" rows="6" style="min-height:120px; resize:vertical;">${escapeHtml(ev.notes || '')}</textarea>
    </div>
  `;

  openModal('Edit Event', body, function() {
    const name    = document.getElementById('f-event-name').value.trim();
    const type    = document.getElementById('f-event-type').value.trim();
    const date    = document.getElementById('f-event-date').value;
    const time    = document.getElementById('f-event-time').value;
    const endTime = document.getElementById('f-event-end-time').value;
    const notes   = document.getElementById('f-event-notes').value.trim();

    if (!name) { alert('Event name is required.'); return; }
    if (!type) { alert('Event type is required.'); return; }
    if (!date) { alert('Date is required.'); return; }

    addEventTypeIfNew(type);

    const idx = events.findIndex(function(e) { return e.id === id; });
    events[idx] = {
      id:      events[idx].id,
      name:    name,
      type:    type,
      date:    date,
      time:    time,
      endTime: endTime,
      notes:   notes,
    };

    saveEvents(events);
    closeModal();
    renderEvents();
    // Refresh the unified dashboard calendar so the edit appears
    if (typeof renderDashboardCalendar === 'function') renderDashboardCalendar();
  });
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
