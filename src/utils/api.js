// ═══════════════════════════════════════════════
// HOMERUN v2 — Transport Scan Engine
// Discovers every possible way home from any point
// ═══════════════════════════════════════════════

const NOMINATIM  = 'https://nominatim.openstreetmap.org'
const OSRM       = 'https://router.project-osrm.org'
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

async function overpassQuery(query) {
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const res = await fetch(mirror, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(12000),
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      return await res.json()
    } catch (err) {
      console.warn('Overpass mirror failed:', mirror, err.message)
    }
  }
  throw new Error('All Overpass mirrors failed')
}
const TRANSITOUS = 'https://api.transitous.org/api/v1'
const UA         = { 'User-Agent': 'HOMERUN-v2/1.0 (transit-navigator)' }

// ── Geocoding ──────────────────────────────────

export async function reverseGeocode(lat, lon) {
  const r = await fetch(`${NOMINATIM}/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`, { headers: UA })
  return r.json()
}

export async function geocodeSearch(query) {
  if (!query || query.length < 2) return []
  try {
    // Run multiple searches in parallel for better results
    const [general, stations, towns] = await Promise.all([
      fetch(`${NOMINATIM}/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1&countrycodes=gb`, { headers: UA }).then(r => r.json()).catch(() => []),
      fetch(`${NOMINATIM}/search?q=${encodeURIComponent(query + ' railway station')}&format=json&limit=3&addressdetails=1&countrycodes=gb`, { headers: UA }).then(r => r.json()).catch(() => []),
      fetch(`${NOMINATIM}/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1&countrycodes=gb&featuretype=city,town,village`, { headers: UA }).then(r => r.json()).catch(() => []),
    ])

    // Combine and deduplicate by proximity
    const all = [...stations, ...general, ...towns]
    const seen = new Set()
    const results = []

    for (const d of all) {
      const lat = parseFloat(d.lat)
      const lon = parseFloat(d.lon)
      const key = `${lat.toFixed(3)},${lon.toFixed(3)}`
      if (seen.has(key)) continue
      seen.add(key)

      // Format display name nicely
      const addr = d.address || {}
      let name = d.display_name

      // For railway stations, show station name prominently
      if (d.type === 'station' || d.class === 'railway' || name.toLowerCase().includes('railway station')) {
        const stationName = addr.railway || addr.amenity || name.split(',')[0]
        const town = addr.city || addr.town || addr.village || ''
        name = stationName + (town ? ', ' + town : '')
      } else {
        // Shorten display name
        const parts = d.display_name.split(',').map(p => p.trim())
        name = parts.slice(0, 3).join(', ')
      }

      results.push({ name, lat, lon, type: d.type, class: d.class })
    }

    return results.slice(0, 8)
  } catch { return [] }
}

// ── Walking distance via OSRM ──────────────────

export async function walkingRoute(fromLat, fromLon, toLat, toLon) {
  try {
    const r = await fetch(`${OSRM}/route/v1/walking/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson&steps=false`)
    const d = await r.json()
    if (d.code !== 'Ok') return null
    return {
      duration: d.routes[0].duration,
      distance: d.routes[0].distance,
      geometry: d.routes[0].geometry,
    }
  } catch { return null }
}

export async function drivingRoute(fromLat, fromLon, toLat, toLon) {
  try {
    const r = await fetch(`${OSRM}/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson`)
    const d = await r.json()
    if (d.code !== 'Ok') return null
    return { duration: d.routes[0].duration, distance: d.routes[0].distance, geometry: d.routes[0].geometry }
  } catch { return null }
}

// ── Transitous live departures ─────────────────

export async function fetchLiveDepartures(lat, lon) {
  try {
    const now  = new Date()
    const date = now.toISOString().split('T')[0]
    const time = now.toTimeString().slice(0, 5)
    const r    = await fetch(`${TRANSITOUS}/stoptimes?lat=${lat}&lon=${lon}&radius=500&time=${time}&date=${date}&numDepartures=8`)
    if (!r.ok) return null
    return r.json()
  } catch { return null }
}

export async function fetchTransitRoute(from, to) {
  try {
    const now  = new Date()
    const date = now.toISOString().split('T')[0]
    const time = now.toTimeString().slice(0, 5)
    const r    = await fetch(`${TRANSITOUS}/plan?fromLat=${from.lat}&fromLon=${from.lon}&toLat=${to.lat}&toLon=${to.lon}&time=${time}&date=${date}&numItineraries=3`)
    if (!r.ok) return null
    return r.json()
  } catch { return null }
}

// ── Overpass deep scan ─────────────────────────
// Scans for ALL transport infrastructure in expanding rings

export async function deepScan(lat, lon) {
  const query = `
[out:json][timeout:25];
(
  node["highway"="bus_stop"](around:8000,${lat},${lon});
  node["public_transport"="stop_position"]["bus"="yes"](around:8000,${lat},${lon});
  node["public_transport"="platform"](around:8000,${lat},${lon});

  node["railway"="station"](around:32000,${lat},${lon});
  node["railway"="halt"](around:32000,${lat},${lon});
  node["railway"="tram_stop"](around:10000,${lat},${lon});
  node["railway"="subway_entrance"](around:2000,${lat},${lon});

  node["amenity"="taxi"](around:8000,${lat},${lon});
  node["amenity"="car_rental"](around:5000,${lat},${lon});
  node["amenity"="car_sharing"](around:3000,${lat},${lon});
  node["amenity"="bicycle_rental"](around:2000,${lat},${lon});
  node["amenity"="ferry_terminal"](around:32000,${lat},${lon});
  node["amenity"="bus_station"](around:16000,${lat},${lon});

  node["aeroway"="aerodrome"](around:30000,${lat},${lon});
  node["aeroway"="helipad"](around:15000,${lat},${lon});

  node["highway"="bus_stop"]["network"~"National Express|Megabus|FlixBus",i](around:10000,${lat},${lon});
  node["amenity"="coach_stop"](around:10000,${lat},${lon});
  node["highway"="bus_stop"]["operator"~"National Express|Megabus",i](around:10000,${lat},${lon});

  node["leisure"="slipway"](around:10000,${lat},${lon});

  node["amenity"="charging_station"]["motorcar"="yes"](around:5000,${lat},${lon});
);
out body;
`

  const mirrors = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.osm.ch/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  ]
  for (const mirror of mirrors) {
    try {
      const r = await fetch(mirror, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: AbortSignal.timeout(12000),
      })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const data = await r.json()
      return classifyResults(data.elements || [], lat, lon)
    } catch (e) {
      console.warn('Overpass mirror failed:', mirror, e.message)
    }
  }
  console.warn('All Overpass mirrors failed')
  return emptyResults()
}

// Also scan for local taxi companies by name/phone
export async function scanLocalTaxis(lat, lon) {
  const query = `
[out:json][timeout:15];
(
  node["amenity"="taxi"](around:5000,${lat},${lon});
  way["amenity"="taxi"](around:5000,${lat},${lon});
  node["office"="taxi"](around:5000,${lat},${lon});
  node["shop"="taxi"](around:5000,${lat},${lon});
);
out body center;
`
  const mirrors = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.osm.ch/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  ]
  for (const mirror of mirrors) {
    try {
      const r = await fetch(mirror, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: AbortSignal.timeout(12000),
      })
      if (!r.ok) continue
      const data = await r.json()
      return (data.elements || [])
      .filter(el => el.tags)
      .map(el => {
        const clat = el.lat || el.center?.lat
        const clon = el.lon || el.center?.lon
        return {
          id: el.id,
          name: el.tags.operator || el.tags.name || el.tags.brand || 'Local Taxi',
          phone: el.tags.phone || el.tags['contact:phone'] || el.tags['contact:mobile'] || null,
          website: el.tags.website || el.tags['contact:website'] || null,
          lat: clat, lon: clon,
          dist: haversine(lat, lon, clat, clon),
        }
      })
      .filter(t => t.lat && t.phone)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 6)
    } catch { continue }
  }
  return []
}

function classifyResults(elements, lat, lon) {
  const results = emptyResults()

  elements.forEach(el => {
    if (!el.lat || !el.lon || !el.tags) return
    const dist = haversine(lat, lon, el.lat, el.lon)
    const tags = el.tags
    const base = {
      id: el.id, lat: el.lat, lon: el.lon, dist,
      name: tags.name || tags.ref || tags.operator || null,
      tags,
    }

    // Bus stops
    if (tags.highway === 'bus_stop' || (tags.public_transport && tags.bus === 'yes')) {
      results.bus.push({
        ...base,
        type: 'bus', icon: '🚌', color: 'var(--bus)',
        label: base.name || 'Bus Stop',
        routes: tags.route_ref || tags.ref || '',
        ref: tags.ref || tags.local_ref || '',
        operator: tags.operator || '',
        departures: [],
      })
    }
    // Bus stations
    else if (tags.amenity === 'bus_station') {
      results.bus.push({
        ...base, type: 'bus_station', icon: '🚌', color: 'var(--bus)',
        label: base.name || 'Bus Station',
        isStation: true, departures: [],
      })
    }
    // Train
    else if (tags.railway === 'station' || tags.railway === 'halt') {
      // Check if it looks like a real mainline station
      const networkTags = (tags.network || tags.operator || tags.usage || tags.service || '').toLowerCase()
      const isMainline = !networkTags || 
        /national rail|network rail|south western|southern|thameslink|great western|avanti|crosscountry|chiltern|c2c|gatwick|stansted|transpennine|northern|east midlands|greater anglia|southeastern|transport for wales|scotrail|caledonian/i.test(networkTags) ||
        tags.usage === 'main' || tags.usage === 'branch' ||
        tags['railway:ref'] // Has a CRS-like reference
      results.train.push({
        ...base,
        type: 'train',
        icon: '🚆',
        color: 'var(--train)',
        label: base.name || 'Railway Station',
        lines: tags['railway:ref'] || tags.network || '',
        operator: tags.operator || '',
        departures: [],
      })
    }
    // Tram
    else if (tags.railway === 'tram_stop') {
      results.tram.push({
        ...base, type: 'tram', icon: '🚋', color: 'var(--coach)',
        label: base.name || 'Tram Stop',
        network: tags.network || '',
        departures: [],
      })
    }
    // Metro/Underground
    else if (tags.railway === 'subway_entrance' || tags.station === 'subway') {
      results.metro.push({
        ...base, type: 'metro', icon: '🚇', color: 'var(--cyan)',
        label: base.name || 'Metro Station',
        departures: [],
      })
    }
    // Taxi ranks
    else if (tags.amenity === 'taxi') {
      results.taxi.push({
        ...base, type: 'taxi', icon: '🚕', color: 'var(--taxi)',
        label: base.name || tags.operator || 'Taxi Rank',
        phone: tags.phone || tags['contact:phone'] || null,
        operator: tags.operator || '',
      })
    }
    // Car rental
    else if (tags.amenity === 'car_rental') {
      results.car.push({
        ...base, type: 'car_rental', icon: '🚗', color: 'var(--car)',
        label: base.name || 'Car Rental',
        operator: tags.operator || tags.brand || '',
        phone: tags.phone || null,
        website: tags.website || null,
      })
    }
    // Car share
    else if (tags.amenity === 'car_sharing') {
      results.car.push({
        ...base, type: 'car_share', icon: '🔑', color: 'var(--car)',
        label: base.name || tags.operator || 'Car Share',
        operator: tags.operator || '',
      })
    }
    // Cycle hire
    else if (tags.amenity === 'bicycle_rental') {
      results.cycle.push({
        ...base, type: 'cycle', icon: '🚲', color: 'var(--cycle)',
        label: base.name || tags.operator || 'Cycle Hire',
        network: tags.network || tags.operator || '',
        capacity: tags.capacity || null,
      })
    }
    // Ferry
    else if (tags.amenity === 'ferry_terminal') {
      results.ferry.push({
        ...base, type: 'ferry', icon: '⛴️', color: 'var(--ferry)',
        label: base.name || 'Ferry Terminal',
        operator: tags.operator || '',
        departures: [],
      })
    }
    // Coach
    else if (tags.amenity === 'coach_stop' ||
             (tags.highway === 'bus_stop' && /national express|megabus|flixbus/i.test(tags.operator || tags.network || ''))) {
      results.coach.push({
        ...base, type: 'coach', icon: '🚌', color: 'var(--coach)',
        label: base.name || 'Coach Stop',
        operator: tags.operator || tags.network || '',
        departures: [],
      })
    }
    // Airport
    else if (tags.aeroway === 'aerodrome') {
      results.air.push({
        ...base, type: 'airport', icon: '✈️', color: 'var(--air)',
        label: base.name || 'Airfield',
        iata: tags.iata || '',
      })
    }
    // Helipad
    else if (tags.aeroway === 'helipad') {
      results.air.push({
        ...base, type: 'helipad', icon: '🚁', color: 'var(--air)',
        label: base.name || 'Helipad',
      })
    }
    // Scooter (e-scooter docks)
    else if (tags.amenity === 'kick-scooter_rental' || /lime|tier|voi|spin|bird/i.test(tags.operator || tags.network || '')) {
      results.scooter.push({
        ...base, type: 'scooter', icon: '🛴', color: 'var(--scooter)',
        label: base.name || tags.operator || 'E-Scooter',
        operator: tags.operator || '',
      })
    }
  })

  // Sort each by distance, cap counts
  Object.keys(results).forEach(k => {
    results[k].sort((a, b) => a.dist - b.dist)
  })

  // Dedup bus stops by proximity (within 30m = same stop)
  results.bus = dedupByProximity(results.bus, 30).slice(0, 10)

  return results
}

function dedupByProximity(items, thresholdM) {
  const kept = []
  items.forEach(item => {
    const tooClose = kept.some(k => haversine(k.lat, k.lon, item.lat, item.lon) < thresholdM)
    if (!tooClose) kept.push(item)
  })
  return kept
}

function emptyResults() {
  return { bus: [], train: [], tram: [], metro: [], taxi: [], car: [], cycle: [], ferry: [], coach: [], air: [], scooter: [] }
}

// ── Get Me Home route intelligence ────────────

export async function computeHomeRoutes(from, to, scanResults) {
  const routes = []

  // Walking routes to each transport node + onward journey
  const [walkR, driveR, cycleR, transitR] = await Promise.allSettled([
    fetchOSRM('walking', from, to),
    fetchOSRM('driving', from, to),
    fetchOSRM('cycling', from, to),
    fetchTransitRoute(from, to),
  ])

  if (walkR.status === 'fulfilled' && walkR.value) {
    routes.push({
      id: 'walk', mode: 'walk', icon: '🚶', color: 'var(--walk)',
      label: 'Walk entire route',
      duration: walkR.value.distance / 83 * 60,
      distance: walkR.value.distance,
      geometry: walkR.value.geometry,
      legs: [{ icon: '🚶', color: 'var(--walk)', label: 'Walk', duration: walkR.value.duration }],
      summary: `Walk ${fmtDuration(walkR.value.distance / 83 * 60)} · ${fmtDist(walkR.value.distance)}`,
      duration: walkR.value.distance / 83 * 60,
      costEstimate: 'Free',
    })
  }

  if (driveR.status === 'fulfilled' && driveR.value) {
    const cost = taxiCost(driveR.value.distance)
    routes.push({
      id: 'drive', mode: 'drive', icon: '🚗', color: 'var(--car)',
      label: 'Drive / Car',
      duration: driveR.value.duration,
      distance: driveR.value.distance,
      geometry: driveR.value.geometry,
      legs: [{ icon: '🚗', color: 'var(--car)', label: 'Drive', duration: driveR.value.duration }],
      summary: `Drive ${fmtDuration(driveR.value.duration)} · ${fmtDist(driveR.value.distance)}`,
      costEstimate: 'Own vehicle',
    })
    routes.push({
      id: 'taxi', mode: 'taxi', icon: '🚕', color: 'var(--taxi)',
      label: 'Taxi / Ride-hail',
      duration: driveR.value.duration * 1.15,
      distance: driveR.value.distance,
      geometry: driveR.value.geometry,
      legs: [{ icon: '🚕', color: 'var(--taxi)', label: 'Taxi', duration: driveR.value.duration }],
      summary: `Taxi ${fmtDuration(driveR.value.duration)} · est. ${cost}`,
      costEstimate: cost,
    })
  }

  if (cycleR.status === 'fulfilled' && cycleR.value) {
    routes.push({
      id: 'cycle', mode: 'cycle', icon: '🚴', color: 'var(--cycle)',
      label: 'Cycling',
      duration: cycleR.value.distance / 250 * 60,
      distance: cycleR.value.distance,
      geometry: cycleR.value.geometry,
      legs: [{ icon: '🚴', color: 'var(--cycle)', label: 'Cycle', duration: cycleR.value.duration }],
      summary: `Cycle ${fmtDuration(cycleR.value.distance / 250 * 60)} · ${fmtDist(cycleR.value.distance)}`,
      duration: cycleR.value.distance / 250 * 60,
      costEstimate: 'Free / hire cost',
    })
  }

  // Transit
  const plan = transitR.status === 'fulfilled' ? transitR.value?.plan : null
  if (plan?.itineraries?.length) {
    plan.itineraries.slice(0, 2).forEach((itin, idx) => {
      const legs = (itin.legs || []).map(l => ({
        icon: modeIcon(l.mode), color: modeColor(l.mode),
        label: l.route?.shortName
          ? `${l.mode === 'WALK' ? 'Walk' : l.route.shortName}${l.headsign ? ' → ' + l.headsign : ''}`
          : l.mode === 'WALK' ? 'Walk' : l.mode,
        duration: (l.endTime - l.startTime) / 1000,
        from: l.from?.name, to: l.to?.name,
        departTime: l.startTime ? new Date(l.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null,
      }))
      routes.push({
        id: `transit_${idx}`,
        mode: 'transit', icon: '🚌', color: 'var(--bus)',
        label: idx === 0 ? 'Public Transit' : 'Transit (alt)',
        duration: itin.duration,
        distance: itin.walkDistance || 0,
        geometry: null, legs,
        summary: legs.map(l => `${l.icon} ${l.label}`).join(' → '),
        transfers: itin.transfers || 0,
        costEstimate: 'Fare applies',
        departTime: legs[0]?.departTime,
      })
    })
  } else {
    routes.push({
      id: 'transit', mode: 'transit', icon: '🚌', color: 'var(--bus)',
      label: 'Public Transit', unavailable: true,
      duration: Infinity, summary: 'No transit data for this route',
      legs: [], costEstimate: '—',
    })
  }

  routes.sort((a, b) => {
    if (a.unavailable) return 1
    if (b.unavailable) return -1
    return a.duration - b.duration
  })

  if (routes[0] && !routes[0].unavailable) routes[0].fastest = true
  return routes
}

async function fetchOSRM(profile, from, to) {
  const r = await fetch(`${OSRM}/route/v1/${profile}/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`)
  const d = await r.json()
  if (d.code !== 'Ok') throw new Error('No route')
  return d.routes[0]
}

// ── Helpers ────────────────────────────────────

export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

export function fmtDuration(s) {
  if (!s || s === Infinity) return '—'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m/60)}h ${m%60 ? m%60+'m' : ''}`
}

export function fmtDist(m) {
  if (!m) return '—'
  return m < 1000 ? `${Math.round(m)}m` : `${(m/1000).toFixed(1)}km`
}

export function fmtWalk(m) {
  const mins = Math.round(m / 80) // ~80m/min walking
  return mins < 2 ? 'Here' : `${mins} min walk`
}

export function taxiCost(meters) {
  const miles = meters / 1609.34
  const lo = Math.max(4, Math.floor((2.8 + miles * 2.2) * 0.85))
  const hi = Math.ceil((2.8 + miles * 2.2) * 1.35)
  return `£${lo}–${hi}`
}

export function buildShareUrl(from, to) {
  const p = new URLSearchParams()
  if (from) { p.set('flat', from.lat.toFixed(6)); p.set('flon', from.lon.toFixed(6)); p.set('fname', from.name) }
  if (to)   { p.set('tlat', to.lat.toFixed(6));   p.set('tlon', to.lon.toFixed(6));   p.set('tname', to.name) }
  return `${location.origin}${location.pathname}?${p}`
}

export function parseUrlParams() {
  const p = new URLSearchParams(location.search)
  const from = p.get('flat') ? { lat: +p.get('flat'), lon: +p.get('flon'), name: p.get('fname') || '' } : null
  const to   = p.get('tlat') ? { lat: +p.get('tlat'), lon: +p.get('tlon'), name: p.get('tname') || '' } : null
  return { from, to }
}

function modeIcon(mode) {
  return { WALK:'🚶', BUS:'🚌', RAIL:'🚆', SUBWAY:'🚇', TRAM:'🚋', FERRY:'⛴️', BICYCLE:'🚴' }[mode?.toUpperCase()] || '🚌'
}
function modeColor(mode) {
  return { WALK:'var(--walk)', BUS:'var(--bus)', RAIL:'var(--train)', SUBWAY:'var(--cyan)', TRAM:'var(--coach)', FERRY:'var(--ferry)' }[mode?.toUpperCase()] || 'var(--bus)'
}
