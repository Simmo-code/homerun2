// useLiveBuses.js — Real-time bus positions via UK Bus Open Data Service (BODS)
// Fetches GTFS-RT vehicle positions within radius of a location
// Refreshes every 30 seconds automatically

import { useEffect, useRef, useCallback, useState } from 'react'
import L from 'leaflet'

const BODS_KEY = '9cf4f123d9746c5548bacfdb612969675c732a09'
const BODS_URL = 'https://data.bus-data.dft.gov.uk/api/v1/datafeed/'
const REFRESH_INTERVAL = 30000 // 30 seconds
const RADIUS_MILES = 5
const RADIUS_DEG = RADIUS_MILES / 69 // approx degrees

function busMarkerHTML(route, bearing, delayed) {
  const rotation = bearing || 0
  const color = delayed ? '#ef4444' : '#f59e0b'
  return `
    <div style="
      position: relative;
      width: 28px; height: 28px;
    ">
      <div style="
        position: absolute; top: -6px; left: 50%; transform: translateX(-50%) rotate(${rotation}deg);
        width: 0; height: 0;
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-bottom: 8px solid ${color};
      "></div>
      <div style="
        position: absolute; top: 0; left: 0;
        width: 28px; height: 28px; border-radius: 6px;
        background: ${color};
        border: 2px solid rgba(255,255,255,0.9);
        box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        display: flex; align-items: center; justify-content: center;
        font-family: 'Barlow Condensed', sans-serif;
        font-size: ${route && route.length <= 3 ? '11px' : '9px'};
        font-weight: 800; color: #000;
        overflow: hidden;
      ">${route || '🚌'}</div>
    </div>
  `
}

export function useLiveBuses(mapRef, from, enabled = true) {
  const [buses, setBuses]       = useState([])
  const [loading, setLoading]   = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [error, setError]       = useState(null)
  const markersRef              = useRef([])
  const intervalRef             = useRef(null)
  const mountedRef              = useRef(true)

  const clearMarkers = useCallback(() => {
    const map = mapRef?.current
    if (!map) return
    markersRef.current.forEach(m => {
      try { map.removeLayer(m) } catch {}
    })
    markersRef.current = []
  }, [mapRef])

  const drawBusMarkers = useCallback((busList) => {
    const map = mapRef?.current
    if (!map) return
    clearMarkers()

    busList.forEach(bus => {
      if (!bus.lat || !bus.lon) return
      const icon = L.divIcon({
        html: busMarkerHTML(bus.route, bus.bearing, bus.delayed),
        className: '',
        iconSize: [28, 36],
        iconAnchor: [14, 14],
      })
      const marker = L.marker([bus.lat, bus.lon], { icon, zIndexOffset: 200 })
        .addTo(map)
        .bindPopup(`
          <div style="padding:10px 12px;font-family:'Barlow Condensed',sans-serif;">
            <div style="font-size:16px;font-weight:800;margin-bottom:4px;">
              🚌 ${bus.route || 'Bus'} ${bus.destination ? '→ ' + bus.destination : ''}
            </div>
            <div style="font-size:11px;color:#647d99;font-family:'JetBrains Mono',monospace;">
              ${bus.operator || ''}<br/>
              ${bus.delayed ? '⚠️ Delayed' : '✅ On time'}<br/>
              Speed: ${bus.speed ? Math.round(bus.speed) + ' mph' : '—'}<br/>
              Updated: ${new Date().toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'})}
            </div>
          </div>
        `)
      markersRef.current.push(marker)
    })
  }, [mapRef, clearMarkers])

  const fetchBuses = useCallback(async () => {
    if (!from || !enabled) return
    setLoading(true)
    setError(null)

    try {
      // BODS GTFS-RT vehicle positions endpoint
      // Filter by bounding box around current location
      const latMin = (from.lat - RADIUS_DEG).toFixed(6)
      const latMax = (from.lat + RADIUS_DEG).toFixed(6)
      const lonMin = (from.lon - RADIUS_DEG).toFixed(6)
      const lonMax = (from.lon + RADIUS_DEG).toFixed(6)

      const url = `${BODS_URL}?api_key=${BODS_KEY}&status=live&boundingBox=${lonMin},${latMin},${lonMax},${latMax}&limit=100`

      const res = await fetch(url)
      if (!res.ok) throw new Error(`BODS error: ${res.status}`)

      const text = await res.text()

      // BODS returns JSON with vehicle activity
      let data
      try {
        data = JSON.parse(text)
      } catch {
        // Sometimes returns XML-wrapped — try to parse what we can
        setError('Unexpected data format')
        setLoading(false)
        return
      }

      if (!mountedRef.current) return

      // Parse SIRI VM (Vehicle Monitoring) response
      const activities = data?.Siri?.ServiceDelivery?.VehicleMonitoringDelivery?.[0]?.VehicleActivity || []

      const parsed = activities
        .map(activity => {
          const journey = activity?.MonitoredVehicleJourney
          if (!journey) return null
          const loc = journey?.VehicleLocation
          if (!loc?.Latitude || !loc?.Longitude) return null

          const lat = parseFloat(loc.Latitude)
          const lon = parseFloat(loc.Longitude)

          // Filter to radius
          const distLat = Math.abs(lat - from.lat)
          const distLon = Math.abs(lon - from.lon)
          if (distLat > RADIUS_DEG || distLon > RADIUS_DEG) return null

          return {
            id: journey?.VehicleRef || Math.random().toString(),
            lat,
            lon,
            route: journey?.PublishedLineName || journey?.LineRef || '',
            destination: journey?.DestinationName || '',
            operator: journey?.OperatorRef || '',
            bearing: parseFloat(journey?.Bearing) || 0,
            speed: parseFloat(journey?.Velocity) || 0,
            delayed: journey?.Delay ? parseFloat(journey.Delay) > 60 : false,
            occupancy: journey?.OccupancyData?.OccupancyAvailable || null,
          }
        })
        .filter(Boolean)

      setBuses(parsed)
      drawBusMarkers(parsed)
      setLastUpdate(new Date())

    } catch (err) {
      if (mountedRef.current) {
        setError(err.message)
        console.warn('BODS fetch failed:', err)
      }
    }

    if (mountedRef.current) setLoading(false)
  }, [from, enabled, drawBusMarkers])

  // Start/stop auto-refresh
  useEffect(() => {
    if (!from || !enabled) {
      clearMarkers()
      setBuses([])
      return
    }

    fetchBuses()
    intervalRef.current = setInterval(fetchBuses, REFRESH_INTERVAL)

    return () => {
      clearInterval(intervalRef.current)
    }
  }, [from?.lat, from?.lon, enabled, fetchBuses])

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearInterval(intervalRef.current)
      clearMarkers()
    }
  }, [])

  return { buses, loading, lastUpdate, error, refresh: fetchBuses }
}