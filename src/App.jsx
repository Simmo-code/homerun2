// App.jsx v2 — HOMERUN Scan-First Architecture
// Scans ALL transport on landing, shows live departure boards
import { useState, useEffect, useRef, useCallback } from 'react'
import TopBar        from './components/TopBar'
import LandButton    from './components/LandButton'
import BottomPanel   from './components/BottomPanel'
import DepartureBoard from './components/DepartureBoard'
import { ToastStack, SharePanel } from './components/Overlays'
import { useMap }    from './hooks/useMap'
import { useToast }  from './hooks/useToast'
import {
  reverseGeocode, geocodeSearch, deepScan, scanLocalTaxis,
  walkingRoute, computeHomeRoutes, parseUrlParams,
  fmtDist, fmtWalk, haversine,
} from './utils/api'

const EMPTY_SCAN = { bus:[], train:[], tram:[], metro:[], taxi:[], car:[], cycle:[], ferry:[], coach:[], air:[], scooter:[] }

export default function App() {
  const mapRef = useRef(null)

  // ── Core state ─────────────────────────────────
  const [from,           setFrom]           = useState(null)
  const [to,             setTo]             = useState(null)
  const [scanState,      setScanState]      = useState('idle')   // idle | scanning | done
  const [scanResults,    setScanResults]    = useState(EMPTY_SCAN)
  const [localTaxis,     setLocalTaxis]     = useState([])
  const [selectedItem,   setSelectedItem]   = useState(null)     // tapped marker
  const [selectedWalk,   setSelectedWalk]   = useState(null)     // walk info to selected
  const [homeRoutes,     setHomeRoutes]     = useState([])
  const [activeRouteIdx, setActiveRouteIdx] = useState(0)
  const [homeRoutesLoading, setHomeRoutesLoading] = useState(false)
  const [showShare,      setShowShare]      = useState(false)
  const [sidebarOpen,    setSidebarOpen]    = useState(false)    // reserved for future sidebar
  const [home,           setHome]           = useState(() => {
    try { return JSON.parse(localStorage.getItem('homerun_home') || 'null') } catch { return null }
  })

  const { toasts, showToast } = useToast()
  const {
    setFromMarker, setToMarker,
    drawScanRings, drawTransportMarkers, drawWalkLines,
    drawRoutes, flyTo, flyToBounds, fitItems,
  } = useMap(mapRef)

  // ── Parse URL on load ─────────────────────────
  useEffect(() => {
    const { from: urlFrom, to: urlTo } = parseUrlParams()
    if (urlFrom) handleSetFrom(urlFrom)
    if (urlTo)   setTo(urlTo)
  }, [])

  // ── Load home destination ─────────────────────
  useEffect(() => {
    if (home && !to) setTo(home)
  }, [])

  // ── Sync markers ──────────────────────────────
  useEffect(() => { setFromMarker(from) }, [from])
  useEffect(() => { setToMarker(to) },   [to])

  // ── Redraw routes on active change ────────────
  useEffect(() => { drawRoutes(homeRoutes, activeRouteIdx) }, [homeRoutes, activeRouteIdx])

  // ── Full scan sequence ────────────────────────
  const handleSetFrom = useCallback(async (loc) => {
    setFrom(loc)
    setFromMarker(loc)
    flyTo(loc.lat, loc.lon, 14)
    drawScanRings(loc.lat, loc.lon)
    setScanState('scanning')
    setScanResults(EMPTY_SCAN)
    setLocalTaxis([])

    showToast('📡 Scanning all transport networks…')

    try {
      const [scan, taxis] = await Promise.all([
        deepScan(loc.lat, loc.lon),
        scanLocalTaxis(loc.lat, loc.lon),
      ])

      setScanResults(scan)
      setLocalTaxis(taxis)
      setScanState('done')

      // Draw all markers on map
      drawTransportMarkers(scan, handleMarkerClick)

      // Draw walk lines to nearest bus + train
      const walkTargets = [
        scan.bus[0], scan.train[0], scan.tram[0],
      ].filter(Boolean)

      const walkLines = await Promise.all(
        walkTargets.map(async (t) => {
          const w = await walkingRoute(loc.lat, loc.lon, t.lat, t.lon)
          const colorMap = { bus: '#f59e0b', train: '#00d4ff', tram: '#ec4899' }
          return w ? { geometry: w.geometry, color: colorMap[t.type] || '#fff' } : null
        })
      )
      drawWalkLines(walkLines.filter(Boolean))

      // Fit map to show from + all found stops
      const allItems = Object.values(scan).flat().slice(0, 12)
      if (allItems.length > 0) {
        fitItems([{ lat: loc.lat, lon: loc.lon }, ...allItems])
      }

      const total = Object.values(scan).flat().length + taxis.length
      showToast(`✅ Found ${total} transport options`, 'success')
    } catch (err) {
      setScanState('done')
      showToast('⚠️ Scan partial — check connection', 'warn')
    }
  }, [drawScanRings, drawTransportMarkers, drawWalkLines, fitItems, flyTo, showToast])

  // ── GPS landing ───────────────────────────────
  const handleLanded = useCallback(() => {
    if (!navigator.geolocation) { showToast('❌ GPS not available', 'error'); return }
    showToast('📡 Acquiring GPS…')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords
        try {
          const data = await reverseGeocode(lat, lon)
          const name = data.display_name?.split(',').slice(0,3).join(',').trim() || `${lat.toFixed(5)}, ${lon.toFixed(5)}`
          await handleSetFrom({ lat, lon, name })
        } catch {
          await handleSetFrom({ lat, lon, name: `${lat.toFixed(5)}, ${lon.toFixed(5)}` })
        }
      },
      (err) => {
        const msgs = { 1: '❌ GPS permission denied', 2: '❌ Location unavailable', 3: '❌ GPS timed out' }
        showToast(msgs[err.code] || '❌ GPS error', 'error')
      },
      { enableHighAccuracy: true, timeout: 14000, maximumAge: 0 }
    )
  }, [handleSetFrom, showToast])

  // ── Marker tapped → departure board ──────────
  const handleMarkerClick = useCallback(async (item) => {
    setSelectedItem(item)
    // Compute walk info
    if (from && item.lat && item.lon) {
      const walk = await walkingRoute(from.lat, from.lon, item.lat, item.lon)
      setSelectedWalk(walk)
    }
    flyTo(item.lat, item.lon, 16)
  }, [from, flyTo])

  // ── Compute home routes ───────────────────────
  const handleComputeHome = useCallback(async () => {
    if (!from || !to) return
    setHomeRoutesLoading(true)
    setHomeRoutes([])
    showToast('🔍 Computing best routes home…')
    try {
      const routes = await computeHomeRoutes(from, to, scanResults)
      setHomeRoutes(routes)
      setActiveRouteIdx(0)
      drawRoutes(routes, 0)
      flyToBounds(from, to)
      showToast(`✅ ${routes.filter(r=>!r.unavailable).length} routes found`, 'success')
    } catch {
      showToast('⚠️ Route calculation failed', 'error')
    }
    setHomeRoutesLoading(false)
  }, [from, to, scanResults, drawRoutes, flyToBounds, showToast])

  // ── Save home ─────────────────────────────────
  const handleSaveHome = useCallback(() => {
    if (!to) return
    localStorage.setItem('homerun_home', JSON.stringify(to))
    setHome(to)
    showToast('🏠 Home saved', 'success')
  }, [to, showToast])

  // ── Keyboard ──────────────────────────────────
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') { setSelectedItem(null); setShowShare(false) } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // ── Map height adjusts with panel ────────────
  const mapBottom = 'var(--panel-h)'

  return (
    <div style={{ width:'100%', height:'100%', position:'relative', overflow:'hidden' }}>

      {/* ── Map ── */}
      <div
        ref={mapRef}
        style={{
          position: 'fixed',
          top: '44px', left: 0, right: 0,
          bottom: mapBottom,
          zIndex: 1,
          transition: 'bottom 0.3s var(--ease)',
        }}
      />

      {/* ── Topbar ── */}
      <TopBar
        from={from}
        scanState={scanState}
        onShare={() => setShowShare(true)}
        onSidebarToggle={() => setSidebarOpen(o => !o)}
      />

<LandButton
  onLand={handleLanded}
  onManualLocation={handleSetFrom}
  hasLocation={!!from}
  scanning={scanState === 'scanning'}
/>

      {/* ── Bottom panel ── */}
      <BottomPanel
        from={from}
        scanResults={scanResults}
        localTaxis={localTaxis}
        scanState={scanState}
        homeRoutes={homeRoutes}
        activeRouteIdx={activeRouteIdx}
        onRouteSelect={(i) => { setActiveRouteIdx(i); drawRoutes(homeRoutes, i) }}
        to={to}
        onToChange={setTo}
        onToClear={() => { setTo(null); setHomeRoutes([]) }}
        onComputeHome={handleComputeHome}
        onMarkerClick={handleMarkerClick}
        geocodeSearch={geocodeSearch}
        homeRoutesLoading={homeRoutesLoading}
      />

      {/* ── Departure board (tapped marker) ── */}
      {selectedItem && (
        <DepartureBoard
          item={selectedItem}
          walkInfo={selectedWalk}
          onClose={() => { setSelectedItem(null); setSelectedWalk(null) }}
          onGetMeHome={(item) => {
            setSelectedItem(null)
            // Pre-fill to field if not set, then prompt
            if (!to) showToast('Enter your destination to get routes home')
          }}
        />
      )}

      {/* ── Share panel ── */}
      {showShare && (
        <SharePanel
          from={from} to={to}
          onClose={() => setShowShare(false)}
          showToast={showToast}
        />
      )}

      {/* ── Toasts ── */}
      <ToastStack toasts={toasts}/>

      {/* Leaflet attribution offset */}
      <style>{`
        .leaflet-control-zoom { margin-bottom: calc(var(--panel-h) + 10px) !important; margin-right: 12px !important; }
        .leaflet-control-attribution { margin-bottom: var(--panel-h) !important; }
      `}</style>
    </div>
  )
}