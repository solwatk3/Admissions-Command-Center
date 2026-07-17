// =============================================
// ACC - School Map View
// Interactive Leaflet map showing all schools in the directory.
// Addresses are geocoded via Nominatim (free, no API key).
// Coordinates are cached in localStorage so each address
// is only looked up once.
// =============================================

// Track whether the map has been initialized so we don't
// create duplicate Leaflet instances on re-renders
let mapInstance     = null;
let mapInitialized  = false;

// =============================================
// TOGGLE BETWEEN LIST AND MAP VIEW
// Called from the toggle button in the directory controls
// =============================================
function showDirectoryMap() {
  // Hide the normal directory content, show the map container
  const content  = document.getElementById('directory-content');
  const mapWrap  = document.getElementById('directory-map-wrap');
  const listBtn  = document.getElementById('dir-list-btn');
  const mapBtn   = document.getElementById('dir-map-btn');

  if (!content || !mapWrap) return;

  content.style.display  = 'none';
  mapWrap.style.display  = 'block';
  if (listBtn) listBtn.classList.remove('active-toggle');
  if (mapBtn)  mapBtn.classList.add('active-toggle');

  // Init or refresh the map
  initSchoolMap();
}

function showDirectoryList() {
  const content  = document.getElementById('directory-content');
  const mapWrap  = document.getElementById('directory-map-wrap');
  const listBtn  = document.getElementById('dir-list-btn');
  const mapBtn   = document.getElementById('dir-map-btn');

  if (!content || !mapWrap) return;

  content.style.display  = '';
  mapWrap.style.display  = 'none';
  if (listBtn) listBtn.classList.add('active-toggle');
  if (mapBtn)  mapBtn.classList.remove('active-toggle');
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
// Staggers requests by 1.1 seconds each to stay within rate limits.
// Returns a promise that resolves to an array of
// { school, lat, lng } objects.
// =============================================
async function geocodeAllSchools(schools) {
  const cache   = getGeoCache();
  const results = [];
  let   delay   = 0;

  for (const school of schools) {
    if (!school.address || !school.address.trim()) continue;

    const key = school.address.trim().toLowerCase();

    if (cache[key]) {
      // Already have coordinates for this address - use the cache
      results.push({ school: school, lat: cache[key].lat, lng: cache[key].lng });
    } else {
      // Not cached - fetch from Nominatim with staggered delay
      const coords = await geocodeAddress(school.address.trim(), delay);
      delay += 1100; // 1.1 second gap between requests

      if (coords) {
        // Save to cache so we don't look it up again
        cache[key] = coords;
        results.push({ school: school, lat: coords.lat, lng: coords.lng });
      }
    }
  }

  // Persist any new cache entries
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
  if (statusEl) {
    const needsLookup = schools.filter(s =>
      s.address && s.address.trim() &&
      !getGeoCache()[s.address.trim().toLowerCase()]
    );
    if (needsLookup.length > 0) {
      statusEl.textContent = 'Looking up ' + needsLookup.length + ' address'
        + (needsLookup.length !== 1 ? 'es' : '') + '... this takes a moment the first time.';
      statusEl.style.display = 'block';
    } else {
      statusEl.style.display = 'none';
    }
  }

  // If the map already exists, just remove and recreate to avoid stale tiles
  if (mapInstance) {
    mapInstance.remove();
    mapInstance     = null;
    mapInitialized  = false;
  }

  // Center on Tennessee, zoom level 7 shows the whole state
  mapInstance = L.map('school-map').setView([35.85, -86.35], 7);

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

  mapInitialized = true;

  // Load Tennessee county boundaries from a public GeoJSON file
  // and shade counties where schools exist
  loadTNCountyBoundaries(schools);

  // Geocode all school addresses and drop pins
  const plotted = await geocodeAllSchools(schools);

  // Hide the loading message once geocoding is done
  if (statusEl) statusEl.style.display = 'none';

  if (plotted.length === 0) {
    if (statusEl) {
      statusEl.textContent = 'No addresses found. Add addresses to your schools to see them on the map.';
      statusEl.style.display = 'block';
    }
    return;
  }

  // Priority colors for marker icons
  const priorityColor = {
    'Primary':   '#9b30ff',
    'Secondary': '#5c6bc0',
    'Low':       '#546e7a',
  };

  // Drop a circle marker for each geocoded school
  plotted.forEach(function(item) {
    const color  = priorityColor[item.school.priority] || '#546e7a';
    const county = getCounties().find(c => c.id === item.school.countyId);

    // Build the popup content shown when a marker is clicked
    const popupHtml = `
      <div style="font-family:inherit; min-width:160px;">
        <strong style="color:#1a0a2e; font-size:0.95rem;">${item.school.name}</strong>
        <br/>
        <span style="font-size:0.8rem; color:#555;">${county ? county.name + ' County' : ''}</span>
        ${item.school.priority ? `<br/><span style="font-size:0.78rem; color:${color}; font-weight:600;">${item.school.priority}</span>` : ''}
        ${item.school.address ? `<br/><span style="font-size:0.75rem; color:#777;">${item.school.address}</span>` : ''}
        <br/><br/>
        <a href="#" onclick="showDirectoryList(); openSchoolDetail('${item.school.id}'); return false;"
           style="font-size:0.8rem; color:#9b30ff; text-decoration:none; font-weight:600;">
          View Details &rarr;
        </a>
      </div>
    `;

    L.circleMarker([item.lat, item.lng], {
      radius:      10,
      fillColor:   color,
      color:       '#ffffff',
      weight:      2,
      opacity:     1,
      fillOpacity: 0.9,
    })
    .addTo(mapInstance)
    .bindPopup(popupHtml);
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

async function initSchoolDetailMap(address) {
  const mapEl = document.getElementById('school-detail-map');
  if (!mapEl) return;

  // Clean up any previous detail map instance
  if (detailMapInstance) {
    detailMapInstance.remove();
    detailMapInstance = null;
  }

  // Try the cache first, then Nominatim if not cached
  const key   = address.trim().toLowerCase();
  const cache = getGeoCache();
  let coords  = cache[key] || null;

  if (!coords) {
    coords = await geocodeAddress(address.trim(), 0);
    if (coords) {
      cache[key] = coords;
      saveGeoCache(cache);
    }
  }

  if (!coords) {
    // Address couldn't be geocoded - show a plain message in the map area
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
function resyncMap() {
  const cache    = getGeoCache();
  const cleaned  = {};

  // Keep only entries the user manually corrected by dragging the pin
  Object.keys(cache).forEach(function(key) {
    if (cache[key].manual) {
      cleaned[key] = cache[key];
    }
  });

  saveGeoCache(cleaned);

  // Show a brief status message so the user knows it's working
  const statusEl = document.getElementById('map-status');
  if (statusEl) {
    statusEl.textContent = 'Resyncing all addresses...';
    statusEl.style.display = 'block';
  }

  // Re-init the map with a clean cache
  initSchoolMap();
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
