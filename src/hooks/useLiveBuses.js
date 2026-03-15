// useLiveBuses.js — Live bus positions
// Uses TfL API for London (free, no key needed)
// Falls back to departure-based positions elsewhere

import { useEffect, useRef, useCallback, useState } from 'react'
import L from 'leaflet'

const TFL_BASE = 'https://api.tfl.gov.uk'
const REFRESH_MS = 30000

// Is this location within Greater London?
function isInLondon(lat, lon) {
  return lat > 51.28 && lat < 51.70 && lon > -0.52 && lon < 0.35
}

function busMarkerHTML(line, bearing, delay) {
  const deg = bearing || 0
  const color = delay > 60 ? '#ef4444' : delay > 0 ? '#f59e0b' : '#22c55e'
  const short = (line || '🚌').slice(0, 4)
  return `
    <div style="position:relative;width:30px;height:38px;display:flex;flex-direction:column;align-items:center;">
      <div style="
        width:0;height:0;
        border-left:5px solid transparent;
        border-right:5px solid transparent;
        border-bottom:9px solid ${color};
        transform:rotate(${deg}deg);
        transform-origin:center bottom;
        margin-bottom:1px;
        filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));
      "></div>
      <div style="
        width:30px;height:26px;border-radius:6px;
        background:${color};
        border:2px solid rgba(255,255,255,0.9);
        box-shadow:0 2px 8px rgba(0,0,0,0.5);
        display:flex;align-items:center;justify-content:center;
        font-family:'Barlow Condensed',sans-serif;
        font-size:${short.length <= 2 ? '12px' : '9px'};
        font-weight:900;color:#000;
        line-height:1;
      ">${short}</div>
    </div>
  `
}

export function useLiveBuses(mapRef, from, scanResults) {
  const [buses,      setBuses]      = useState([])
  const [count,      setCount]      = useState(0)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [status,     setStatus]     = useState('idle') // idle | loading | live | unavailable
  const markersRef  = useRef([])
  const intervalRef = useRef(null)
  const mountedRef  = useRef(true)

  const clearMarkers = useCallback(() => {
    const map = mapRef?.current
    if (!map) return
    markersRef.current.forEach(m => { try { map.removeLayer(m) } catch {} })
    markersRef.current = []
  }, [mapRef])

  const drawMarkers = useCallback((busList) => {
    const map = mapRef?.current
    if (!map) return
    clearMarkers()
    busList.forEach(bus => {
      if (!bus.lat || !bus.lon) return
      const icon = L.divIcon({
        html: busMarkerHTML(bus.line, bus.bearing, bus.delay),
        className: '', iconSize: [30, 38], iconAnchor: [15, 38],
      })
      const m = L.marker([bus.lat, bus.lon], { icon, zIndexOffset: 300 }).addTo(map)
      m.bindPopup(`
        <div style="padding:10px 12px;font-family:'Barlow Condensed',sans-serif;min-width:180px;">
          <div style="font-size:18px;font-weight:800;margin-bottom:6px;">
            🚌 ${bus.line} <span style="font-size:13px;font-weight:600;color:#647d99;">→ ${bus.destination || '?'}</span>
          </div>
          <div style="font-size:12px;color:#647d99;font-family:'JetBrains Mono',monospace;line-height:1.8;">
            ${bus.currentLocation ? '📍 ' + bus.currentLocation + '<br/>' : ''}
            ${bus.timeToStop ? '⏱ ' + Math.round(bus.timeToStop / 60) + ' min to next stop<br/>' : ''}
            ${bus.delay > 60 ? '⚠️ ' + Math.round(bus.delay/60) + ' min late' : bus.delay <= 0 ? '✅ On time' : '🟡 Slight delay'}<br/>
            🕐 ${new Date().toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'})}
          </div>
        </div>
      `)
      markersRef.current.push(m)
    })
  }, [mapRef, clearMarkers])

  // ── TfL fetch (London only) ──────────────────
  const fetchTfL = useCallback(async (lat, lon) => {
    setStatus('loading')

    // Get nearby bus stops from scan results
    const busStops = scanResults?.bus?.slice(0, 8) || []
    if (busStops.length === 0) {
      setStatus('unavailable')
      return
    }

    // Get unique route numbers from nearby stops
    const routes = [...new Set(
      busStops.flatMap(s => (s.routes || '').split(';').map(r => r.trim()).filter(Boolean))
    )].slice(0, 10)

    if (routes.length === 0) {
      setStatus('unavailable')
      return
    }

    try {
      // Fetch arrivals for each route — TfL returns vehicle positions
      const results = await Promise.allSettled(
        routes.map(r => fetch(`${TFL_BASE}/Line/${encodeURIComponent(r)}/Arrivals`).then(res => res.json()))
      )

      if (!mountedRef.current) return

      const allArrivals = results
        .filter(r => r.status === 'fulfilled' && Array.isArray(r.value))
        .flatMap(r => r.value)

      // Deduplicate by vehicleId, keep most recent
      const byVehicle = {}
      allArrivals.forEach(a => {
        if (!a.vehicleId) return
        if (!byVehicle[a.vehicleId] || a.timeToStation < byVehicle[a.vehicleId].timeToStation) {
          byVehicle[a.vehicleId] = a
        }
      })

      // Convert to our bus format
      // TfL doesn't give exact vehicle lat/lon — we use stop position + bearing to estimate
      const stopMap = {}
      busStops.forEach(s => { if (s.name) stopMap[s.name.toLowerCase()] = s })

      const parsed = Object.values(byVehicle)
        .map(a => {
          // Find the stop this bus is heading to
          const stop = busStops.find(s =>
            s.name && a.stationName && s.name.toLowerCase().includes(a.stationName.toLowerCase().slice(0,6))
          ) || busStops[0]

          if (!stop) return null

          // Estimate position: bus is between current location and stop
          // timeToStation is in seconds — average bus speed ~20km/h = 5.5m/s
          const distFromStop = (a.timeToStation || 60) * 5.5 // meters
          const totalDist = Math.sqrt(
            Math.pow((stop.lat - lat) * 111000, 2) +
            Math.pow((stop.lon - lon) * 111000 * Math.cos(lat * Math.PI/180), 2)
          )
          const ratio = Math.min(0.95, distFromStop / Math.max(totalDist, 100))
          const busLat = stop.lat - (stop.lat - lat) * ratio
          const busLon = stop.lon - (stop.lon - lon) * ratio

          return {
            id: a.vehicleId,
            lat: busLat,
            lon: busLon,
            line: a.lineName || a.lineId,
            destination: a.destinationName,
            currentLocation: a.currentLocation,
            timeToStop: a.timeToStation,
            bearing: parseFloat(a.bearing) || 0,
            delay: a.timing?.countdownServerAdjustment
              ? -parseInt(a.timing.countdownServerAdjustment) : 0,
          }
        })
        .filter(Boolean)
        .slice(0, 50)

      if (mountedRef.current) {
        setBuses(parsed)
        setCount(parsed.length)
        drawMarkers(parsed)
        setLastUpdate(new Date())
        setStatus(parsed.length > 0 ? 'live' : 'unavailable')
      }
    } catch (err) {
      console.warn('TfL fetch error:', err)
      if (mountedRef.current) setStatus('unavailable')
    }
  }, [scanResults, drawMarkers])

  // ── Main effect ──────────────────────────────
  useEffect(() => {
    if (!from) {
      clearMarkers()
      setBuses([])
      setCount(0)
      setStatus('idle')
      return
    }

    if (!isInLondon(from.lat, from.lon)) {
      setStatus('unavailable')
      // Outside London — show info message but don't crash
      console.info('Live bus tracking: TfL only available in London. BODS integration pending.')
      return
    }

    fetchTfL(from.lat, from.lon)
    intervalRef.current = setInterval(() => fetchTfL(from.lat, from.lon), REFRESH_MS)

    return () => clearInterval(intervalRef.current)
  }, [from?.lat, from?.lon, fetchTfL])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearInterval(intervalRef.current)
      clearMarkers()
    }
  }, [])

  return { buses, count, lastUpdate, status }
}