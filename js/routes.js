// =============================================
// ACC - Route Planner
// Plan school visit routes with multiple stops.
// Saves routes to localStorage, opens in Google Maps,
// and shows a 48-hour reminder banner when a route is coming up.
// =============================================

let routesView     = 'list';
let activeRouteId  = null;
let editingRouteId = null;  // null = new route, otherwise = ID of route being edited

// Temporary stop list while the builder is open.
// Kept in memory so re-rendering stop rows doesn't wipe unsaved stops.
let builderStops = [];

// =============================================
// DATA HELPERS
// =============================================
function getRoutes() {
  return loadData('routes', []);
}

function saveRoutes(routes) {
  saveData('routes', routes);
}

// =============================================
// INIT
// Called by navigateTo() when the user switches to this page
// =============================================
function initRoutes() {
  routesView     = 'list';
  activeRouteId  = null;
  editingRouteId = null;
  builderStops   = [];
  renderRoutes();
}

// =============================================
// ROUTER
// =============================================
function renderRoutes() {
  if (routesView === 'list')    renderRouteList();
  if (routesView === 'builder') renderRouteBuilder();
  if (routesView === 'detail')  renderRouteDetail(activeRouteId);
}

// =============================================
// VIEW 1 - ROUTE LIST
// Shows all saved routes grouped into upcoming and past
// =============================================
function renderRouteList() {
  const container = document.getElementById('routes-content');
  if (!container) return;

  const routes = getRoutes();
  const now    = new Date();
  now.setHours(0, 0, 0, 0); // compare by date only, not time

  // Split into upcoming (today and forward) and past
  const upcoming = routes
    .filter(r => new Date(r.date) >= now)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const past = routes
    .filter(r => new Date(r.date) < now)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // Build the 48-hour reminder banner (shows above everything else)
  const reminderHtml = buildReminderBanner(routes);

  if (routes.length === 0) {
    container.innerHTML = `
      ${reminderHtml}
      <div class="routes-empty">
        <p>No routes saved yet. Hit "+ New Route" above to plan your first one.</p>
      </div>
    `;
    return;
  }

  const sections = [];

  if (upcoming.length > 0) {
    sections.push(`
      <div class="route-group">
        <div class="route-group-label">Upcoming</div>
        <div class="route-cards">${upcoming.map(r => renderRouteCard(r)).join('')}</div>
      </div>
    `);
  }

  if (past.length > 0) {
    sections.push(`
      <div class="route-group">
        <div class="route-group-label">Past Routes</div>
        <div class="route-cards">${past.map(r => renderRouteCard(r)).join('')}</div>
      </div>
    `);
  }

  container.innerHTML = reminderHtml + sections.join('');
}

// =============================================
// 48-HOUR REMINDER BANNER
// Shown at the top of the list when a route is within the next 48 hours
// =============================================
function buildReminderBanner(routes) {
  const now     = new Date();
  const in48hrs = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  // Find routes happening in the next 48 hours that haven't been dismissed
  const urgent = routes.filter(r => {
    const d = new Date(r.date);
    return d >= now && d <= in48hrs && !r.reminderDismissed;
  });

  if (urgent.length === 0) return '';

  return urgent.map(r => {
    const dateStr = new Date(r.date).toLocaleDateString('default', {
      weekday: 'long', month: 'short', day: 'numeric'
    });
    return `
      <div class="route-reminder-banner" id="reminder-${r.id}">
        <span class="reminder-icon">&#9200;</span>
        <div class="reminder-text">
          <strong>${r.name}</strong> is coming up on ${dateStr} &mdash;
          ${r.stops.length} stop${r.stops.length !== 1 ? 's' : ''}.
        </div>
        <div class="reminder-actions">
          <button class="btn btn-accent btn-sm" onclick="openRouteDetail('${r.id}')">View Route</button>
          <button class="btn btn-ghost btn-sm" onclick="dismissReminder('${r.id}')">Dismiss</button>
        </div>
      </div>
    `;
  }).join('');
}

// Marks a reminder as dismissed and hides the banner without a full re-render
function dismissReminder(routeId) {
  const routes = getRoutes();
  const idx    = routes.findIndex(r => r.id === routeId);
  if (idx === -1) return;
  routes[idx].reminderDismissed = true;
  saveRoutes(routes);
  const banner = document.getElementById('reminder-' + routeId);
  if (banner) banner.remove();
}

// =============================================
// ROUTE CARD (list view)
// Summary row for one route
// =============================================
function renderRouteCard(route) {
  const d       = new Date(route.date);
  const dateStr = d.toLocaleDateString('default', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });

  const now    = new Date();
  now.setHours(0, 0, 0, 0);
  const isPast = d < now;

  // Show stop names as a preview arrow chain
  const preview = route.stops.map(s => s.name).join(' → ');

  // Show overall time range if any stops have times
  const timed       = route.stops.filter(s => s.startTime);
  const firstTime   = timed.length ? formatTime(timed[0].startTime) : null;
  const lastStop    = timed.length ? timed[timed.length - 1] : null;
  const lastTime    = lastStop ? formatTime(lastStop.endTime || lastStop.startTime) : null;
  const timeRangeStr = firstTime && lastTime ? ` &nbsp;|&nbsp; ${firstTime} - ${lastTime}` : '';

  return `
    <div class="route-card ${isPast ? 'route-card-past' : ''}" onclick="openRouteDetail('${route.id}')">
      <div class="route-card-info">
        <h3 class="route-card-name">${route.name}</h3>
        <p class="route-card-meta">${dateStr} &nbsp;|&nbsp; ${route.stops.length} stop${route.stops.length !== 1 ? 's' : ''}${timeRangeStr}</p>
        <p class="route-card-preview">${preview}</p>
      </div>
      <span class="route-chevron">&#8250;</span>
    </div>
  `;
}

// =============================================
// VIEW 2 - ROUTE DETAIL
// Full view of one route with Maps and email buttons
// =============================================
function openRouteDetail(routeId) {
  routesView    = 'detail';
  activeRouteId = routeId;
  renderRoutes();
}

function renderRouteDetail(routeId) {
  const container = document.getElementById('routes-content');
  if (!container) return;

  const routes = getRoutes();
  const route  = routes.find(r => r.id === routeId);
  if (!route) { initRoutes(); return; }

  const d       = new Date(route.date);
  const dateStr = d.toLocaleDateString('default', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  // Pick the right maps URL based on device:
  // iPhone/iPad gets Apple Maps (opens the native Maps app directly),
  // everything else gets Google Maps.
  const mapsUrl   = isIOS()
    ? buildAppleMapsUrl(route.stops, route.origin)
    : buildMapsUrl(route.stops, route.origin);
  const mapsLabel = isIOS() ? '&#128205; Open in Apple Maps' : '&#128205; Open in Google Maps';

  container.innerHTML = `
    <div class="view-header">
      <button class="btn btn-ghost back-btn" onclick="initRoutes()">&#8592; Back to Routes</button>
    </div>

    <div class="route-detail-card">
      <div class="route-detail-header">
        <div class="route-detail-title">
          <h2>${route.name}</h2>
          <p class="route-detail-date">&#128197; ${dateStr}</p>
        </div>
        <div class="route-detail-actions">
          <button class="btn btn-ghost" onclick="openRouteEditor('${route.id}')">&#9998; Edit</button>
          <button class="btn btn-danger" onclick="confirmDeleteRoute('${route.id}')">&#128465; Delete</button>
        </div>
      </div>

      <div class="route-detail-body">

        <!-- Numbered stop list, with starting point shown above -->
        <div class="route-stop-list">
          <!-- Starting location -->
          <div class="route-origin-item">
            <div class="route-origin-dot">&#9679;</div>
            <div class="route-stop-info">
              <span class="route-stop-name">Starting From</span>
              <span class="route-stop-address">${escapeHtml(route.origin || '210 Hurt St, Martin, TN 38237')}</span>
            </div>
          </div>
          <div class="route-stop-connector">&#8595;</div>

          ${route.stops.map((stop, i) => {
            const timeRange = stop.startTime
              ? `${formatTime(stop.startTime)}${stop.endTime ? ' - ' + formatTime(stop.endTime) : ''}`
              : '';
            return `
            <div class="route-stop-item">
              <div class="route-stop-number">${i + 1}</div>
              <div class="route-stop-info">
                <div class="route-stop-header">
                  <span class="route-stop-name">${stop.name}</span>
                  ${timeRange ? `<span class="route-stop-time">${timeRange}</span>` : ''}
                </div>
                ${stop.address
                  ? `<span class="route-stop-address">${stop.address}</span>`
                  : `<span class="route-stop-no-address">No address entered</span>`
                }
              </div>
            </div>
            ${i < route.stops.length - 1 ? '<div class="route-stop-connector">&#8595;</div>' : ''}
          `;}).join('')}
        </div>

        <!-- Action buttons -->
        <div class="route-action-row">
          ${mapsUrl
            ? `<a class="btn btn-accent" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">${mapsLabel}</a>`
            : `<p class="route-maps-note">Add addresses to your stops to enable Maps.</p>`
          }
          <button class="btn btn-ghost" id="email-route-btn" onclick="emailRouteReminder('${route.id}')">&#9993; Email This Route</button>
          <button class="btn btn-ghost" onclick="printRoute('${route.id}')">&#128438; Print / Save as PDF</button>
        </div>

      </div>
    </div>
  `;
}

// =============================================
// TIME FORMATTER
// Converts "HH:MM" (24-hr) to "9:00 AM" for display
// =============================================
function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm   = h >= 12 ? 'PM' : 'AM';
  const hour   = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

// =============================================
// DEVICE DETECTION
// Returns true if the user is on an iPhone or iPad.
// Used to swap Google Maps for Apple Maps on iOS.
// =============================================
function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// =============================================
// GOOGLE MAPS URL
// Builds a multi-stop directions URL starting from the route's origin.
// Google Maps opens with all stops in order - the user can
// then click "Optimize order" inside Maps if they want.
// =============================================
function buildMapsUrl(stops, origin) {
  // Only use stops that have an address
  const addressed = stops.filter(s => s.address && s.address.trim());
  // Need at least one destination to build a valid URL
  if (addressed.length < 1) return null;

  // Start from the route's saved origin (defaults to Sol's office if blank)
  const start = (origin && origin.trim()) ? origin.trim() : '210 Hurt St, Martin, TN 38237';
  const parts = [start, ...addressed.map(s => s.address.trim())].map(encodeURIComponent);
  return 'https://www.google.com/maps/dir/' + parts.join('/');
}

// =============================================
// APPLE MAPS URL
// Builds a multi-stop directions URL for Apple Maps.
// Apple Maps uses the "daddr=A+to:B+to:C" format for waypoints.
// The maps:// scheme opens the native Maps app directly on iOS.
// =============================================
function buildAppleMapsUrl(stops, origin) {
  const addressed = stops.filter(s => s.address && s.address.trim());
  if (addressed.length < 1) return null;

  const start = (origin && origin.trim()) ? origin.trim() : '210 Hurt St, Martin, TN 38237';

  // First stop is the primary daddr; additional stops chain with "+to:"
  const destinations = addressed.map(s => s.address.trim());
  const daddr = destinations.join('+to:');

  return 'maps://?saddr=' + encodeURIComponent(start) + '&daddr=' + encodeURIComponent(daddr);
}

// =============================================
// EMAIL REMINDER
// Sends a route reminder email directly via EmailJS - no dialog required.
// =============================================
function emailRouteReminder(routeId) {
  const routes = getRoutes();
  const route  = routes.find(r => r.id === routeId);
  if (!route) return;

  // Update the button to show sending state
  const btn = document.getElementById('email-route-btn');
  if (btn) {
    btn.disabled    = true;
    btn.textContent = 'Sending...';
  }

  const d       = new Date(route.date);
  const dateStr = d.toLocaleDateString('default', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  const mapsUrl = buildMapsUrl(route.stops, route.origin);
  const origin  = route.origin || '210 Hurt St, Martin, TN 38237';

  const subject = `Route Reminder: ${route.name} - ${dateStr}`;

  // Build the stop list as plain text, including times if present
  const stopLines = route.stops.map((s, i) => {
    const timeStr = s.startTime
      ? `  ${formatTime(s.startTime)}${s.endTime ? ' - ' + formatTime(s.endTime) : ''}`
      : '';
    return `${i + 1}. ${s.name}${timeStr}${s.address ? '\n   ' + s.address : ''}`;
  }).join('\n\n');

  const message = [
    `Route: ${route.name}`,
    `Date:  ${dateStr}`,
    `Starting From: ${origin}`,
    `Stops: ${route.stops.length}`,
    '',
    '--- STOPS ---',
    stopLines,
    '',
    mapsUrl
      ? `Open in Google Maps:\n${mapsUrl}`
      : 'Tip: Add addresses to your stops in ACC to generate a Google Maps link.',
  ].join('\n');

  // Send via EmailJS - matches the template variables: {{to_email}}, {{subject}}, {{message}}
  emailjs.send('service_9sv9w6p', 'template_r0o15xz', {
    to_email: 'solwatk3@gmail.com',
    subject:  subject,
    message:  message,
  }).then(function() {
    // Success - update button to confirm
    if (btn) {
      btn.innerHTML   = '✓ Sent!';
      btn.style.color = 'var(--success, #4caf50)';
    }
  }).catch(function(err) {
    // Failure - re-enable and show error
    console.error('ACC: EmailJS send failed', err);
    if (btn) {
      btn.disabled  = false;
      btn.innerHTML = '✉ Failed - try again';
    }
  });
}

// =============================================
// VIEW 3 - ROUTE BUILDER
// Used for both creating new routes and editing existing ones
// =============================================

function openRouteBuilder() {
  routesView     = 'builder';
  editingRouteId = null;
  builderStops   = [];
  renderRoutes();
}

function openRouteEditor(routeId) {
  const route = getRoutes().find(r => r.id === routeId);
  if (!route) return;
  routesView     = 'builder';
  editingRouteId = routeId;
  // Deep copy stops so in-progress edits don't touch saved data
  builderStops = route.stops.map(s => ({ ...s }));
  renderRoutes();
}

function renderRouteBuilder() {
  const container = document.getElementById('routes-content');
  if (!container) return;

  const isEditing = editingRouteId !== null;
  const route     = isEditing ? getRoutes().find(r => r.id === editingRouteId) : null;
  const schools   = getSchools().sort((a, b) => a.name.localeCompare(b.name));

  container.innerHTML = `
    <div class="view-header">
      <button class="btn btn-ghost back-btn" onclick="cancelRouteBuilder()">&#8592; Back</button>
    </div>

    <div class="route-builder-card">
      <h2 class="builder-heading">${isEditing ? 'Edit Route' : 'New Route'}</h2>

      <!-- Route name -->
      <div class="form-group">
        <label>Route Name <span class="required">*</span></label>
        <input type="text" id="rb-name" placeholder="e.g. Gibson County Fall Tour" value="${route ? escapeHtml(route.name) : ''}" />
      </div>

      <!-- Route date -->
      <div class="form-group">
        <label>Date <span class="required">*</span></label>
        <input type="date" id="rb-date" value="${route ? route.date : ''}" />
      </div>

      <!-- Starting location - defaults to Sol's office address -->
      <div class="form-group">
        <label>Starting From</label>
        <input type="text" id="rb-origin" placeholder="Starting address..." value="${route && route.origin ? escapeHtml(route.origin) : '210 Hurt St, Martin, TN 38237'}" />
      </div>

      <!-- Stop list -->
      <div class="builder-stops-section">
        <div class="builder-stops-header">
          <h3>Stops</h3>
          <span class="builder-stop-count" id="rb-stop-count">${builderStops.length} stop${builderStops.length !== 1 ? 's' : ''}</span>
        </div>
        <div id="rb-stop-list">${renderBuilderStopList()}</div>
      </div>

      <!-- Add stop controls -->
      <div class="builder-add-stop">
        <p class="builder-add-label">Add a stop:</p>
        <div class="builder-add-row">
          <div class="school-dropdown-wrapper builder-school-picker">
            <input type="text" id="rb-school-search" placeholder="Search schools..." autocomplete="off" />
            <ul class="school-dropdown-list hidden" id="rb-school-dd"></ul>
          </div>
          <span class="builder-or">or</span>
          <button class="btn btn-ghost" onclick="openAddCustomStop()">+ Custom Stop</button>
        </div>
      </div>

      <!-- Save / cancel -->
      <div class="builder-footer">
        <button class="btn btn-accent" onclick="saveRoute()">&#10003; Save Route</button>
        <button class="btn btn-ghost"  onclick="cancelRouteBuilder()">Cancel</button>
      </div>
    </div>
  `;

  // Wire up the school search dropdown after the HTML is in the DOM
  setTimeout(() => initBuilderSchoolDropdown(schools), 0);
}

// =============================================
// BUILDER - STOP LIST RENDERER
// Only re-renders the stop rows, not the whole builder,
// so the name/date inputs keep their values.
// =============================================
function renderBuilderStopList() {
  if (builderStops.length === 0) {
    return '<p class="builder-no-stops">No stops yet. Search for a school or add a custom stop below.</p>';
  }

  return builderStops.map((stop, i) => `
    <div class="builder-stop-row">
      <div class="builder-stop-num">${i + 1}</div>
      <div class="builder-stop-info">
        <span class="builder-stop-name">${escapeHtml(stop.name)}</span>
        <input
          type="text"
          class="builder-stop-address"
          placeholder="Address (needed for Google Maps)"
          value="${escapeHtml(stop.address || '')}"
          onchange="updateStopAddress('${stop.id}', this.value)"
        />
        <div class="builder-stop-times">
          <label class="time-label">Start</label>
          <input
            type="time"
            class="builder-stop-time"
            value="${stop.startTime || ''}"
            onchange="updateStopStartTime('${stop.id}', this.value)"
          />
          <label class="time-label">End</label>
          <input
            type="time"
            class="builder-stop-time"
            value="${stop.endTime || ''}"
            onchange="updateStopEndTime('${stop.id}', this.value)"
          />
        </div>
      </div>
      <div class="builder-stop-controls">
        ${i > 0
          ? `<button class="btn-icon" onclick="moveStop('${stop.id}', -1)" title="Move up">&#8593;</button>`
          : `<span class="btn-icon-placeholder"></span>`
        }
        ${i < builderStops.length - 1
          ? `<button class="btn-icon" onclick="moveStop('${stop.id}', 1)" title="Move down">&#8595;</button>`
          : `<span class="btn-icon-placeholder"></span>`
        }
        <button class="btn-icon btn-icon-danger" onclick="removeStop('${stop.id}')" title="Remove">&#10005;</button>
      </div>
    </div>
  `).join('');
}

// Re-renders just the stop list section so name/date inputs are not disturbed
function refreshBuilderStopList() {
  const listEl  = document.getElementById('rb-stop-list');
  const countEl = document.getElementById('rb-stop-count');
  if (listEl)  listEl.innerHTML   = renderBuilderStopList();
  if (countEl) countEl.textContent = `${builderStops.length} stop${builderStops.length !== 1 ? 's' : ''}`;
}

// =============================================
// BUILDER - SCHOOL SEARCH DROPDOWN
// Same pattern as the Visit Log school picker
// =============================================
function initBuilderSchoolDropdown(schools) {
  const input = document.getElementById('rb-school-search');
  const list  = document.getElementById('rb-school-dd');
  if (!input || !list) return;

  function renderOptions(filter) {
    const q       = (filter || '').toLowerCase();
    const matches = schools.filter(s => s.name.toLowerCase().includes(q));
    list.innerHTML = matches.length
      ? matches.map(s => `
          <li class="school-dd-item"
              data-id="${s.id}"
              data-name="${escapeHtml(s.name)}"
              data-address="${escapeHtml(s.address || '')}">
            ${escapeHtml(s.name)}
          </li>`).join('')
      : '<li class="school-dd-item school-dd-no-match">No schools found</li>';
  }

  input.addEventListener('input',  () => { renderOptions(input.value); list.classList.remove('hidden'); });
  input.addEventListener('focus',  () => { renderOptions(input.value); list.classList.remove('hidden'); });
  input.addEventListener('blur',   () => setTimeout(() => list.classList.add('hidden'), 150));

  list.addEventListener('mousedown', function(e) {
    const item = e.target.closest('.school-dd-item');
    if (!item || item.classList.contains('school-dd-no-match')) return;
    // Add the school as a stop, then clear the search field
    addSchoolStop(item.dataset.id, item.dataset.name, item.dataset.address);
    input.value = '';
    list.classList.add('hidden');
  });
}

// =============================================
// BUILDER - STOP MANAGEMENT
// =============================================

// Adds a school from the directory as a stop
function addSchoolStop(schoolId, name, address) {
  builderStops.push({
    id:       makeId(),
    type:     'school',
    schoolId: schoolId,
    name:     name,
    address:  address || '',
  });
  refreshBuilderStopList();
}

// Opens a modal to add a custom (non-school) stop
function openAddCustomStop() {
  const body = `
    <div class="form-group">
      <label>Stop Name <span class="required">*</span></label>
      <input type="text" id="cs-name" placeholder="e.g. Hotel, Lunch, Fair venue..." />
    </div>
    <div class="form-group">
      <label>Address</label>
      <input type="text" id="cs-address" placeholder="e.g. 123 Main St, Jackson TN" />
    </div>
  `;

  openModal('Add Custom Stop', body, function() {
    const name    = document.getElementById('cs-name')?.value.trim();
    const address = document.getElementById('cs-address')?.value.trim();
    if (!name) { alert('Please enter a name for this stop.'); return; }
    builderStops.push({ id: makeId(), type: 'custom', name, address: address || '' });
    closeModal();
    refreshBuilderStopList();
  });
}

// Removes a stop from the builder list
function removeStop(stopId) {
  builderStops = builderStops.filter(s => s.id !== stopId);
  refreshBuilderStopList();
}

// Moves a stop up (-1) or down (+1) in the list
function moveStop(stopId, direction) {
  const idx    = builderStops.findIndex(s => s.id === stopId);
  const newIdx = idx + direction;
  if (idx === -1 || newIdx < 0 || newIdx >= builderStops.length) return;
  // Swap the two stops
  [builderStops[idx], builderStops[newIdx]] = [builderStops[newIdx], builderStops[idx]];
  refreshBuilderStopList();
}

// Called when the user edits an address field in the builder.
// Updates the in-memory stop so the address is preserved on re-render.
function updateStopAddress(stopId, address) {
  const stop = builderStops.find(s => s.id === stopId);
  if (stop) stop.address = address.trim();
}

// Updates the start time for a stop in memory
function updateStopStartTime(stopId, time) {
  const stop = builderStops.find(s => s.id === stopId);
  if (stop) stop.startTime = time;
}

// Updates the end time for a stop in memory
function updateStopEndTime(stopId, time) {
  const stop = builderStops.find(s => s.id === stopId);
  if (stop) stop.endTime = time;
}

// =============================================
// SAVE ROUTE
// =============================================
function saveRoute() {
  const name   = document.getElementById('rb-name')?.value.trim();
  const date   = document.getElementById('rb-date')?.value;
  const origin = document.getElementById('rb-origin')?.value.trim() || '210 Hurt St, Martin, TN 38237';

  if (!name)              { alert('Please enter a route name.'); return; }
  if (!date)              { alert('Please choose a date for this route.'); return; }
  if (builderStops.length < 1) { alert('Add at least one stop before saving.'); return; }

  // Sort stops by start time so the route is already in chronological order.
  // Stops with no start time fall to the end.
  builderStops.sort((a, b) => {
    if (!a.startTime && !b.startTime) return 0;
    if (!a.startTime) return 1;
    if (!b.startTime) return -1;
    return a.startTime.localeCompare(b.startTime);
  });

  const routes = getRoutes();

  if (editingRouteId) {
    // Update existing route
    const idx = routes.findIndex(r => r.id === editingRouteId);
    if (idx !== -1) {
      routes[idx] = {
        ...routes[idx],
        name,
        date,
        origin,
        stops:             builderStops,
        reminderDismissed: false, // reset so edited routes show the reminder again
      };
    }
  } else {
    // Brand new route
    routes.push({
      id:                makeId(),
      name,
      date,
      origin,
      stops:             builderStops,
      reminderDismissed: false,
      createdAt:         Date.now(),
    });
  }

  saveRoutes(routes);

  // Sync the saved route to Google Calendar if connected
  const savedRoute = routes.find(r => r.id === (editingRouteId || routes[routes.length - 1].id));
  if (savedRoute) syncRouteToCalendar(savedRoute);

  initRoutes(); // go back to the list view
}

function cancelRouteBuilder() {
  builderStops   = [];
  editingRouteId = null;
  initRoutes();
}

// =============================================
// DELETE ROUTE
// =============================================
function confirmDeleteRoute(routeId) {
  if (!confirm('Delete this route? This cannot be undone.')) return;

  // Remove the calendar event before deleting the route
  deleteCalendarEvent(routeId);

  saveRoutes(getRoutes().filter(r => r.id !== routeId));
  initRoutes();
}

// =============================================
// PRINT / SAVE AS PDF
// Opens a clean print window with just the route details.
// The user can print it or use "Save as PDF" in the print dialog.
// Designed to look professional enough to forward to a boss.
// =============================================
function printRoute(routeId) {
  const routes = getRoutes();
  const route  = routes.find(function(r) { return r.id === routeId; });
  if (!route) return;

  const d       = new Date(route.date);
  const dateStr = new Date(d.getTime() + d.getTimezoneOffset() * 60000)
    .toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const origin    = route.origin || '210 Hurt St, Martin, TN 38237';
  const mapsUrl   = buildMapsUrl(route.stops, route.origin);
  const printedOn = new Date().toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' });

  // Build the stop rows for the print layout
  const stopRows = route.stops.map(function(stop, i) {
    const timeRange = stop.startTime
      ? formatTime(stop.startTime) + (stop.endTime ? ' - ' + formatTime(stop.endTime) : '')
      : '';
    return `
      <tr>
        <td class="stop-num">${i + 1}</td>
        <td class="stop-name">${stop.name}</td>
        <td class="stop-time">${timeRange || '-'}</td>
        <td class="stop-address">${stop.address || '-'}</td>
      </tr>
    `;
  }).join('');

  // Full HTML for the print window - self-contained with inline styles
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${route.name} - Route Summary</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 12pt;
      color: #1a1a1a;
      background: #ffffff;
      padding: 40px 48px;
    }

    /* Header - institution name and document type */
    .print-header {
      border-bottom: 2px solid #1a1a1a;
      padding-bottom: 12px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .print-org { font-size: 10pt; color: #555; letter-spacing: 0.05em; text-transform: uppercase; }
    .print-doc-type { font-size: 10pt; color: #555; }

    /* Route title block */
    .print-title { font-size: 22pt; font-weight: bold; margin-bottom: 4px; }
    .print-date  { font-size: 12pt; color: #333; margin-bottom: 20px; }

    /* Meta info row */
    .print-meta {
      display: flex;
      gap: 40px;
      margin-bottom: 28px;
      font-size: 11pt;
    }
    .print-meta-item { display: flex; flex-direction: column; gap: 2px; }
    .print-meta-label { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.06em; color: #777; }
    .print-meta-value { font-weight: bold; color: #1a1a1a; }

    /* Stops table */
    .stops-label {
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #777;
      margin-bottom: 8px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11pt;
      margin-bottom: 24px;
    }
    th {
      text-align: left;
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #777;
      padding: 6px 8px;
      border-bottom: 1px solid #ddd;
    }
    td { padding: 10px 8px; border-bottom: 1px solid #efefef; vertical-align: top; }
    .stop-num  { width: 32px; font-weight: bold; color: #555; }
    .stop-name { font-weight: bold; }
    .stop-time { width: 130px; color: #333; }
    .stop-address { color: #555; font-size: 10pt; }
    tr:last-child td { border-bottom: none; }

    /* Maps link */
    .maps-link {
      font-size: 10pt;
      color: #555;
      margin-bottom: 32px;
      word-break: break-all;
    }
    .maps-link a { color: #1a1a1a; }

    /* Footer */
    .print-footer {
      border-top: 1px solid #ddd;
      padding-top: 10px;
      font-size: 9pt;
      color: #aaa;
      display: flex;
      justify-content: space-between;
    }

    @media print {
      body { padding: 24px 32px; }
      @page { margin: 0.6in; }
    }
  </style>
</head>
<body>

  <div class="print-header">
    <span class="print-org">Admissions Command Center</span>
    <span class="print-doc-type">School Visit Route Summary</span>
  </div>

  <div class="print-title">${route.name}</div>
  <div class="print-date">${dateStr}</div>

  <div class="print-meta">
    <div class="print-meta-item">
      <span class="print-meta-label">Starting From</span>
      <span class="print-meta-value">${origin}</span>
    </div>
    <div class="print-meta-item">
      <span class="print-meta-label">Total Stops</span>
      <span class="print-meta-value">${route.stops.length}</span>
    </div>
  </div>

  <div class="stops-label">Planned Stops</div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>School / Stop</th>
        <th>Time</th>
        <th>Address</th>
      </tr>
    </thead>
    <tbody>
      ${stopRows}
    </tbody>
  </table>

  ${mapsUrl ? `
  <div class="maps-link">
    <strong>Google Maps Link:</strong><br/>
    <a href="${mapsUrl}">${mapsUrl}</a>
  </div>` : ''}

  <div class="print-footer">
    <span>Generated by ACC - Admissions Command Center</span>
    <span>Printed ${printedOn}</span>
  </div>

</body>
</html>`;

  // Open a new window, write the content, and trigger print
  const win = window.open('', '_blank', 'width=800,height=700');
  if (!win) {
    alert('Pop-up blocked. Please allow pop-ups for this page and try again.');
    return;
  }
  win.document.write(html);
  win.document.close();

  // Small delay lets the browser finish rendering before the print dialog opens
  win.onload = function() { win.print(); };
  // Fallback in case onload already fired
  setTimeout(function() { if (win && !win.closed) win.print(); }, 400);
}
