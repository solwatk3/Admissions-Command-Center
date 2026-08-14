// =============================================
// ACC - Boss Report (report.js)
// Generates a travel planning snapshot for a
// selected date range. Shows planned school
// visits (confirmed + tentative) and events
// with drive time, distance, and visit counts.
//
// Depends on: app.js (loadData, saveData,
//   DEFAULT_ORIGIN, PAGE_TITLES) which always
//   loads before this file.
// =============================================

// Cached coordinates for DEFAULT_ORIGIN so we
// only geocode the office address once per session.
var reportOriginCoords = null;

// Tracks which preset button is currently active
var reportActivePreset = 'month';

// =============================================
// INIT
// Called by navigateTo() in app.js whenever
// the user opens the Report section.
// =============================================
function initReport() {
  // Render the controls if they haven't been built yet
  var controls = document.getElementById('report-controls');
  if (controls && !controls.dataset.built) {
    buildReportControls();
    controls.dataset.built = '1';
  }
  // Default to This Month on first open
  setReportPreset('month');
}

// =============================================
// BUILD CONTROLS
// Renders preset buttons, date pickers, and
// the generate/print buttons into #report-controls.
// =============================================
function buildReportControls() {
  var el = document.getElementById('report-controls');
  if (!el) return;

  el.innerHTML = [
    '<div class="report-preset-row">',
      '<button class="report-preset-btn" data-preset="week"   onclick="setReportPreset(\'week\')">This Week</button>',
      '<button class="report-preset-btn" data-preset="nweek"  onclick="setReportPreset(\'nweek\')">Next Week</button>',
      '<button class="report-preset-btn active" data-preset="month"  onclick="setReportPreset(\'month\')">This Month</button>',
      '<button class="report-preset-btn" data-preset="nmonth" onclick="setReportPreset(\'nmonth\')">Next Month</button>',
      '<button class="report-preset-btn" data-preset="custom" onclick="setReportPreset(\'custom\')">Custom</button>',
    '</div>',
    '<div class="report-date-row">',
      '<div class="report-date-group">',
        '<label for="report-date-from">From</label>',
        '<input type="date" id="report-date-from" />',
      '</div>',
      '<div class="report-date-group">',
        '<label for="report-date-to">To</label>',
        '<input type="date" id="report-date-to" />',
      '</div>',
      '<button class="btn btn-accent" onclick="runReport()">&#128202; Generate Report</button>',
      '<button class="btn btn-ghost" id="report-print-btn" onclick="printReport()" style="display:none;">&#128438; Print</button>',
    '</div>',
  ].join('');
}

// =============================================
// SET PRESET
// Calculates the date range for the chosen
// preset and fills in the date inputs.
// =============================================
function setReportPreset(preset) {
  reportActivePreset = preset;

  // Highlight the active preset button
  document.querySelectorAll('.report-preset-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.preset === preset);
  });

  // For custom mode just let the user fill dates manually
  if (preset === 'custom') return;

  var range = calcDateRange(preset);
  var fromEl = document.getElementById('report-date-from');
  var toEl   = document.getElementById('report-date-to');
  if (fromEl) fromEl.value = range.from;
  if (toEl)   toEl.value   = range.to;
}

// =============================================
// CALC DATE RANGE
// Returns {from, to} as YYYY-MM-DD strings
// for the given preset name.
// =============================================
function calcDateRange(preset) {
  var now   = new Date();
  // Use local midnight - avoids timezone shift problems when building date strings
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case 'week': {
      // Monday to Sunday of the current week
      var day      = today.getDay(); // 0=Sun...6=Sat
      var toMon    = (day === 0) ? -6 : 1 - day;
      var mon      = new Date(today);
      mon.setDate(today.getDate() + toMon);
      var sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { from: toYMD(mon), to: toYMD(sun) };
    }
    case 'nweek': {
      var day      = today.getDay();
      var toMon    = (day === 0) ? -6 : 1 - day;
      var mon      = new Date(today);
      mon.setDate(today.getDate() + toMon + 7);
      var sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { from: toYMD(mon), to: toYMD(sun) };
    }
    case 'month': {
      var from = new Date(now.getFullYear(), now.getMonth(), 1);
      var to   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: toYMD(from), to: toYMD(to) };
    }
    case 'nmonth': {
      var from = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      var to   = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      return { from: toYMD(from), to: toYMD(to) };
    }
    default:
      return { from: toYMD(today), to: toYMD(today) };
  }
}

// Formats a Date object as YYYY-MM-DD
function toYMD(d) {
  var y  = d.getFullYear();
  var m  = String(d.getMonth() + 1).padStart(2, '0');
  var dy = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + dy;
}

// =============================================
// RUN REPORT
// Main async function - pulls all data, fetches
// drive times, and renders the report output.
// =============================================
async function runReport() {
  var fromStr = document.getElementById('report-date-from') ? document.getElementById('report-date-from').value : '';
  var toStr   = document.getElementById('report-date-to')   ? document.getElementById('report-date-to').value   : '';

  if (!fromStr || !toStr) {
    alert('Please select a start and end date before generating the report.');
    return;
  }
  if (fromStr > toStr) {
    alert('The "From" date must be on or before the "To" date.');
    return;
  }

  // Show loading state while drive times are being fetched
  var output = document.getElementById('report-output');
  if (output) {
    output.innerHTML = '<div class="report-loading">&#8987; Fetching drive times - this may take a moment...</div>';
  }
  var printBtn = document.getElementById('report-print-btn');
  if (printBtn) printBtn.style.display = 'none';

  // Load all the data we need from localStorage
  var plannedVisits   = loadData('planned_visits',   []);
  var events          = loadData('events',           []);
  var tentativeEvents = loadData('tentative_events', []);
  var schools         = loadData('schools',          []);
  var counties        = loadData('counties',         []);
  var visits          = loadData('visits',           []);

  // Build lookup maps for fast access
  var schoolMap = {};
  schools.forEach(function(s) { schoolMap[s.id] = s; });

  var countyMap = {};
  counties.forEach(function(c) { countyMap[c.id] = c; });

  // Filter each data set to the chosen date range
  var filteredPlanned   = plannedVisits.filter(function(v) { return v.date >= fromStr && v.date <= toStr; });
  var filteredEvents    = events.filter(function(e)        { return e.date >= fromStr && e.date <= toStr; });
  var filteredTentative = tentativeEvents.filter(function(e) { return e.date >= fromStr && e.date <= toStr; });

  // Geocode Sol's office once - needed for OSRM drive time requests
  var originCoords = await geocodeOrigin();

  // ---- Build the unified items array ----
  var items = [];

  // Planned school visits (confirmed and tentative)
  for (var i = 0; i < filteredPlanned.length; i++) {
    var pv     = filteredPlanned[i];
    var school = schoolMap[pv.schoolId] || null;
    var county = school ? (countyMap[school.countyId] || null) : null;
    var region = county ? county.region : null;

    // Count how many logged visits this school and region have this season
    var schoolVisitCount  = countSchoolVisits(pv.schoolId, visits);
    var regionVisitCount  = countRegionVisits(region, schools, counties, visits);

    // Get drive time from origin to this school
    var schoolCoords = school ? getSchoolCoords(school) : null;
    var driveInfo    = null;
    if (originCoords && schoolCoords) {
      driveInfo = await fetchDriveInfo(originCoords, schoolCoords);
    }

    items.push({
      type:             'visit',
      tentative:        !!pv.tentative,
      name:             pv.schoolName || (school ? school.name : 'Unknown School'),
      date:             pv.date,
      time:             pv.time || null,
      school:           school,
      county:           county,
      region:           region,
      schoolVisitCount: schoolVisitCount,
      regionVisitCount: regionVisitCount,
      driveInfo:        driveInfo,
      notes:            pv.notes || '',
    });
  }

  // Confirmed events (boss-assigned)
  filteredEvents.forEach(function(ev) {
    items.push({
      type:      'event',
      tentative: false,
      name:      ev.name || 'Unnamed Event',
      date:      ev.date,
      time:      null,
      eventType: ev.type || '',
      notes:     ev.notes || '',
    });
  });

  // Tentative events (pending confirmation)
  filteredTentative.forEach(function(ev) {
    var hostSchool  = ev.hostSchoolId ? (schoolMap[ev.hostSchoolId] || null) : null;
    var attendCount = ev.schoolIds ? ev.schoolIds.length : 0;
    items.push({
      type:        'event',
      tentative:   true,
      name:        ev.name || 'Unnamed Event',
      date:        ev.date,
      time:        null,
      eventType:   ev.type || '',
      notes:       ev.notes || '',
      hostSchool:  hostSchool,
      attendCount: attendCount,
    });
  });

  // Sort everything by date, then by time within the same date
  items.sort(function(a, b) {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    var ta = a.time || '23:59';
    var tb = b.time || '23:59';
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });

  // Render the finished report
  renderReport(items, fromStr, toStr);
  if (printBtn) printBtn.style.display = '';
}

// =============================================
// GEOCODE ORIGIN
// Looks up DEFAULT_ORIGIN in the geo_cache
// first, then falls back to Nominatim.
// Result is stored in reportOriginCoords so
// we only do this once per session.
// =============================================
async function geocodeOrigin() {
  // Already fetched this session - reuse it
  if (reportOriginCoords) return reportOriginCoords;

  // Check the existing geo_cache (shared with map.js)
  var cache = loadData('geo_cache', {});
  var key   = DEFAULT_ORIGIN.trim().toLowerCase();
  if (cache[key]) {
    reportOriginCoords = { lat: cache[key].lat, lng: cache[key].lng };
    return reportOriginCoords;
  }

  // Not cached - ask Nominatim
  try {
    var url = 'https://nominatim.openstreetmap.org/search?q='
      + encodeURIComponent(DEFAULT_ORIGIN)
      + '&format=json&limit=1&countrycodes=us';
    var res  = await fetch(url, { headers: { 'Accept-Language': 'en-US' } });
    var data = await res.json();
    if (data && data.length) {
      var coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      // Cache it so future calls (and map.js) can reuse it
      cache[key] = coords;
      saveData('geo_cache', cache);
      reportOriginCoords = coords;
      return coords;
    }
  } catch (e) {
    console.error('ACC Report: geocoding origin failed -', e);
  }

  // Geocode failed - drive times will show as N/A
  return null;
}

// =============================================
// GET SCHOOL COORDS
// Checks the school record for exact lat/lng
// first, then falls back to the geo_cache.
// Returns {lat, lng} or null.
// =============================================
function getSchoolCoords(school) {
  // Some schools have exact coordinates pinned by the user
  if (school.lat != null && school.lng != null) {
    return { lat: school.lat, lng: school.lng };
  }
  // Fall back to the cached geocode result
  if (!school.address) return null;
  var cache = loadData('geo_cache', {});
  var key   = school.address.trim().toLowerCase();
  var entry = cache[key];
  if (entry && entry.lat != null) return { lat: entry.lat, lng: entry.lng };
  return null;
}

// =============================================
// FETCH DRIVE INFO
// Calls the OSRM public routing API to get
// road distance and drive time between two
// coordinate pairs. Returns {seconds, meters}
// or null if the request fails.
// OSRM uses lng,lat order (not lat,lng).
// =============================================
async function fetchDriveInfo(originCoords, destCoords) {
  var url = 'https://router.project-osrm.org/route/v1/driving/'
    + originCoords.lng + ',' + originCoords.lat + ';'
    + destCoords.lng   + ',' + destCoords.lat
    + '?overview=false';
  try {
    var res  = await fetch(url);
    if (!res.ok) return null;
    var data = await res.json();
    if (!data.routes || !data.routes.length) return null;
    return {
      seconds: Math.round(data.routes[0].duration),
      meters:  Math.round(data.routes[0].distance),
    };
  } catch (e) {
    // OSRM unreachable or rate-limited - drive time will show N/A
    return null;
  }
}

// =============================================
// VISIT COUNT HELPERS
// =============================================

// Counts how many logged visits exist for one school
function countSchoolVisits(schoolId, visits) {
  return visits.filter(function(v) { return v.schoolId === schoolId; }).length;
}

// Counts logged visits for all schools in the same TN region
function countRegionVisits(region, schools, counties, visits) {
  if (!region) return 0;

  // Find all school IDs that belong to this region
  var regionSchoolIds = schools.filter(function(s) {
    var county = counties.find(function(c) { return c.id === s.countyId; });
    return county && county.region === region;
  }).map(function(s) { return s.id; });

  return visits.filter(function(v) {
    return regionSchoolIds.indexOf(v.schoolId) !== -1;
  }).length;
}

// =============================================
// RENDER REPORT
// Splits items into confirmed/tentative sections
// and builds the HTML output.
// =============================================
function renderReport(items, fromStr, toStr) {
  var output = document.getElementById('report-output');
  if (!output) return;

  var confirmed = items.filter(function(i) { return !i.tentative; });
  var tentative = items.filter(function(i) { return  i.tentative; });

  // Header: date range and count summary
  var html = [
    '<div class="report-summary-bar">',
      '<span class="report-range-label">',
        reportFmtDate(fromStr) + ' to ' + reportFmtDate(toStr),
      '</span>',
      '<span class="report-count-pill confirmed-pill">',
        confirmed.length + ' Confirmed',
      '</span>',
      '<span class="report-count-pill tentative-pill">',
        tentative.length + ' Tentative',
      '</span>',
    '</div>',
  ].join('');

  if (confirmed.length === 0 && tentative.length === 0) {
    html += '<div class="report-empty">No visits or events scheduled in this date range.</div>';
    output.innerHTML = html;
    return;
  }

  if (confirmed.length) {
    html += '<div class="report-section-label confirmed-label">&#10003; Confirmed (' + confirmed.length + ')</div>';
    html += '<div class="report-table-wrap"><div class="report-table">';
    html += renderTableHeader();
    confirmed.forEach(function(item) { html += renderRow(item); });
    html += '</div></div>';
  }

  if (tentative.length) {
    html += '<div class="report-section-label tentative-label">&#10067; Tentative (' + tentative.length + ')</div>';
    html += '<div class="report-table-wrap"><div class="report-table">';
    html += renderTableHeader();
    tentative.forEach(function(item) { html += renderRow(item); });
    html += '</div></div>';
  }

  output.innerHTML = html;
}

// Renders the sticky column header row
function renderTableHeader() {
  return [
    '<div class="report-row report-header-row">',
      '<div class="report-col">Date</div>',
      '<div class="report-col">School / Event</div>',
      '<div class="report-col">Region</div>',
      '<div class="report-col report-col-drive">Drive Time</div>',
      '<div class="report-col report-col-dist">Distance</div>',
      '<div class="report-col report-col-visits">School Visits</div>',
      '<div class="report-col report-col-rvisits">Region Visits</div>',
      '<div class="report-col report-col-notes">Notes / Purpose</div>',
    '</div>',
  ].join('');
}

// Renders one data row for a visit or event item
function renderRow(item) {
  // Date and time cell
  var timeStr = item.time ? '<span class="report-time-str">' + reportFmtTime(item.time) + '</span>' : '';
  var dateCell = '<span class="report-date-str">' + reportFmtDate(item.date) + '</span>' + timeStr;

  // Name cell - name + priority/type badge + host school for tentative events
  var nameHtml = '<span class="report-item-name">' + reportEsc(item.name) + '</span>';
  if (item.type === 'event') {
    var typeLabel = item.eventType || 'Event';
    nameHtml += ' <span class="report-type-badge">' + reportEsc(typeLabel) + '</span>';
    if (item.hostSchool) {
      nameHtml += '<div class="report-host-school">&#128205; ' + reportEsc(item.hostSchool.name);
      if (item.attendCount) nameHtml += ' + ' + item.attendCount + ' attending';
      nameHtml += '</div>';
    }
  } else if (item.school && item.school.priority) {
    var pri = item.school.priority;
    nameHtml += ' <span class="report-priority-badge report-priority-' + pri.toLowerCase() + '">'
      + reportEsc(pri) + '</span>';
  }

  // Region cell
  var regionStr = item.region ? reportEsc(item.region) : (item.type === 'event' ? '<span class="report-na">Event</span>' : '<span class="report-na">-</span>');

  // Drive time and distance cells
  var driveStr, distStr;
  if (item.driveInfo) {
    driveStr = reportFmtDriveTime(item.driveInfo.seconds);
    distStr  = reportFmtMiles(item.driveInfo.meters);
  } else if (item.type === 'event') {
    driveStr = '<span class="report-na">N/A</span>';
    distStr  = '<span class="report-na">N/A</span>';
  } else {
    driveStr = '<span class="report-na">-</span>';
    distStr  = '<span class="report-na">-</span>';
  }

  // Visit counts - only shown for planned school visits
  var schoolVisitsStr  = (item.type === 'visit') ? item.schoolVisitCount  : '<span class="report-na">-</span>';
  var regionVisitsStr  = (item.type === 'visit') ? item.regionVisitCount  : '<span class="report-na">-</span>';

  // Notes cell
  var notesHtml = item.notes ? reportEsc(item.notes) : '<span class="report-na">-</span>';

  return [
    '<div class="report-row">',
      '<div class="report-col">', dateCell, '</div>',
      '<div class="report-col">', nameHtml, '</div>',
      '<div class="report-col">', regionStr, '</div>',
      '<div class="report-col report-col-drive">', driveStr, '</div>',
      '<div class="report-col report-col-dist">',  distStr,  '</div>',
      '<div class="report-col report-col-visits">', schoolVisitsStr, '</div>',
      '<div class="report-col report-col-rvisits">', regionVisitsStr, '</div>',
      '<div class="report-col report-col-notes">', notesHtml, '</div>',
    '</div>',
  ].join('');
}

// =============================================
// PRINT
// Triggers the browser print dialog. The CSS
// @media print rules handle hiding the app
// shell and switching to a light theme.
// =============================================
function printReport() {
  window.print();
}

// =============================================
// FORMAT HELPERS
// =============================================

// Escapes HTML special characters to prevent XSS.
// Defined here so report.js has no dependency on visits.js.
function reportEsc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Formats a YYYY-MM-DD string as a readable date like "Mon, Aug 18, 2026".
// Parses as local midnight to avoid timezone drift shifting the day.
function reportFmtDate(dateStr) {
  if (!dateStr) return '';
  var p = dateStr.split('-');
  var d = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month:   'short',
    day:     'numeric',
    year:    'numeric',
  });
}

// Formats a HH:MM time string as "9:30 AM"
function reportFmtTime(timeStr) {
  if (!timeStr) return '';
  var parts = timeStr.split(':');
  var h     = parseInt(parts[0], 10);
  var m     = parts[1] || '00';
  var ampm  = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + m + ' ' + ampm;
}

// Formats OSRM duration in seconds as "1 hr 14 min" or "42 min"
function reportFmtDriveTime(seconds) {
  var mins = Math.round(seconds / 60);
  if (mins < 60) return mins + ' min';
  var hrs  = Math.floor(mins / 60);
  var rem  = mins % 60;
  return hrs + ' hr' + (rem ? ' ' + rem + ' min' : '');
}

// Formats OSRM distance in meters as "47.2 mi"
function reportFmtMiles(meters) {
  var miles = meters / 1609.344;
  return miles.toFixed(1) + ' mi';
}
