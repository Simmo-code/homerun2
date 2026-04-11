// TopBar v4 — collapsible top-left corner menu with map layers
import { useState, useCallback, useRef } from 'react'

const TILE_LAYERS = {
  street:    { name: 'Street',    emoji: '🗺️', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' },
  satellite: { name: 'Satellite', emoji: '🛰️', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
  dark:      { name: 'Dark',      emoji: '🌑', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' },
  topo:      { name: 'Topo',      emoji: '⛰️', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png' },
}

const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

// Haversine distance in metres
function haversineDist(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function fmtNearbyDist(m) {
  if (m < 1000) return `${Math.round(m)}m`
  return `${(m/1000).toFixed(1)}km`
}

function fmtWalkMins(m) {
  const mins = Math.max(1, Math.round(m / 80))
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const rm = mins % 60
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`
}

export default function TopBar({ from, scanState, onShare, onReset, onRetry, mapRef }) {
  const [open,        setOpen]        = useState(false)
  const [activeLayer, setActiveLayer] = useState('street')
  const [nearbyPlaces, setNearbyPlaces] = useState(null) // { pubs: [], shops: [] }
  const [nearbyLoading, setNearbyLoading] = useState(false)
  const nearbyMarkersRef = useRef([])

  const clearNearbyMarkers = useCallback(() => {
    const map = mapRef?.current
    if (!map) return
    nearbyMarkersRef.current.forEach(m => { try { map.removeLayer(m) } catch {} })
    nearbyMarkersRef.current = []
  }, [mapRef])

  const findNearbyPlaces = useCallback(async () => {
    if (!from) return
    setNearbyLoading(true)
    clearNearbyMarkers()

    const query = `
[out:json][timeout:15];
(
  node["amenity"="pub"](around:5000,${from.lat},${from.lon});
  node["amenity"="bar"](around:5000,${from.lat},${from.lon});
  node["shop"="convenience"](around:5000,${from.lat},${from.lon});
  node["shop"="supermarket"](around:5000,${from.lat},${from.lon});
  node["shop"="general"](around:5000,${from.lat},${from.lon});
);
out body;`

    try {
      let data = null
      for (const mirror of OVERPASS_MIRRORS) {
        try {
          const res = await fetch(mirror, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'data=' + encodeURIComponent(query),
            signal: AbortSignal.timeout(12000),
          })
          if (!res.ok) throw new Error('HTTP ' + res.status)
          data = await res.json()
          if (data.elements?.length > 0) break
        } catch { continue }
      }

      if (!data?.elements?.length) {
        setNearbyPlaces({ pubs: [], shops: [] })
        setNearbyLoading(false)
        return
      }

      const pubs = []
      const shops = []

      data.elements.forEach(el => {
        if (!el.lat || !el.lon || !el.tags) return
        const dist = haversineDist(from.lat, from.lon, el.lat, el.lon)
        const item = {
          id: el.id, lat: el.lat, lon: el.lon, dist,
          name: el.tags.name || (el.tags.amenity === 'pub' ? 'Pub' : el.tags.amenity === 'bar' ? 'Bar' : 'Shop'),
          type: el.tags.amenity || el.tags.shop,
          phone: el.tags.phone || el.tags['contact:phone'] || null,
          hours: el.tags.opening_hours || null,
        }
        if (el.tags.amenity === 'pub' || el.tags.amenity === 'bar') pubs.push(item)
        else shops.push(item)
      })

      pubs.sort((a, b) => a.dist - b.dist)
      shops.sort((a, b) => a.dist - b.dist)
      const topPubs = pubs.slice(0, 3)
      const topShops = shops.slice(0, 3)

      setNearbyPlaces({ pubs: topPubs, shops: topShops })

      // Drop markers on map
      const map = mapRef?.current
      const L = window.L
      if (map && L) {
        const allPlaces = [...topPubs, ...topShops]
        allPlaces.forEach(place => {
          const isPub = place.type === 'pub' || place.type === 'bar'
          const emoji = isPub ? '🍺' : '🛒'
          const color = isPub ? '#f59e0b' : '#22c55e'
          const icon = L.divIcon({
            className: '',
            html: `<div style="
              width:30px;height:30px;border-radius:8px;
              background:${color}22;border:2px solid ${color}88;
              display:flex;align-items:center;justify-content:center;
              font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.4);
            ">${emoji}</div>`,
            iconSize: [30, 30], iconAnchor: [15, 15],
          })
          const marker = L.marker([place.lat, place.lon], { icon, zIndexOffset: 700 })
            .bindPopup(`
              <div style="font-family:'JetBrains Mono',monospace;font-size:12px;min-width:150px;padding:4px 0">
                <div style="font-weight:800;font-size:14px;margin-bottom:4px">${emoji} ${place.name}</div>
                <div style="color:#888;font-size:11px;margin-bottom:2px">
                  ${fmtNearbyDist(place.dist)} · 🚶 ${fmtWalkMins(place.dist)}
                </div>
                ${place.hours ? `<div style="color:#aaa;font-size:10px;margin-bottom:2px">🕐 ${place.hours}</div>` : ''}
                ${place.phone ? `<div style="margin-top:4px"><a href="tel:${place.phone}" style="color:#00e5ff;font-size:11px">📞 ${place.phone}</a></div>` : ''}
                <div style="margin-top:4px">
                  <a href="https://www.google.com/maps/dir/${from.lat},${from.lon}/${place.lat},${place.lon}" 
                     target="_blank" style="color:#4ade80;font-size:10px;text-decoration:none">
                    🚶 Walking directions →
                  </a>
                </div>
              </div>
            `)
            .addTo(map)
          nearbyMarkersRef.current.push(marker)
        })

        // Fit map to show all places
        if (allPlaces.length > 0) {
          const bounds = L.latLngBounds([
            [from.lat, from.lon],
            ...allPlaces.map(p => [p.lat, p.lon])
          ])
          map.flyToBounds(bounds, { padding: [60, 60], duration: 1, maxZoom: 15 })
        }
      }
    } catch (err) {
      console.warn('Nearby places search failed:', err.message)
      setNearbyPlaces({ pubs: [], shops: [] })
    }

    setNearbyLoading(false)
  }, [from, mapRef, clearNearbyMarkers])

  const isLive     = scanState === 'done' && from
  const isScanning = scanState === 'scanning'

  const switchLayer = (key) => {
    const map = mapRef?.current
    if (!map) return
    map.eachLayer(l => { if (l._url) map.removeLayer(l) })
    const L = window.L
    if (!L) return
    L.tileLayer(TILE_LAYERS[key].url, {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)
    setActiveLayer(key)
  }

  return (
    <>
      {/* Top-left status pill + menu button */}
      <div style={{
        position: 'fixed', top: '10px', left: '10px', zIndex: 900,
        display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        {/* Hamburger / close button */}
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            width: '38px', height: '38px', borderRadius: '10px',
            background: 'rgba(13,20,32,0.95)', backdropFilter: 'blur(14px)',
            border: `1px solid ${open ? 'var(--cyan)' : 'var(--border-default)'}`,
            color: 'var(--cyan)', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: '4px', flexShrink: 0,
            boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
            transition: 'border-color 0.15s',
          }}
        >
          {open ? (
            <span style={{ fontSize: '18px', lineHeight: 1 }}>✕</span>
          ) : (
            <>
              <div style={{ width: '16px', height: '2px', borderRadius: '1px', background: 'var(--cyan)' }}/>
              <div style={{ width: '12px', height: '2px', borderRadius: '1px', background: 'var(--cyan)' }}/>
              <div style={{ width: '16px', height: '2px', borderRadius: '1px', background: 'var(--cyan)' }}/>
            </>
          )}
        </button>

        {/* Logo pill */}
        <div style={{
          height: '38px', padding: '0 12px',
          background: 'rgba(13,20,32,0.95)', backdropFilter: 'blur(14px)',
          border: '1px solid var(--border-default)',
          borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
        }}>
          <span style={{
            fontFamily: 'var(--font-ui)', fontWeight: 900, fontSize: '14px',
            letterSpacing: '1px', color: 'var(--cyan)', textTransform: 'uppercase',
            userSelect: 'none',
          }}>
            GET ME <span style={{ color: 'var(--amber)' }}>HOME</span>
          </span>

          {isScanning && (
            <>
              <div style={{ width: '1px', height: '14px', background: 'var(--border-default)' }}/>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{
                  width: '8px', height: '8px',
                  border: '2px solid var(--cyan)', borderTopColor: 'transparent',
                  borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                }}/>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--cyan)', letterSpacing: '2px' }}>
                  SCANNING
                </span>
              </div>
            </>
          )}
          {isLive && (
            <>
              <div style={{ width: '1px', height: '14px', background: 'var(--border-default)' }}/>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--live)', animation: 'liveDot 2s infinite' }}/>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 600, color: 'var(--live)' }}>LIVE</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Dropdown menu */}
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 894 }}/>

          <div style={{
            position: 'fixed', top: '58px', left: '10px', zIndex: 895,
            background: 'rgba(13,20,32,0.98)', backdropFilter: 'blur(20px)',
            border: '1px solid var(--border-default)',
            borderRadius: '12px', overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
            minWidth: '220px',
            animation: 'fadeUp 0.15s ease',
          }}>

            {/* Location info */}
            {from && (
              <div style={{
                padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)',
                fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)',
                lineHeight: 1.6,
              }}>
                <div style={{ color: 'var(--cyan)', letterSpacing: '1px', marginBottom: '3px' }}>📍 LANDED AT</div>
                <div style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600 }}>
                  {from.name?.split(',')[0]}
                </div>
                <div style={{ fontSize: '10px' }}>
                  {from.lat?.toFixed(4)}, {from.lon?.toFixed(4)}
                </div>
              </div>
            )}

            {/* Map layers section */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: '9px',
                color: 'var(--text-muted)', letterSpacing: '2px', marginBottom: '8px',
              }}>MAP STYLE</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {Object.entries(TILE_LAYERS).map(([key, layer]) => (
                  <button
                    key={key}
                    onClick={() => switchLayer(key)}
                    style={{
                      padding: '8px 10px', borderRadius: '8px', cursor: 'pointer',
                      border: activeLayer === key
                        ? '1px solid var(--cyan)'
                        : '1px solid var(--border-subtle)',
                      background: activeLayer === key
                        ? 'rgba(0,229,255,0.1)'
                        : 'var(--surface-2)',
                      color: activeLayer === key ? 'var(--cyan)' : 'var(--text-secondary)',
                      fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: '6px',
                      transition: 'all 0.1s',
                    }}
                  >
                    <span>{layer.emoji}</span>
                    {layer.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu items */}
            {[
              from && scanState === 'done' && { icon: '📡', label: 'Rescan Transport', action: () => { onRetry?.(); setOpen(false) } },
              from && { icon: '🍺', label: nearbyLoading ? 'Searching…' : 'Find Pubs & Shops', action: () => {
                if (!nearbyLoading) findNearbyPlaces()
              }},
              from && { icon: '📍', label: 'Centre on Me', action: () => {
                const map = mapRef?.current
                if (map && from) map.flyTo([from.lat, from.lon], 15, { duration: 0.8 })
                setOpen(false)
              }},
              from && { icon: '🗺️', label: 'Open in Google Maps', action: () => {
                window.open(`https://www.google.com/maps/search/?api=1&query=${from.lat},${from.lon}`, '_blank')
                setOpen(false)
              }},
              { icon: '📤', label: 'Share Location', action: () => { onShare?.(); setOpen(false) } },
              from && { icon: '🆘', label: 'Emergency — Share GPS', action: () => {
                const msg = `I need help. My location: https://www.google.com/maps?q=${from.lat},${from.lon}`
                if (navigator.share) {
                  navigator.share({ title: 'My Location', text: msg }).catch(() => {})
                } else {
                  navigator.clipboard?.writeText(msg)
                }
                setOpen(false)
              }, color: '#ef4444' },
              from && { icon: '🔄', label: 'Reset & Start Over', action: () => { clearNearbyMarkers(); setNearbyPlaces(null); onReset?.(); setOpen(false) }, color: '#6b7280' },
            ].filter(Boolean).map((item, i) => (
              <button
                key={i}
                onClick={item.action}
                style={{
                  width: '100%', padding: '12px 14px',
                  background: 'none', border: 'none',
                  borderBottom: '1px solid var(--border-faint)',
                  color: item.color || 'var(--text-primary)',
                  cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: '10px',
                  fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ fontSize: '16px' }}>{item.icon}</span>
                {item.label}
              </button>
            ))}

            {/* Nearby places results */}
            {nearbyPlaces && (
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
                {nearbyPlaces.pubs.length === 0 && nearbyPlaces.shops.length === 0 ? (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
                    No pubs or shops found within 5km
                  </div>
                ) : (
                  <>
                    {nearbyPlaces.pubs.length > 0 && (
                      <div style={{ marginBottom: nearbyPlaces.shops.length > 0 ? '10px' : '0' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#f59e0b', letterSpacing: '2px', marginBottom: '6px' }}>
                          🍺 NEAREST PUBS
                        </div>
                        {nearbyPlaces.pubs.map((p, i) => (
                          <button key={i} onClick={() => {
                            const map = mapRef?.current
                            if (map) map.flyTo([p.lat, p.lon], 16, { duration: 0.8 })
                            setOpen(false)
                          }} style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '6px 0', background: 'none', border: 'none', cursor: 'pointer',
                            borderBottom: i < nearbyPlaces.pubs.length - 1 ? '1px solid var(--border-faint)' : 'none',
                          }}>
                            <span style={{ fontSize: '18px' }}>🍺</span>
                            <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                              {p.hours && <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>🕐 {p.hours}</div>}
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#f59e0b', fontWeight: 700 }}>{fmtNearbyDist(p.dist)}</div>
                              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>🚶 {fmtWalkMins(p.dist)}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {nearbyPlaces.shops.length > 0 && (
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#22c55e', letterSpacing: '2px', marginBottom: '6px' }}>
                          🛒 NEAREST SHOPS
                        </div>
                        {nearbyPlaces.shops.map((p, i) => (
                          <button key={i} onClick={() => {
                            const map = mapRef?.current
                            if (map) map.flyTo([p.lat, p.lon], 16, { duration: 0.8 })
                            setOpen(false)
                          }} style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '6px 0', background: 'none', border: 'none', cursor: 'pointer',
                            borderBottom: i < nearbyPlaces.shops.length - 1 ? '1px solid var(--border-faint)' : 'none',
                          }}>
                            <span style={{ fontSize: '18px' }}>🛒</span>
                            <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                              {p.hours && <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>🕐 {p.hours}</div>}
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#22c55e', fontWeight: 700 }}>{fmtNearbyDist(p.dist)}</div>
                              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>🚶 {fmtWalkMins(p.dist)}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div style={{
              padding: '8px 14px',
              fontFamily: 'var(--font-mono)', fontSize: '9px',
              color: 'var(--text-muted)', letterSpacing: '1px',
            }}>
              GET ME HOME v2.0 · Free &amp; Open
            </div>
          </div>
        </>
      )}
    </>
  )
}
