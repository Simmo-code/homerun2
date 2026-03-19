// App.jsx v2 — HOMERUN Scan-First Architecture
import { useState, useEffect, useRef, useCallback } from 'react'
import TopBar        from './components/TopBar'
import LandButton    from './components/LandButton'
import BottomPanel   from './components/BottomPanel'
import DepartureBoard from './components/DepartureBoard'
import GetMeHome from './components/GetMeHome'
import { ToastStack, SharePanel } from './components/Overlays'
import { useMap }    from './hooks/useMap'
import { useLiveBuses } from './hooks/useLiveBuses'
import { useToast }  from './hooks/useToast'
import {
  reverseGeocode, geocodeSearch, deepScan, scanLocalTaxis,
  walkingRoute, computeHomeRoutes, parseUrlParams,
  fmtDist, fmtWalk, haversine,
} from './utils/api'

const EMPTY_SCAN = { bus:[], train:[], tram:[], metro:[], taxi:[], car:[], cycle:[], ferry:[], coach:[], air:[], scooter:[] }

export default function App() {
  const mapRef = useRef(null)

  const [from,              setFrom]             = useState(null)
  const [to,                setTo]               = useState(null)
  const [scanState,         setScanState]        = useState('idle')
  const [noDataStops,       setNoDataStops]      = useState(new Set())
  const scanningRef = useRef(false)
  const [scanResults,       setScanResults]      = useState(EMPTY_SCAN)
  const [localTaxis,        setLocalTaxis]       = useState([])
  const [selectedItem,      setSelectedItem]     = useState(null)
  const [selectedWalk,      setSelectedWalk]     = useState(null)
  const [homeRoutes,        setHomeRoutes]       = useState([])
  const [activeRouteIdx,    setActiveRouteIdx]   = useState(0)
  const [homeRoutesLoading, setHomeRoutesLoading]= useState(false)
  const [showGetHome, setShowGetHome] = useState(false)
  const [showShare,         setShowShare]        = useState(false)
  const [home,              setHome]             = useState(() => {
    try { return JSON.parse(localStorage.getItem('homerun_home') || 'null') } catch { return null }
  })

  const { toasts, showToast } = useToast()
  const {
    mapRef: leafletMapRef,
    setFromMarker, setToMarker,
    drawScanRings, drawTransportMarkers, drawWalkLines,
    drawRoutes, flyTo, flyToBounds, fitItems,
    switchTileLayer, setLongPressCallback, greyMarker } = useMap(mapRef)

  const { buses, count: busCount, lastUpdate, status: busStatus } = useLiveBuses(leafletMapRef, from, scanResults)

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
  useEffect(() => { setToMarker(to) },     [to])

  // ── Redraw routes on active change ────────────
  useEffect(() => { drawRoutes(homeRoutes, activeRouteIdx) }, [homeRoutes, activeRouteIdx])

  // ── Full scan sequence ────────────────────────
  const handleSetFrom = useCallback(async (loc) => {
    if (scanningRef.current) return
    scanningRef.current = true
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
      drawTransportMarkers(scan, handleMarkerClick)
      const walkTargets = [scan.bus[0], scan.train[0], scan.tram[0]].filter(Boolean)
      const walkLines = await Promise.all(
        walkTargets.map(async (t) => {
          const w = await walkingRoute(loc.lat, loc.lon, t.lat, t.lon)
          const colorMap = { bus: '#f59e0b', train: '#00d4ff', tram: '#ec4899' }
          return w ? { geometry: w.geometry, color: colorMap[t.type] || '#fff' } : null
        })
      )
      drawWalkLines(walkLines.filter(Boolean))
      const allItems = Object.values(scan).flat().slice(0, 12)
      if (allItems.length > 0) fitItems([{ lat: loc.lat, lon: loc.lon }, ...allItems])
      const total = Object.values(scan).flat().length + taxis.length
      showToast(`✅ Found ${total} transport options`, 'success')
    } catch {
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

  // ── Long press to set landing location - retry until map ready
  useEffect(() => {
    const apply = () => {
      setLongPressCallback((lat, lon) => {
        handleSetFrom({ lat, lon, name: lat.toFixed(4) + ', ' + lon.toFixed(4) })
        reverseGeocode(lat, lon).then(name => {
          if (name) handleSetFrom({ lat, lon, name })
        }).catch(() => {})
      })
    }
    apply()
    const t = setTimeout(apply, 2000)
    return () => clearTimeout(t)
  }, [setLongPressCallback, handleSetFrom])


  // ── Long press on map to set location ────────
  useEffect(() => {
    const map = leafletMapRef?.current
    if (!map) return
    let pressTimer = null
    const onDown = (e) => {
      pressTimer = setTimeout(async () => {
        const { lat, lng } = e.latlng
        showToast('📍 Setting landing location…')
        try {
          const data = await reverseGeocode(lat, lng)
          const name = data.display_name?.split(',').slice(0,3).join(',').trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
          await handleSetFrom({ lat, lon: lng, name })
        } catch {
          await handleSetFrom({ lat, lon: lng, name: `${lat.toFixed(5)}, ${lng.toFixed(5)}` })
        }
      }, 600)
    }
    const onUp = () => clearTimeout(pressTimer)
    map.on('mousedown', onDown)
    map.on('touchstart', onDown)
    map.on('mouseup mousemove touchend', onUp)
    return () => {
      map.off('mousedown', onDown)
      map.off('touchstart', onDown)
      map.off('mouseup mousemove touchend', onUp)
    }
  }, [leafletMapRef?.current, handleSetFrom, showToast])

  // ── Marker tapped ─────────────────────────────
  const handleMarkerClick = useCallback(async (item) => {
    setSelectedItem(item)
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

  // ── Reset everything ──────────────────────────
  const handleLayerChange = (url) => {
    const map = leafletMapRef.current
    const toRemove = []
    map.eachLayer(l => { if (l._url) toRemove.push(l) })
    toRemove.forEach(l => map.removeLayer(l))
    L.tileLayer(url, { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map)
  }

  const handleRetryScan = useCallback(async () => {
    if (!from) return
    setScanState('scanning')
    setScanResults(EMPTY_SCAN)
    setLocalTaxis([])
    try {
      const [scan, taxis] = await Promise.all([
        scanNearby(from.lat, from.lon),
        scanLocalTaxis(from.lat, from.lon),
      ])
      setScanResults(scan)
      setLocalTaxis(taxis)
      drawTransportMarkers(scan, from)
      drawWalkLines(from, scan.bus[0], scan.train[0])
    } catch {}
    setScanState('done')
  }, [from, drawTransportMarkers, drawWalkLines])

  const handleReset = useCallback(() => {
    setFrom(null)
    setTo(null)
    setScanState('idle')
    setScanResults(EMPTY_SCAN)
    setLocalTaxis([])
    setHomeRoutes([])
    setActiveRouteIdx(0)
    setSelectedItem(null)
    setSelectedWalk(null)
    setFromMarker(null)
    setToMarker(null)
    drawRoutes([], 0)
    showToast('↺ Reset — ready for new search')
  }, [drawRoutes, setFromMarker, setToMarker, showToast])

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

  return (
    <div style={{ width:'100%', height:'100%', position:'relative', overflow:'hidden' }}>

      {/* Map */}
      <div ref={mapRef} style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        bottom: '60px', zIndex: 1,
      }}/>

      {/* Topbar */}
      <TopBar
        from={from}
        scanState={scanState}
        onShare={() => setShowShare(true)}
        onReset={handleReset}
        onRetry={handleRetryScan}
        mapRef={leafletMapRef}
      />

      {/* Land button */}
      <LandButton
        onLand={handleLanded}
        onManualLocation={handleSetFrom}
        hasLocation={!!from}
        scanning={scanState === 'scanning'}
      />

      {/* Bottom panel */}
      <BottomPanel
        noDataStops={noDataStops}
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
        onGetMeHome={(item) => { setGetHomeFrom(item ? { lat: item.lat, lon: item.lon, name: item.label } : null); setShowGetHome(true) }}
        geocodeSearch={geocodeSearch}
        homeRoutesLoading={homeRoutesLoading}
      />

      {/* Departure board */}
      {selectedItem && (
        <DepartureBoard
          item={selectedItem}
          walkInfo={selectedWalk}
          onClose={() => { setSelectedItem(null); setSelectedWalk(null) }}
          onGetMeHome={(item) => {
          setGetHomeFrom(item ? { lat: item.lat, lon: item.lon, name: item.label } : null)
            setSelectedItem(null)
            if (!to) showToast('Enter your destination above to find routes home')
          }}
        />
      )}

      {showGetHome && from && to && (
        <GetMeHome from={getHomeFrom || from} to={to} onClose={() => { setShowGetHome(false); setGetHomeFrom(null) }}/>
      )}

      {/* Share panel */}
      {showShare && (
        <SharePanel from={from} to={to} onClose={() => setShowShare(false)} showToast={showToast}/>
      )}

      <ToastStack toasts={toasts}/>

      <style>{`
        .leaflet-control-zoom { margin-bottom: 100px !important; margin-right: 16px !important; } .leaflet-right { right: 0 !important; }
        .leaflet-control-attribution { margin-bottom: 4px !important; position: fixed !important; bottom: 0 !important; right: 0 !important; }
      `}</style>
    </div>
  )
}