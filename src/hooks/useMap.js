// useMap v2 — Leaflet with scan rings + all transport layers
import { useEffect, useRef, useCallback } from 'react'
import L from 'leaflet'

const TILES = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
const ATTRIB = '© <a href="https://openstreetmap.org">OSM</a> © <a href="https://carto.com">CartoDB</a>'

// Transport marker config
const MARKER_CFG = {
  bus:        { color: '#f59e0b', size: 14, shape: 'circle', emoji: '🚌' },
  bus_station:{ color: '#f59e0b', size: 20, shape: 'circle', emoji: '🚌' },
  train:      { color: '#00d4ff', size: 22, shape: 'diamond', emoji: '🚆' },
  heritage:   { color: '#f97316', size: 22, shape: 'diamond', emoji: '🚂' },
  tram:       { color: '#ec4899', size: 16, shape: 'diamond', emoji: '🚋' },
  metro:      { color: '#00e5ff', size: 18, shape: 'diamond', emoji: '🚇' },
  taxi:       { color: '#ff6b35', size: 14, shape: 'circle', emoji: '🚕' },
  car_rental: { color: '#94a3b8', size: 14, shape: 'circle', emoji: '🚗' },
  car_share:  { color: '#94a3b8', size: 14, shape: 'circle', emoji: '🔑' },
  cycle:      { color: '#8b5cf6', size: 14, shape: 'circle', emoji: '🚲' },
  scooter:    { color: '#10b981', size: 14, shape: 'circle', emoji: '🛴' },
  ferry:      { color: '#06b6d4', size: 18, shape: 'diamond', emoji: '⛴️' },
  coach:      { color: '#ec4899', size: 16, shape: 'circle', emoji: '🚌' },
  airport:    { color: '#f8fafc', size: 22, shape: 'diamond', emoji: '✈️' },
  helipad:    { color: '#f8fafc', size: 16, shape: 'circle', emoji: '🚁' },
}

function markerHTML(type, isNearest = false) {
  const cfg = MARKER_CFG[type] || MARKER_CFG.bus
  const pulse = isNearest ? `<div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid ${cfg.color};opacity:0.5;animation:pulseRing 1.8s ease-out infinite;"></div>` : ''
  const icons = {
    bus: '🚌', bus_station: '🚌', train: '🚆', tram: '🚋',
    metro: '🚇', taxi: '🚕', car_rental: '🚗', car_share: '🔑',
    cycle: '🚲', scooter: '🛴', ferry: '⛴️', coach: '🚌',
    airport: '✈️', helipad: '🚁'
  }
  const emoji = icons[type] || '📍'
  const size = isNearest ? 32 : 26
  return `<div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">
    ${pulse}
    <div style="
      width:${size}px;height:${size}px;border-radius:8px;
      background:${cfg.color}22;
      border:2px solid ${cfg.color}88;
      display:flex;align-items:center;justify-content:center;
      font-size:${isNearest?18:14}px;
      box-shadow:0 2px 8px rgba(0,0,0,0.4);
      backdrop-filter:blur(4px);
    ">${emoji}</div>
  </div>`
}

function locationHTML(color, glow) {
  return `
    <div style="position:relative;width:22px;height:22px">
      <div style="
        position:absolute;inset:0;border-radius:50%;
        border:2px solid ${color};
        animation:pulseRing 2s ease-out infinite;
        opacity:0.6;
      "></div>
      <div style="
        position:absolute;inset:3px;border-radius:50%;
        background:${color};border:2.5px solid #fff;
        box-shadow:0 0 ${glow?'16px '+color:'6px rgba(0,0,0,0.5)'};
      "></div>
    </div>`
}

export function useMap(containerRef) {
  const mapRef    = useRef(null)
  const layersRef = useRef({
    from: null, to: null, home: null,
    transport: [], routes: [], rings: [],
    walkLines: [],
  })

  // Init map
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return
    const map = L.map(containerRef.current, {
      center: [54, -2], zoom: 6,
      zoomControl: false, preferCanvas: true,
    })
    L.tileLayer(TILES, { attribution: ATTRIB, subdomains: 'abcd', maxZoom: 20 }).addTo(map)
    L.control.zoom({ position: 'bottomright' }).addTo(map)

    // Long press to drop pin — works on both desktop and mobile
    let pressTimer = null
    let pressLatLng = null

    map.on('mousedown', (e) => {
      pressLatLng = e.latlng
      pressTimer = setTimeout(() => {
        if (pressLatLng && map._longPressCallback)
          map._longPressCallback(pressLatLng.lat, pressLatLng.lng)
      }, 600)
    })

    // Mobile touch support
    let touchMoved = false
    map.getContainer().addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return
      touchMoved = false
      const touch = e.touches[0]
      const rect = map.getContainer().getBoundingClientRect()
      pressLatLng = map.containerPointToLatLng(
        L.point(touch.clientX - rect.left, touch.clientY - rect.top)
      )
      pressTimer = setTimeout(() => {
        if (!touchMoved && pressLatLng) {
          if (navigator.vibrate) navigator.vibrate(50)
          if (map._longPressCallback) {
            map._longPressCallback(pressLatLng.lat, pressLatLng.lng)
          }
        }
      }, 800)
    }, { passive: false })

    map.getContainer().addEventListener('touchmove', (e) => {
      touchMoved = true
      clearTimeout(pressTimer)
    }, { passive: true })

    map.getContainer().addEventListener('touchend', () => {
      clearTimeout(pressTimer)
    }, { passive: true })

    map.on('mouseup mousemove', () => clearTimeout(pressTimer))

    // Tap map to show drop pin option (works on mobile)
    // Only show popup, do NOT trigger scan until user confirms
    map.on('click', (e) => {
      if (!map._longPressCallback) return
      // Dont fire if click came from a marker or popup
      if (e.originalEvent._fromMarker) return
      const { lat, lng } = e.latlng
      // Close any existing popup first
      map.closePopup()
      const popupId = 'drop-pin-' + Date.now()
      const popup = L.popup({ closeButton: true, className: 'drop-pin-popup', autoClose: true })
        .setLatLng([lat, lng])
        .setContent(`
          <div style="text-align:center;padding:4px 0;min-width:160px">
            <div style="font-size:11px;color:#647d99;margin-bottom:8px;font-family:monospace">
              ${lat.toFixed(4)}, ${lng.toFixed(4)}
            </div>
            <button id="${popupId}" style="
              background:#00e5ff;color:#000;border:none;border-radius:8px;
              padding:10px 20px;font-weight:800;font-size:14px;cursor:pointer;
              font-family:sans-serif;width:100%;touch-action:manipulation
            ">📍 I Landed Here</button>
          </div>
        `)
      popup.openOn(map)

      setTimeout(() => {
        const btn = document.getElementById(popupId)
        if (btn) {
          btn.addEventListener('click', (ev) => {
            ev.stopPropagation()
            map.closePopup()
            map._longPressCallback(lat, lng)
          })
          btn.addEventListener('touchend', (ev) => {
            ev.preventDefault()
            ev.stopPropagation()
            map.closePopup()
            map._longPressCallback(lat, lng)
          })
        }
      }, 150)
    })

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // FROM marker (you are here)
  const setFromMarker = useCallback((loc) => {
    const map = mapRef.current; if (!map) return
    const L2 = layersRef.current
    if (L2.from) { map.removeLayer(L2.from); L2.from = null }
    if (!loc) return
    const icon = L.divIcon({ html: locationHTML('#00e5ff', true), className: '', iconSize: [22,22], iconAnchor: [11,11] })
    L2.from = L.marker([loc.lat, loc.lon], { icon, zIndexOffset: 500 })
      .addTo(map)
      .bindPopup(`<div style="padding:10px 12px"><div style="font-size:10px;color:#647d99;letter-spacing:1px;margin-bottom:4px">YOU ARE HERE</div><div style="font-size:14px;font-weight:700">${loc.name}</div><div style="font-size:10px;color:#647d99;font-family:'JetBrains Mono',monospace;margin-top:3px">${loc.lat.toFixed(5)}, ${loc.lon.toFixed(5)}</div></div>`)
  }, [])

  // TO marker (destination)
  const setToMarker = useCallback((loc) => {
    const map = mapRef.current; if (!map) return
    const L2 = layersRef.current
    if (L2.to) { map.removeLayer(L2.to); L2.to = null }
    if (!loc) return
    const icon = L.divIcon({ html: locationHTML('#fbbf24', false), className: '', iconSize: [22,22], iconAnchor: [11,11] })
    L2.to = L.marker([loc.lat, loc.lon], { icon, zIndexOffset: 490 })
      .addTo(map)
      .bindPopup(`<div style="padding:10px 12px"><div style="font-size:10px;color:#647d99;letter-spacing:1px;margin-bottom:4px">DESTINATION</div><div style="font-size:14px;font-weight:700">${loc.name}</div></div>`)
  }, [])

  // Scan rings
  const drawScanRings = useCallback((lat, lon) => {
    const map = mapRef.current; if (!map) return
    const L2 = layersRef.current
    L2.rings.forEach(r => map.removeLayer(r)); L2.rings = []
    const ringCfg = [
      { r: 1600,  color: '#00e5ff', opacity: 0.08, label: '1mi' },
      { r: 8000,  color: '#fbbf24', opacity: 0.05, label: '5mi'  },
      { r: 32000, color: '#ff6b35', opacity: 0.03, label: '20mi' },
    ]
    ringCfg.forEach(cfg => {
      const circle = L.circle([lat, lon], {
        radius: cfg.r, color: cfg.color, fillColor: cfg.color,
        fillOpacity: cfg.opacity, weight: 1, opacity: 0.25, dashArray: '4 4',
        interactive: false,
      }).addTo(map)
      L2.rings.push(circle)
    })
  }, [])

  // Draw all transport markers
  const drawTransportMarkers = useCallback((scanResults, onMarkerClick) => {
    const map = mapRef.current; if (!map) return
    const L2 = layersRef.current
    L2.transport.forEach(l => map.removeLayer(l)); L2.transport = []

    const allItems = Object.values(scanResults).flat()
    // Find nearest of each major type
    const nearestBus   = scanResults.bus?.[0]?.id
    const nearestTrain = scanResults.train?.[0]?.id

    allItems.forEach(item => {
      if (!item.lat || !item.lon) return
      const isNearest = item.id === nearestBus || item.id === nearestTrain
      const icon = L.divIcon({
        html: markerHTML(item.type, isNearest),
        className: '', iconSize: [24, 24], iconAnchor: [12, 12],
      })
      const marker = L.marker([item.lat, item.lon], {
        icon, zIndexOffset: isNearest ? 100 : 10,
      }).addTo(map)

      marker.on('click', () => onMarkerClick(item))
      L2.transport.push(marker)
    })
  }, [])

  // Draw walk lines to nearest stops
  const drawWalkLines = useCallback((lines) => {
    const map = mapRef.current; if (!map) return
    const L2 = layersRef.current
    L2.walkLines.forEach(l => map.removeLayer(l)); L2.walkLines = []
    lines.forEach(({ geometry, color }) => {
      if (!geometry) return
      const layer = L.geoJSON(geometry, {
        style: { color, weight: 2, opacity: 0.5, dashArray: '6 5' }
      }).addTo(map)
      L2.walkLines.push(layer)
    })
  }, [])

  // Draw home routes
  const drawRoutes = useCallback((routes, activeIdx) => {
    const map = mapRef.current; if (!map) return
    const L2 = layersRef.current
    L2.routes.forEach(l => map.removeLayer(l)); L2.routes = []
    const modeStyle = {
      walk:    { dashArray: '7 7', weight: 3 },
      cycle:   { dashArray: '5 5', weight: 3 },
      drive:   { dashArray: null, weight: 4 },
      taxi:    { dashArray: '10 4', weight: 4 },
      transit: { dashArray: null, weight: 5 },
    }
    routes.forEach((route, i) => {
      if (!route.geometry) return
      const isActive = i === activeIdx
      const st = modeStyle[route.mode] || modeStyle.drive
      L.geoJSON(route.geometry, {
        style: {
          color: route.color.replace('var(--', '').replace(')', ''),
          weight: isActive ? st.weight + 2 : st.weight,
          dashArray: st.dashArray,
          opacity: isActive ? 1 : 0.2,
        }
      }).addTo(map)
    })
  }, [])

  const switchTileLayer = useCallback((url) => {
    const map = mapRef.current
    const toRemove = []
    map.eachLayer(l => { if (l._url) toRemove.push(l) })
    toRemove.forEach(l => map.removeLayer(l))
    L.tileLayer(url, { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map)
  }, [])

  const setLongPressCallback = useCallback((fn) => {
    if (mapRef.current) mapRef.current._longPressCallback = fn
  }, [])

  const flyTo = useCallback((lat, lon, zoom = 15) => {
    mapRef.current?.flyTo([lat, lon], zoom, { duration: 1 })
  }, [])

  const flyToBounds = useCallback((from, to) => {
    if (!mapRef.current || !from || !to) return
    mapRef.current.flyToBounds([[from.lat, from.lon],[to.lat,to.lon]], { padding:[80,80], duration:1.3 })
  }, [])

  const fitItems = useCallback((items) => {
    if (!mapRef.current || !items.length) return
    const bounds = L.latLngBounds(items.map(i => [i.lat, i.lon]))
    mapRef.current.flyToBounds(bounds, { padding: [60, 60], duration: 1.2, maxZoom: 15 })
  }, [])

  return { mapRef, setFromMarker, setToMarker, drawScanRings, drawTransportMarkers, drawWalkLines, drawRoutes, flyTo, flyToBounds, fitItems, switchTileLayer, setLongPressCallback }
}
