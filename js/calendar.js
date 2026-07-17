// =============================================
// ACC - Google Calendar Sync
// Pushes routes to the "Admissions Work" Google Calendar.
// Uses Google Identity Services (GIS) for OAuth - no backend needed.
// Access tokens are kept in memory only (not localStorage) for security.
// =============================================

const GCAL_CLIENT_ID  = '159077460617-30si76d90dng1cuuda9jb4in13k4439n.apps.googleusercontent.com';
const GCAL_SCOPE      = 'https://www.googleapis.com/auth/calendar';
const CALENDAR_NAME   = 'Admissions Work';

// In-memory token - cleared when the page is closed
let gCalToken       = null;
let gCalTokenExpiry = 0;
let gCalTokenClient = null;

// =============================================
// AUTH INIT
// Called once the Google Identity Services library is loaded
// =============================================
function initGoogleAuth() {
  if (!window.google || !window.google.accounts) return;

  gCalTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GCAL_CLIENT_ID,
    scope:     GCAL_SCOPE,
    callback:  handleTokenResponse,
  });
}

// Handles the OAuth response after the user signs in
function handleTokenResponse(response) {
  if (response.error) {
    console.error('ACC Calendar: auth error -', response.error);
    alert('Google sign-in failed: ' + response.error);
    return;
  }

  // Store token in memory with a 1-minute buffer before expiry
  gCalToken       = response.access_token;
  gCalTokenExpiry = Date.now() + (response.expires_in * 1000) - 60000;

  // Remember that the user connected so we can show status across sessions
  saveData('gcal_connected', true);

  renderCalendarStatus();

  // Sync all existing routes immediately on connect
  syncAllRoutes();
}

// Returns true if we have a valid, unexpired access token
function isCalendarConnected() {
  return !!(gCalToken && Date.now() < gCalTokenExpiry);
}

// =============================================
// CONNECT / DISCONNECT
// =============================================
function connectCalendar() {
  if (!gCalTokenClient) {
    // GIS library may still be loading - retry once it's ready
    alert('Google sign-in is still loading. Wait a moment and try again.');
    return;
  }
  // Opens a Google sign-in popup
  gCalTokenClient.requestAccessToken();
}

function disconnectCalendar() {
  if (!confirm('Disconnect Google Calendar? Routes will no longer sync automatically.')) return;

  // Revoke the token on Google's side
  if (gCalToken) {
    google.accounts.oauth2.revoke(gCalToken, function() {});
  }

  // Clear local state
  gCalToken       = null;
  gCalTokenExpiry = 0;
  saveData('gcal_connected', false);
  renderCalendarStatus();
}

// =============================================
// CALENDAR API HELPER
// Wraps fetch with the auth header and error handling
// =============================================
async function calendarFetch(url, options) {
  options = options || {};

  if (!isCalendarConnected()) {
    throw new Error('Not connected to Google Calendar');
  }

  const res = await fetch(url, {
    ...options,
    headers: Object.assign({
      'Authorization': 'Bearer ' + gCalToken,
      'Content-Type':  'application/json',
    }, options.headers || {}),
  });

  // 204 No Content (successful delete) has no body to parse
  if (res.status === 204) return null;
  if (!res.ok) throw new Error('Calendar API error: ' + res.status);
  return res.json();
}

// =============================================
// FIND OR CREATE "ADMISSIONS WORK" CALENDAR
// Checks the user's calendar list; creates the calendar if missing.
// Caches the calendar ID in localStorage.
// =============================================
async function getAdmissionsCalendarId() {
  // Use cached ID if we have one
  const cached = loadData('gcal_calendar_id', null);
  if (cached) return cached;

  // Fetch the user's full calendar list
  const list = await calendarFetch('https://www.googleapis.com/calendar/v3/users/me/calendarList');
  const existing = list.items.find(function(c) { return c.summary === CALENDAR_NAME; });

  if (existing) {
    saveData('gcal_calendar_id', existing.id);
    return existing.id;
  }

  // Calendar doesn't exist yet - create it
  const created = await calendarFetch('https://www.googleapis.com/calendar/v3/calendars', {
    method: 'POST',
    body:   JSON.stringify({
      summary:     CALENDAR_NAME,
      description: 'ACC - Admissions Command Center school visit routes',
      timeZone:    'America/Chicago',
    }),
  });

  saveData('gcal_calendar_id', created.id);
  return created.id;
}

// =============================================
// ROUTE -> CALENDAR EVENT
// Converts a saved route object into a Google Calendar event body.
// Uses stop start/end times if available, otherwise an all-day event.
// =============================================
function routeToCalendarEvent(route) {
  const stops = route.stops || [];

  // Build a plain-text description with all stops and times
  let description = 'Starting from: ' + (route.origin || '210 Hurt St, Martin, TN 38237') + '\n\n';
  stops.forEach(function(s, i) {
    const timeStr = s.startTime
      ? ' (' + formatTime(s.startTime) + (s.endTime ? ' - ' + formatTime(s.endTime) : '') + ')'
      : '';
    description += (i + 1) + '. ' + s.name + timeStr + '\n';
    if (s.address) description += '   ' + s.address + '\n';
  });
  description += '\nSynced from ACC - Admissions Command Center';

  // If any stops have a start time, make it a timed event
  const timedStops = stops.filter(function(s) { return s.startTime; });

  if (timedStops.length > 0) {
    const sorted    = timedStops.slice().sort(function(a, b) { return a.startTime.localeCompare(b.startTime); });
    const firstStop = sorted[0];
    const lastStop  = sorted[sorted.length - 1];

    const startDT = route.date + 'T' + firstStop.startTime + ':00';

    // Use the last stop's end time, falling back to start time + 1 hour
    let endTime = lastStop.endTime || lastStop.startTime;
    let endDT   = route.date + 'T' + endTime + ':00';
    if (endDT <= startDT) {
      const parts = endTime.split(':').map(Number);
      endDT = route.date + 'T' + String(parts[0] + 1).padStart(2, '0') + ':' + String(parts[1]).padStart(2, '0') + ':00';
    }

    return {
      summary:     route.name,
      description: description,
      start: { dateTime: startDT, timeZone: 'America/Chicago' },
      end:   { dateTime: endDT,   timeZone: 'America/Chicago' },
    };
  }

  // No times set - create an all-day event
  return {
    summary:     route.name,
    description: description,
    start: { date: route.date },
    end:   { date: route.date },
  };
}

// =============================================
// SYNC ONE ROUTE
// Creates a new calendar event or updates an existing one.
// The route-to-event ID mapping is stored in localStorage.
// =============================================
async function syncRouteToCalendar(route) {
  if (!isCalendarConnected()) return;

  try {
    const calendarId = await getAdmissionsCalendarId();
    const eventMap   = loadData('gcal_event_map', {});
    const eventData  = routeToCalendarEvent(route);

    if (eventMap[route.id]) {
      // Event already exists - update it
      await calendarFetch(
        'https://www.googleapis.com/calendar/v3/calendars/'
          + encodeURIComponent(calendarId) + '/events/' + eventMap[route.id],
        { method: 'PUT', body: JSON.stringify(eventData) }
      );
    } else {
      // New event - create it and store the returned event ID
      const created = await calendarFetch(
        'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(calendarId) + '/events',
        { method: 'POST', body: JSON.stringify(eventData) }
      );
      eventMap[route.id] = created.id;
      saveData('gcal_event_map', eventMap);
    }

    // Record the sync time for display in the status card
    saveData('gcal_last_sync', new Date().toISOString());
    renderCalendarStatus();

  } catch (err) {
    console.error('ACC Calendar: sync failed for route', route.id, err);
  }
}

// =============================================
// DELETE CALENDAR EVENT
// Called when a route is deleted from the app.
// =============================================
async function deleteCalendarEvent(routeId) {
  if (!isCalendarConnected()) return;

  const eventMap = loadData('gcal_event_map', {});
  if (!eventMap[routeId]) return;

  try {
    const calendarId = await getAdmissionsCalendarId();
    await calendarFetch(
      'https://www.googleapis.com/calendar/v3/calendars/'
        + encodeURIComponent(calendarId) + '/events/' + eventMap[routeId],
      { method: 'DELETE' }
    );
    delete eventMap[routeId];
    saveData('gcal_event_map', eventMap);

  } catch (err) {
    console.error('ACC Calendar: could not delete event for route', routeId, err);
  }
}

// =============================================
// SYNC ALL ROUTES
// Pushes every saved route to the calendar.
// Called on connect and via the Sync Now button.
// =============================================
async function syncAllRoutes() {
  const routes   = loadData('routes', []);
  const syncBtn  = document.getElementById('gcal-sync-btn');

  if (syncBtn) {
    syncBtn.disabled    = true;
    syncBtn.textContent = 'Syncing...';
  }

  for (const route of routes) {
    await syncRouteToCalendar(route);
  }

  if (syncBtn) {
    syncBtn.disabled    = false;
    syncBtn.textContent = '↻ Sync Now';
  }

  renderCalendarStatus();
}

// =============================================
// CALENDAR STATUS CARD
// Renders the connect/disconnect UI in the dashboard card
// =============================================
function renderCalendarStatus() {
  const container = document.getElementById('dashboard-calendar');
  if (!container) return;

  const connected   = isCalendarConnected();
  const lastSyncRaw = loadData('gcal_last_sync', null);
  const lastSync    = lastSyncRaw
    ? new Date(lastSyncRaw).toLocaleString('default', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Never';

  if (connected) {
    container.innerHTML = `
      <div class="gcal-status gcal-connected">
        <div class="gcal-dot gcal-dot-on"></div>
        <div class="gcal-info">
          <span class="gcal-label">Connected &mdash; "Admissions Work" calendar</span>
          <span class="gcal-meta">Last synced: ${lastSync}</span>
        </div>
        <div class="gcal-actions">
          <button id="gcal-sync-btn" class="btn btn-ghost btn-sm" onclick="syncAllRoutes()">&#8635; Sync Now</button>
          <button class="btn btn-ghost btn-sm" onclick="disconnectCalendar()">Disconnect</button>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="gcal-status gcal-disconnected">
        <div class="gcal-dot gcal-dot-off"></div>
        <div class="gcal-info">
          <span class="gcal-label">Google Calendar not connected</span>
          <span class="gcal-meta">Connect to auto-sync routes to your "Admissions Work" calendar</span>
        </div>
        <button class="btn btn-accent btn-sm" onclick="connectCalendar()">Connect Google Calendar</button>
      </div>
    `;
  }
}

// =============================================
// INIT
// Called from app.js on page load.
// Sets up GIS once the library is ready.
// =============================================
function initCalendar() {
  // GIS library loads async - poll until it's ready
  function tryInit() {
    if (window.google && window.google.accounts) {
      initGoogleAuth();
    } else {
      setTimeout(tryInit, 300);
    }
  }
  tryInit();
  renderCalendarStatus();
}
