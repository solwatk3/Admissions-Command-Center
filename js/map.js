// =============================================
// ACC - School Map View
// Interactive Leaflet map showing all schools in the directory.
// Addresses are geocoded via Nominatim (free, no API key).
// Coordinates are cached in localStorage so each address
// is only looked up once.
// =============================================

// Holds the current Leaflet map so we can remove it before
// creating a fresh one - prevents duplicate map instances
let mapInstance = null;

// =============================================
// TOGGLE BETWEEN LIST AND MAP VIEW
// Called from the toggle button in the directory controls
// =============================================
function showDirectoryMap() {
  // Hide the normal directory content, show the map container
  const content   = document.getElementById('directory-content');
  const mapWrap   = document.getElementById('directory-map-wrap');
  const listBtn   = document.getElementById('dir-list-btn');
  const alphaBtn  = document.getElementById('dir-alpha-btn');
  const mapBtn    = document.getElementById('dir-map-btn');
  const regionBtn = document.getElementById('dir-region-btn');

  if (!content || !mapWrap) return;

  content.style.display  = 'none';
  mapWrap.style.display  = 'block';
  if (listBtn)   listBtn.classList.remove('active-toggle');
  if (alphaBtn)  alphaBtn.classList.remove('active-toggle');
  if (mapBtn)    mapBtn.classList.add('active-toggle');
  if (regionBtn) regionBtn.classList.remove('active-toggle');

  // Init or refresh the map
  initSchoolMap();
}

function showDirectoryList() {
  const content   = document.getElementById('directory-content');
  const mapWrap   = document.getElementById('directory-map-wrap');
  const alphaBtn  = document.getElementById('dir-alpha-btn');
  const mapBtn    = document.getElementById('dir-map-btn');
  const regionBtn = document.getElementById('dir-region-btn');

  if (!content || !mapWrap) return;

  content.style.display  = '';
  mapWrap.style.display  = 'none';
  if (alphaBtn)  alphaBtn.classList.add('active-toggle');
  if (mapBtn)    mapBtn.classList.remove('active-toggle');
  if (regionBtn) regionBtn.classList.remove('active-toggle');

  // Re-render the county pills (now always A-Z sorted)
  renderCountyPills();
}

// =============================================
// GEOCODE CACHE
// Stores address -> {lat, lng} lookups in localStorage
// so we never hit Nominatim twice for the same address
// =============================================
function getGeoCache() {
  return loadData('geo_cache', {});
}

function saveGeoCache(cache) {
  saveData('geo_cache', cache);
}

// =============================================
// GEOCODE ONE ADDRESS
// Hits Nominatim's free API to convert a street address to coordinates.
// Returns a promise that resolves to {lat, lng} or null if not found.
// Respects Nominatim's 1-request-per-second rate limit via the delay param.
// =============================================
function geocodeAddress(address, delayMs) {
  return new Promise(function(resolve) {
    setTimeout(function() {
      const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q='
        + encodeURIComponent(address + ', Tennessee, USA');

      fetch(url, {
        headers: {
          // Nominatim requires a descriptive User-Agent per their usage policy
          'User-Agent': 'ACC-AdmissionsCommandCenter/1.0'
        }
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data && data.length > 0) {
          resolve({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        } else {
          resolve(null);
        }
      })
      .catch(function() { resolve(null); });
    }, delayMs);
  });
}

// =============================================
// GEOCODE ALL SCHOOLS
// Loops through every school that has an address,
// checks the cache first, then calls Nominatim if needed.
// Uses a fallback chain (exact -> city -> ZIP -> county) so that
// even if the exact address isn't found, the pin lands near the right area.
// Staggers requests by 1.1 seconds each to stay within rate limits.
// Returns a promise resolving to { school, lat, lng, fallback } objects.
// fallback:true means the location is approximate - user can drag to correct.
// onProgress(done, total) is called after each network lookup so the caller
// can update a live counter - cached hits don't count toward the total.
// =============================================
async function geocodeAllSchools(schools, onProgress) {
  const cache   = getGeoCache();
  const results = [];
  let   delay   = 0;

  // Load counties once up front - used for the county-name fallback query.
  // Avoids re-reading localStorage inside the loop for every school.
  const allCounties = getCounties();

  // Count how many schools actually need a network request (not in cache)
  // so we can show a meaningful "X of Y" counter to the user.
  const toFetch = schools.filter(function(s) {
    return s.address && s.address.trim() && !cache[s.address.trim().toLowerCase()];
  }).length;
  let fetched = 0;

  for (const school of schools) {
    if (!school.address || !school.address.trim()) continue;

    const key = school.address.trim().toLowerCase();

    if (cache[key]) {
      // Already cached - use it (includes manual drag corrections)
      results.push({
        school:   school,
        lat:      cache[key].lat,
        lng:      cache[key].lng,
        fallback: !!cache[key].fallback,
      });
      continue;
    }

    // Build a fallback chain from most specific to least specific
    const parts   = school.address.split(',').map(function(p) { return p.trim(); });
    const city    = parts[1] || '';
    const lastPart = parts[parts.length - 1] || '';
    const zip     = lastPart.replace(/^TN\s*/i, '').trim();
    const county  = allCounties.find(function(c) { return c.id === school.countyId; });

    // Note: geocodeAddress() already appends ", Tennessee, USA" - do not add it here
    const attempts = [
      // 1. Full street address - most accurate
      { query: school.address.trim(), fallback: false },
    ];

    // 2. City only - lands somewhere in the right town
    if (city) {
      attempts.push({ query: city, fallback: true });
    }

    // 3. ZIP code - drops pin in the right postal area
    if (zip && /^\d{5}$/.test(zip)) {
      attempts.push({ query: zip, fallback: true });
    }

    // 4. County name - last resort, at least gets the right county
    if (county) {
      attempts.push({ query: county.name + ' County', fallback: true });
    }

    // Try each query in order, stop at the first one that works
    let found = null;
    for (const attempt of attempts) {
      const coords = await geocodeAddress(attempt.query, delay);
      delay += 1100; // 1.1 second gap per request to respect rate limits

      if (coords) {
        found = { lat: coords.lat, lng: coords.lng, fallback: attempt.fallback };
        break;
      }
    }

    if (found) {
      // Cache with fallback flag so resync knows it can be retried
      cache[key] = { lat: found.lat, lng: found.lng, fallback: found.fallback };
      results.push({ school: school, lat: found.lat, lng: found.lng, fallback: found.fallback });
    }

    // Report progress after each network lookup (not cache hits)
    fetched++;
    if (onProgress) onProgress(fetched, toFetch);
  }

  saveGeoCache(cache);
  return results;
}

// =============================================
// INIT SCHOOL MAP
// Creates or refreshes the Leaflet map.
// Called each time the user switches to map view.
// =============================================
async function initSchoolMap() {
  const mapEl = document.getElementById('school-map');
  if (!mapEl) return;

  const schools = getSchools();

  // Show a loading message while geocoding
  const statusEl = document.getElementById('map-status');

  // Helper that writes a spinning-icon + counter message into the status bar
  function setStatus(done, total) {
    if (!statusEl) return;
    statusEl.innerHTML = '<span class="map-status-spinner">&#8635;</span>'
      + 'Looking up addresses... (' + done + ' / ' + total + ')';
    statusEl.classList.add('geocoding-active');
    statusEl.style.display = 'block';
  }

  if (statusEl) {
    const needsLookup = schools.filter(function(s) {
      return s.address && s.address.trim() &&
             !getGeoCache()[s.address.trim().toLowerCase()];
    });
    if (needsLookup.length > 0) {
      setStatus(0, needsLookup.length);
    } else {
      statusEl.style.display = 'none';
    }
  }

  // If the map already exists, just remove and recreate to avoid stale tiles
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }

  // Center on Tennessee, zoom level 7 shows the whole state.
  // scrollWheelZoom: false - we handle scroll ourselves below so we get
  // exactly 1 zoom level per tick regardless of mouse/trackpad sensitivity.
  mapInstance = L.map('school-map', { scrollWheelZoom: false }).setView([35.85, -86.35], 7);

  // Custom scroll handler: zoom exactly 1 level per wheel event.
  // _zooming stays true until Leaflet fires zoomend, so all wheel events
  // that arrive during the animation are ignored - no matter how fast
  // the mouse sends them.
  let _zooming = false;
  mapInstance.getContainer().addEventListener('wheel', function(e) {
    e.preventDefault();
    if (_zooming) return;
    _zooming = true;
    if (e.deltaY < 0) {
      mapInstance.zoomIn(1);
    } else {
      mapInstance.zoomOut(1);
    }
    // Unlock only after the zoom animation fully completes
    mapInstance.once('zoomend', function() { _zooming = false; });
  }, { passive: false });

  // Short-click the map background = zoom in one level.
  // Right-click the map background = zoom out one level.
  // _markerJustClicked is set by each school dot's click handler so that
  // clicking a dot opens its popup instead of also triggering a zoom.
  let _markerJustClicked = false;

  mapInstance.on('click', function() {
    if (_markerJustClicked) { _markerJustClicked = false; return; }
    mapInstance.zoomIn(1);
  });

  mapInstance.on('contextmenu', function() {
    mapInstance.zoomOut(1);
  });

  // County boundary pane - sits below the default overlayPane (z-index 400)
  // so county polygons never block hover events on circle markers.
  mapInstance.createPane('countyPane');
  mapInstance.getPane('countyPane').style.zIndex = 350;

  // Street view tile layer - OpenStreetMap
  const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  });

  // Satellite view tile layer - Esri World Imagery (free, no key needed)
  const satelliteLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, USGS, NOAA',
    maxZoom: 19,
  });

  // Start on street view by default
  streetLayer.addTo(mapInstance);

  // Layer toggle control in the top-right corner
  L.control.layers(
    { 'Street': streetLayer, 'Satellite': satelliteLayer },
    {},
    { position: 'topright', collapsed: false }
  ).addTo(mapInstance);

  // Load Tennessee county boundaries from a public GeoJSON file
  // and shade counties where schools exist
  loadTNCountyBoundaries(schools);

  // Geocode all school addresses and drop pins - pass the live counter callback
  const plotted = await geocodeAllSchools(schools, setStatus);

  // Hide the loading message and remove the active style once geocoding is done
  if (statusEl) {
    statusEl.style.display = 'none';
    statusEl.classList.remove('geocoding-active');
  }

  if (plotted.length === 0) {
    if (statusEl) {
      statusEl.textContent = 'No addresses found. Add addresses to your schools to see them on the map.';
      statusEl.style.display = 'block';
    }
    return;
  }

  // Priority colors for marker icons.
  // Matches the app's priority levels; anything unknown falls back to grey.
  const priorityColor = {
    'Primary':   '#9b30ff',
    'Secondary': '#5c6bc0',
    'Tertiary':  '#546e7a',
  };

  // Load counties ONCE before the loop instead of re-reading
  // localStorage for every single marker
  const allCounties = getCounties();

  // Drop a circle marker for each geocoded school
  plotted.forEach(function(item) {
    const color  = priorityColor[item.school.priority] || '#546e7a';
    const county = allCounties.find(c => c.id === item.school.countyId);

    // Fallback pins use a dashed orange border so they're visually distinct
    const markerColor   = item.fallback ? '#ff9800' : color;
    const markerBorder  = item.fallback ? '#ffffff'  : '#ffffff';
    const markerOpacity = item.fallback ? 0.65       : 0.9;

    // Add an approximate-location note for fallback pins
    const fallbackNote = item.fallback
      ? '<br/><span style="font-size:0.75rem; color:#ff9800; font-weight:600;">&#9432; Approximate location - open school detail to drag pin</span>'
      : '';

    // Build the popup content shown when a marker is clicked
    const popupHtml = `
      <div style="font-family:inherit; min-width:160px;">
        <strong style="color:#1a0a2e; font-size:0.95rem;">${escapeHtml(item.school.name)}</strong>
        <br/>
        <span style="font-size:0.8rem; color:#555;">${county ? escapeHtml(county.name) + ' County' : ''}</span>
        ${item.school.priority ? `<br/><span style="font-size:0.78rem; color:${color}; font-weight:600;">${item.school.priority}</span>` : ''}
        ${item.school.address ? `<br/><span style="font-size:0.75rem; color:#777;">${escapeHtml(item.school.address)}</span>` : ''}
        ${fallbackNote}
        <br/><br/>
        <a href="#" onclick="showDirectoryList(); openSchoolDetail('${item.school.id}'); return false;"
           style="font-size:0.8rem; color:#9b30ff; text-decoration:none; font-weight:600;">
          View Details &rarr;
        </a>
      </div>
    `;

    L.circleMarker([item.lat, item.lng], {
      radius:      10,
      fillColor:   markerColor,
      color:       markerBorder,
      weight:      item.fallback ? 2 : 2,
      opacity:     1,
      fillOpacity: markerOpacity,
      // Dashed outline to signal approximate placement
      dashArray:   item.fallback ? '4 3' : null,
    })
    .addTo(mapInstance)
    .bindTooltip(escapeHtml(item.school.name), {
      // Show school name on hover, styled to match the app
      permanent:  false,
      direction:  'top',
      offset:     [0, -8],
      className:  'map-county-tooltip',
    })
    .bindPopup(popupHtml)
    .on('click', function() {
      // Signal the map click handler to skip zooming - this is a dot click
      _markerJustClicked = true;
    });
  });

  // Fit the map to show all markers with some padding
  if (plotted.length > 0) {
    const bounds = L.latLngBounds(plotted.map(function(p) { return [p.lat, p.lng]; }));
    mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
  }
}

// =============================================
// SCHOOL DETAIL MINI-MAP
// Shows a small Leaflet map pinned to a single school's address.
// Displayed in the school detail view to the right of the info fields.
// Uses the same geocode cache as the full map view.
// =============================================
let detailMapInstance = null;

async function initSchoolDetailMap(address, school) {
  const mapEl = document.getElementById('school-detail-map');
  if (!mapEl) return;

  // Clean up any previous detail map instance
  if (detailMapInstance) {
    detailMapInstance.remove();
    detailMapInstance = null;
  }

  // Try the cache first so we never re-geocode a known address
  const key   = address.trim().toLowerCase();
  const cache = getGeoCache();
  let coords     = cache[key] || null;
  let isFallback = coords ? !!coords.fallback : false;

  if (!coords) {
    // Build the same fallback chain used in geocodeAllSchools:
    // full address -> city only -> ZIP code -> county name.
    // This handles cases where the street address contains a
    // highway identifier (e.g. TN-58) that Nominatim can't resolve.
    const parts    = address.split(',').map(function(p) { return p.trim(); });
    const city     = parts[1] || '';
    const lastPart = parts[parts.length - 1] || '';
    const zip      = lastPart.replace(/^TN\s*/i, '').trim();
    const county   = school
      ? getCounties().find(function(c) { return c.id === school.countyId; })
      : null;

    const attempts = [
      // 1. Full street address - most accurate
      { query: address.trim(), fallback: false },
    ];

    // 2. City only - lands somewhere in the right town
    if (city) {
      attempts.push({ query: city, fallback: true });
    }

    // 3. ZIP code - drops pin in the right postal area
    if (zip && /^\d{5}$/.test(zip)) {
      attempts.push({ query: zip, fallback: true });
    }

    // 4. County name - last resort, at least shows the right county
    if (county) {
      attempts.push({ query: county.name + ' County', fallback: true });
    }

    // Stagger requests by 1.1 seconds each to respect Nominatim's
    // rate limit of 1 request per second. Stop at the first hit.
    let delay = 0;
    for (const attempt of attempts) {
      const result = await geocodeAddress(attempt.query, delay);
      delay += 1100;

      if (result) {
        coords     = result;
        isFallback = attempt.fallback;
        // Cache with fallback flag so a future resync knows this can be improved
        cache[key] = { lat: coords.lat, lng: coords.lng, fallback: isFallback };
        saveGeoCache(cache);
        break;
      }
    }
  }

  if (!coords) {
    // All attempts failed - show a plain message in the map area
    mapEl.innerHTML = '<p style="color:var(--text-muted); font-size:0.82rem; padding:16px; text-align:center;">Location not found for this address.</p>';
    return;
  }

  // Create the mini-map centered on the school's coordinates
  detailMapInstance = L.map('school-detail-map', {
    zoomControl:     true,
    scrollWheelZoom: false,  // prevent accidental zoom while scrolling the page
    dragging:        true,
  }).setView([coords.lat, coords.lng], 17);

  // Street view layer
  const detailStreet = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  });

  // Satellite layer - zoomed in enough to see the building
  const detailSatellite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19,
  });

  // Start on satellite by default in the detail view - more useful at street level
  detailSatellite.addTo(detailMapInstance);

  // Layer toggle in top-right
  L.control.layers(
    { 'Street': detailStreet, 'Satellite': detailSatellite },
    {},
    { position: 'topright', collapsed: false }
  ).addTo(detailMapInstance);

  // Custom purple pin icon - matches the app's color scheme
  const purpleIcon = L.divIcon({
    className:   '',  // clear Leaflet's default white box
    html:        '<div style="width:20px;height:20px;border-radius:50%;background:#9b30ff;border:3px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>',
    iconSize:    [20, 20],
    iconAnchor:  [10, 10],  // center of the circle sits on the coordinate
  });

  // If we landed on a fallback location (city/ZIP/county), update the note
  // below the map so the user knows the pin is approximate and can drag it.
  const noteEl = document.querySelector('.school-detail-map-note');
  if (isFallback && noteEl) {
    noteEl.innerHTML = '&#9432; Approximate location - drag the pin to correct it.';
    noteEl.style.color = '#ff9800';
  }

  // Use a draggable marker so the user can correct the pin position
  const marker = L.marker([coords.lat, coords.lng], {
    icon:      purpleIcon,
    draggable: true,
    title:     'Drag to correct position',
  }).addTo(detailMapInstance);

  // When the user finishes dragging, save the new coordinates to the cache.
  // The manual:true flag means this position won't be overwritten by geocoding.
  marker.on('dragend', function() {
    const pos      = marker.getLatLng();
    const cache    = getGeoCache();
    const cacheKey = address.trim().toLowerCase();

    cache[cacheKey] = { lat: pos.lat, lng: pos.lng, manual: true };
    saveGeoCache(cache);

    // Brief confirmation shown in the address note below the map
    const noteEl = document.querySelector('.school-detail-map-note');
    if (noteEl) {
      const original    = noteEl.innerHTML;
      noteEl.innerHTML  = '&#10003; Position saved!';
      noteEl.style.color = 'var(--success, #4caf50)';
      setTimeout(function() {
        noteEl.innerHTML   = original;
        noteEl.style.color = '';
      }, 2000);
    }
  });
}

// =============================================
// RESYNC MAP
// Clears all auto-geocoded cache entries (keeps manually dragged pins)
// then re-runs the full geocode + map init pass.
// Called from the Resync button in the map view.
// =============================================
async function resyncMap() {
  // Disable the button so the user can't double-trigger while geocoding runs
  const btn = document.getElementById('resync-btn');
  if (btn) {
    btn.disabled    = true;
    btn.textContent = 'Resyncing...';
  }

  const cache   = getGeoCache();
  const cleaned = {};

  // Keep only entries the user manually corrected by dragging the pin
  Object.keys(cache).forEach(function(key) {
    if (cache[key].manual) {
      cleaned[key] = cache[key];
    }
  });

  saveGeoCache(cleaned);

  // Re-init the map with a clean cache - awaiting so we restore the button after
  await initSchoolMap();

  // Restore the button once the map is fully loaded
  if (btn) {
    btn.disabled    = false;
    btn.textContent = '↻ Resync Map';
  }
}

// =============================================
// COUNTY BOUNDARY OVERLAY
// Fetches Tennessee county GeoJSON and draws county outlines.
// Counties where the user has schools are highlighted in purple.
// =============================================
function loadTNCountyBoundaries(schools) {
  if (!mapInstance) return;

  // Public Tennessee county GeoJSON from a reliable source
  fetch('https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json')
    .then(function(res) { return res.json(); })
    .then(function(geojson) {
      // Filter to only Tennessee counties (FIPS state code 47)
      const tnFeatures = geojson.features.filter(function(f) {
        return f.id && String(f.id).padStart(5, '0').startsWith('47');
      });

      // Get the set of county names from the user's directory for highlighting
      const userCountyNames = new Set(
        getCounties().map(function(c) { return c.name.toLowerCase(); })
      );

      L.geoJSON({ type: 'FeatureCollection', features: tnFeatures }, {
        // Render into the countyPane so polygons sit below circle markers,
        // preventing county tooltips from blocking school name tooltips on hover.
        pane: 'countyPane',
        style: function(feature) {
          const name      = (feature.properties.NAME || '').toLowerCase();
          const hasSchools = userCountyNames.has(name) || userCountyNames.has(name + ' county');
          return {
            color:       '#9b30ff',
            weight:      hasSchools ? 2 : 1,
            fillColor:   hasSchools ? '#9b30ff' : '#2a0a3a',
            fillOpacity: hasSchools ? 0.15 : 0.05,
            opacity:     hasSchools ? 0.8 : 0.3,
          };
        },
        onEachFeature: function(feature, layer) {
          // Show county name on hover
          layer.bindTooltip(feature.properties.NAME + ' County', {
            sticky: true,
            className: 'map-county-tooltip',
          });
        }
      }).addTo(mapInstance);
    })
    .catch(function() {
      // County boundaries are decorative - silently skip if the fetch fails
      console.warn('ACC: Could not load county boundary data.');
    });
}
