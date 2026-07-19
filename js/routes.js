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

// Pre-fill data for duplicated routes (name + origin only - date is always left blank)
let builderPreFill = null;

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
  builderPreFill = null;
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
          <strong>${escapeHtml(r.name)}</strong> is coming up on ${dateStr} &mdash;
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

  // Show stop names as a preview arrow chain (escaped - names are user-entered)
  const preview = route.stops.map(s => escapeHtml(s.name)).join(' → ');

  // Show overall time range if any stops have times
  const timed       = route.stops.filter(s => s.startTime);
  const firstTime   = timed.length ? formatTime(timed[0].startTime) : null;
  const lastStop    = timed.length ? timed[timed.length - 1] : null;
  const lastTime    = lastStop ? formatTime(lastStop.endTime || lastStop.startTime) : null;
  const timeRangeStr = firstTime && lastTime ? ` &nbsp;|&nbsp; ${firstTime} - ${lastTime}` : '';

  return `
    <div class="route-card ${isPast ? 'route-card-past' : ''}" onclick="openRouteDetail('${route.id}')">
      <div class="route-card-info">
        <h3 class="route-card-name">${escapeHtml(route.name)}</h3>
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
          <h2>${escapeHtml(route.name)}</h2>
          <p class="route-detail-date">&#128197; ${dateStr}</p>
        </div>
        <div class="route-detail-actions">
          <button class="btn btn-ghost" onclick="openRouteEditor('${route.id}')">&#9998; Edit</button>
          <button class="btn btn-ghost" onclick="duplicateRoute('${route.id}')">&#10064; Duplicate</button>
          <button class="btn btn-danger" onclick="confirmDeleteRoute('${route.id}')">&#128465; Delete</button>
        </div>
      </div>

      <div class="route-detail-body">

        <!-- Starting location row -->
        <div class="route-origin-item">
          <div class="route-origin-dot"></div>
          <div class="route-stop-info">
            <span style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-muted);">Starting From</span>
            <span style="font-size:0.9rem; color:#ffffff; font-weight:500;">${escapeHtml(route.origin || DEFAULT_ORIGIN)}</span>
          </div>
        </div>

        <!-- Numbered stop list -->
        <div class="route-stop-list">
          ${route.stops.map((stop, i) => {
            const timeRange = stop.startTime
              ? `${formatTime(stop.startTime)}${stop.endTime ? ' - ' + formatTime(stop.endTime) : ''}`
              : '';
            return `
            <div class="route-stop-item">
              <div class="route-stop-number">${i + 1}</div>
              <div class="route-stop-info">
                <div class="route-stop-header">
                  <span class="route-stop-name">${escapeHtml(stop.name)}</span>
                  ${timeRange ? `<span class="route-stop-time">${timeRange}</span>` : ''}
                </div>
                ${stop.address
                  ? `<span class="route-stop-address">${escapeHtml(stop.address)}</span>`
                  : `<span class="route-stop-no-address">No address on file</span>`
                }
              </div>
            </div>
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
  const start = (origin && origin.trim()) ? origin.trim() : DEFAULT_ORIGIN;
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

  const start = (origin && origin.trim()) ? origin.trim() : DEFAULT_ORIGIN;

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
  const origin  = route.origin || DEFAULT_ORIGIN;

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
  builderPreFill = null;
  renderRoutes();
}

// =============================================
// DUPLICATE ROUTE
// Clones a route's stops and origin into a new builder session.
// Date is left blank so the user picks a new one before saving.
// =============================================
function duplicateRoute(routeId) {
  const route = getRoutes().find(function(r) { return r.id === routeId; });
  if (!route) return;

  routesView     = 'builder';
  editingRouteId = null;
  // Clone stops with fresh IDs so they're independent from the original
  builderStops   = route.stops.map(function(s) { return Object.assign({}, s, { id: makeId() }); });
  // Store name and origin for the builder to pre-fill (date intentionally left blank)
  builderPreFill = { name: route.name + ' (Copy)', origin: route.origin || '' };
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

  // Name/origin come from the existing route (edit), a duplicate pre-fill, or blank (new)
  const nameValue   = route ? escapeHtml(route.name)
                    : builderPreFill ? escapeHtml(builderPreFill.name)
                    : '';
  const originValue = route && route.origin ? escapeHtml(route.origin)
                    : builderPreFill && builderPreFill.origin ? escapeHtml(builderPreFill.origin)
                    : DEFAULT_ORIGIN;
  const headingLabel = isEditing ? 'Edit Route' : builderPreFill ? 'Duplicate Route' : 'New Route';

  container.innerHTML = `
    <div class="view-header">
      <button class="btn btn-ghost back-btn" onclick="cancelRouteBuilder()">&#8592; Back</button>
    </div>

    <div class="route-builder-card">
      <h2 class="builder-heading">${headingLabel}</h2>
      ${builderPreFill ? '<p style="font-size:0.82rem; color:var(--text-muted); margin-top:-12px;">Stops copied - pick a new date and save.</p>' : ''}

      <!-- Route name -->
      <div class="form-group">
        <label>Route Name <span class="required">*</span></label>
        <input type="text" id="rb-name" placeholder="e.g. Gibson County Fall Tour" value="${nameValue}" />
      </div>

      <!-- Route date - left blank for duplicates so user must pick a new one -->
      <div class="form-group">
        <label>Date <span class="required">*</span></label>
        <input type="date" id="rb-date" value="${route ? route.date : ''}" />
      </div>

      <!-- Starting location - defaults to Sol's office address -->
      <div class="form-group">
        <label>Starting From</label>
        <input type="text" id="rb-origin" placeholder="Starting address..." value="${originValue}" />
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
  const origin = document.getElementById('rb-origin')?.value.trim() || DEFAULT_ORIGIN;

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

  // Sync the saved route to Google Calendar if connected.
  // Edits: look up by the ID we were editing.
  // New routes: the route we just pushed is the last item in the array.
  const savedRoute = editingRouteId
    ? routes.find(r => r.id === editingRouteId)
    : routes[routes.length - 1];
  if (savedRoute) syncRouteToCalendar(savedRoute);

  initRoutes(); // go back to the list view
}

function cancelRouteBuilder() {
  builderStops   = [];
  editingRouteId = null;
  builderPreFill = null;
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
// PRINT ROUTE SELECTOR
// Opens a modal with a date range picker and a checklist.
// Setting a date range auto-checks all routes in that window.
// Individual routes can still be toggled manually after.
// =============================================
function openPrintRoutesSelector() {
  const routes = getRoutes().sort(function(a, b) { return new Date(a.date) - new Date(b.date); });

  if (routes.length === 0) {
    alert('No routes saved yet.');
    return;
  }

  const now      = new Date();
  now.setHours(0, 0, 0, 0);
  const upcoming = routes.filter(function(r) { return new Date(r.date) >= now; });
  const past     = routes.filter(function(r) { return new Date(r.date) < now; });

  function routeCheckRow(r) {
    const d       = new Date(r.date);
    const dateStr = new Date(d.getTime() + d.getTimezoneOffset() * 60000)
      .toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    return `
      <label class="print-route-check-row">
        <input type="checkbox" class="print-route-checkbox" value="${r.id}" data-date="${r.date}" />
        <span class="print-route-check-info">
          <span class="print-route-check-name">${escapeHtml(r.name)}</span>
          <span class="print-route-check-meta">${dateStr} &middot; ${r.stops.length} stop${r.stops.length !== 1 ? 's' : ''}</span>
        </span>
      </label>
    `;
  }

  const upcomingHtml = upcoming.length > 0
    ? `<p class="print-check-group-label">Upcoming</p>${upcoming.map(routeCheckRow).join('')}`
    : '';

  const pastHtml = past.length > 0
    ? `<p class="print-check-group-label">Past Routes</p>${past.map(routeCheckRow).join('')}`
    : '';

  const body = `
    <!-- Date range picker - auto-selects routes in the window -->
    <div class="print-date-range">
      <div class="print-date-range-fields">
        <div class="form-group" style="flex:1; margin:0;">
          <label>Start Date</label>
          <input type="date" id="pr-start-date" />
        </div>
        <div class="print-date-range-to">to</div>
        <div class="form-group" style="flex:1; margin:0;">
          <label>End Date</label>
          <input type="date" id="pr-end-date" />
        </div>
        <button class="btn btn-ghost btn-sm" onclick="applyPrintDateRange()" style="align-self:flex-end;">Select</button>
      </div>
      <p class="print-date-range-hint">Set a date range to auto-select all routes in that window, or pick manually below.</p>
    </div>

    <!-- Manual checklist -->
    <div class="print-route-checklist">
      ${upcomingHtml}
      ${pastHtml}
    </div>
  `;

  openModal('Print Routes', body, function() {
    const checked = Array.from(document.querySelectorAll('.print-route-checkbox:checked'))
      .map(function(el) { return el.value; });
    if (checked.length === 0) {
      alert('Select at least one route.');
      return;
    }
    closeModal();
    printSelectedRoutes(checked);
  });

  // Relabel the generic Save button
  const saveBtn = document.getElementById('modal-save-btn');
  if (saveBtn) saveBtn.textContent = 'Generate PDF';
}

// =============================================
// DATE RANGE AUTO-SELECT
// Checks all routes whose date falls between the two
// selected dates, unchecks everything outside the range.
// =============================================
function applyPrintDateRange() {
  const startInput = document.getElementById('pr-start-date');
  const endInput   = document.getElementById('pr-end-date');

  if (!startInput || !endInput) return;

  const start = startInput.value;
  const end   = endInput.value;

  if (!start || !end) {
    alert('Please set both a start and end date.');
    return;
  }

  if (end < start) {
    alert('End date must be on or after the start date.');
    return;
  }

  // Check routes in range, uncheck everything outside it
  document.querySelectorAll('.print-route-checkbox').forEach(function(box) {
    const routeDate = box.dataset.date;
    box.checked = routeDate >= start && routeDate <= end;
  });

  // Show a count of what was selected
  const count = document.querySelectorAll('.print-route-checkbox:checked').length;
  const hint  = document.querySelector('.print-date-range-hint');
  if (hint) {
    hint.textContent = count > 0
      ? count + ' route' + (count !== 1 ? 's' : '') + ' selected in that range.'
      : 'No routes found in that range - try different dates or select manually below.';
  }
}

// =============================================
// PRINT ONE ROUTE
// Convenience wrapper - just prints that single route
// using the same layout as the multi-route PDF.
// =============================================
function printRoute(routeId) {
  printSelectedRoutes([routeId]);
}

// =============================================
// PRINT SELECTED ROUTES - MULTI-DAY ITINERARY
// Combines one or more routes into a single polished print window.
// No Maps links included - designed to be read on paper.
// =============================================
function printSelectedRoutes(routeIds) {
  const allRoutes = getRoutes();

  // Pull the chosen routes in date order
  const selected = routeIds
    .map(function(id) { return allRoutes.find(function(r) { return r.id === id; }); })
    .filter(Boolean)
    .sort(function(a, b) { return new Date(a.date) - new Date(b.date); });

  if (selected.length === 0) return;

  // Build the date range shown in the document header
  const fmt = function(dateObj) {
    return new Date(dateObj.getTime() + dateObj.getTimezoneOffset() * 60000)
      .toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const firstDate    = new Date(selected[0].date);
  const lastDate     = new Date(selected[selected.length - 1].date);
  const dateRangeStr = selected.length === 1 ? fmt(firstDate) : fmt(firstDate) + ' - ' + fmt(lastDate);
  const totalStops   = selected.reduce(function(t, r) { return t + r.stops.length; }, 0);
  const printedOn    = new Date().toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' });

  // Build each route as its own section
  const routeSections = selected.map(function(route, idx) {
    const d      = new Date(route.date);
    const dayStr = new Date(d.getTime() + d.getTimezoneOffset() * 60000)
      .toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const origin = route.origin || DEFAULT_ORIGIN;

    const stopRows = route.stops.map(function(stop, i) {
      const timeRange = stop.startTime
        ? formatTime(stop.startTime) + (stop.endTime ? ' - ' + formatTime(stop.endTime) : '')
        : '';
      const rowClass = i % 2 === 0 ? 'row-even' : 'row-odd';
      return `
        <tr class="${rowClass}">
          <td class="stop-num">${i + 1}</td>
          <td class="stop-name">${escapeHtml(stop.name)}</td>
          <td class="stop-time">${timeRange || '-'}</td>
          <td class="stop-address">${stop.address ? escapeHtml(stop.address) : '-'}</td>
        </tr>
      `;
    }).join('');

    // Add a page-break hint between routes when there are more than two
    const breakClass = idx > 0 ? ' route-break' : '';

    return `
      <div class="route-section${breakClass}">
        <div class="day-header">
          <div class="day-header-left">
            <div class="day-label">${dayStr}</div>
            <div class="route-title">${escapeHtml(route.name)}</div>
          </div>
          <div class="stop-count-badge">${route.stops.length} stop${route.stops.length !== 1 ? 's' : ''}</div>
        </div>

        <div class="origin-row">
          <span class="origin-label">Starting from</span>
          <span class="origin-value">${escapeHtml(origin)}</span>
        </div>

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
      </div>
    `;
  }).join('');

  // Self-contained HTML document with all styling inline
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>School Visit Itinerary - ${dateRangeStr}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11pt;
      color: #1a1a1a;
      background: #fff;
    }

    /* ---- DOCUMENT HEADER BAR ---- */
    .doc-header {
      background: #3b0764;
      color: #ffffff;
      padding: 22px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
    }
    .doc-org {
      font-size: 9pt;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      opacity: 0.7;
      margin-bottom: 5px;
    }
    .doc-title {
      font-size: 20pt;
      font-weight: bold;
      letter-spacing: 0.01em;
    }
    .doc-meta {
      text-align: right;
      font-size: 10pt;
      line-height: 1.8;
      opacity: 0.85;
    }
    .doc-meta strong { font-size: 12pt; display: block; }

    /* ---- ROUTE SECTIONS ---- */
    .route-section { padding: 0 40px 30px; }

    .route-break {
      border-top: 2px solid #ede9fe;
      padding-top: 28px;
      margin-top: 4px;
    }

    /* ---- DAY HEADER ---- */
    .day-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f5f3ff;
      border-left: 5px solid #7c3aed;
      padding: 14px 18px;
      border-radius: 0 6px 6px 0;
      margin-bottom: 14px;
    }
    .day-label {
      font-size: 8.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #6d28d9;
      margin-bottom: 4px;
    }
    .route-title {
      font-size: 15pt;
      font-weight: bold;
      color: #1a1a1a;
    }
    .stop-count-badge {
      background: #7c3aed;
      color: #fff;
      font-size: 9pt;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 20px;
      white-space: nowrap;
    }

    /* ---- ORIGIN ROW ---- */
    .origin-row {
      display: flex;
      gap: 10px;
      align-items: baseline;
      font-size: 10pt;
      color: #555;
      margin-bottom: 14px;
    }
    .origin-label {
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: #aaa;
      white-space: nowrap;
    }
    .origin-value { color: #333; }

    /* ---- STOPS TABLE ---- */
    table { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
    thead tr { background: #f5f3ff; }
    th {
      text-align: left;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #7c3aed;
      padding: 8px 10px;
      border-bottom: 2px solid #ddd6fe;
    }
    td { padding: 10px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    .row-even { background: #fff; }
    .row-odd  { background: #faf9ff; }
    tr:last-child td { border-bottom: none; }

    .stop-num     { width: 32px; font-weight: 700; color: #7c3aed; text-align: center; }
    .stop-name    { font-weight: 600; color: #1a1a1a; }
    .stop-time    { width: 140px; color: #444; }
    .stop-address { color: #666; font-size: 9.5pt; }

    /* ---- FOOTER ---- */
    .doc-footer {
      border-top: 1px solid #ddd6fe;
      margin: 20px 40px 0;
      padding: 12px 0;
      display: flex;
      justify-content: space-between;
      font-size: 8.5pt;
      color: #bbb;
    }

    /* ---- PRINT OVERRIDES ---- */
    @media print {
      .doc-header, .day-header, .stop-count-badge, .row-odd, thead tr {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .route-break { page-break-before: auto; }
      @page { margin: 0.5in; }
    }
  </style>
</head>
<body>

  <div class="doc-header">
    <div>
      <div class="doc-org">Admissions Command Center</div>
      <div class="doc-title">School Visit Itinerary</div>
    </div>
    <div class="doc-meta">
      <strong>${dateRangeStr}</strong>
      ${selected.length} day${selected.length !== 1 ? 's' : ''} &nbsp;&bull;&nbsp; ${totalStops} total stop${totalStops !== 1 ? 's' : ''}
    </div>
  </div>

  ${routeSections}

  <div class="doc-footer">
    <span>ACC - Admissions Command Center</span>
    <span>Printed ${printedOn}</span>
  </div>

</body>
</html>`;

  const win = window.open('', '_blank', 'width=860,height=750');
  if (!win) {
    alert('Pop-up blocked. Please allow pop-ups for this page and try again.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.onload = function() { win.print(); };
  setTimeout(function() { if (win && !win.closed) win.print(); }, 400);
}
