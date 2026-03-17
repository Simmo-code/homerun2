// BottomToolbar.jsx — Mobile-style bottom action bar
import { useState } from 'react'

const TILE_LAYERS = {
  voyager:   { name: 'Street',    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png' },
  satellite: { name: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
  dark:      { name: 'Dark',      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' },
  topo:      { name: 'Topo',      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png' },
}

export default function BottomToolbar({ mapRef, scanResults, from, onSearch }) {
  const [showLayers, setShowLayers] = useState(false)
  const [activeLayer, setActiveLayer] = useState('voyager')
  const [showList, setShowList] = useState(false)

  const switchLayer = (key) => {
    const map = mapRef?.current
    if (!map) return
    // Remove existing tile layers
    map.eachLayer(l => { if (l._url) map.removeLayer(l) })
    // Add new tile layer
    const L = window.L || require('leaflet')
    L.tileLayer(TILE_LAYERS[key].url, {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)
    setActiveLayer(key)
    setShowLayers(false)
  }

  // Count all nearby transport
  const totalFound = scanResults
    ? Object.values(scanResults).reduce((sum, arr) => sum + (arr?.length || 0), 0)
    : 0

  const allItems = scanResults
    ? Object.entries(scanResults).flatMap(([type, items]) =>
        (items || []).map(item => ({ ...item, type }))
      )
    : []

  return (
    <>
      {/* Layers panel */}
      {showLayers && (
        <>
          <div onClick={() => setShowLayers(false)} style={{
            position: 'fixed', inset: 0, zIndex: 890,
          }}/>
          <div style={{
            position: 'fixed', bottom: '70px', left: '50%', transform: 'translateX(-50%)',
            background: 'var(--surface-1)', border: '1px solid var(--border-default)',
            borderRadius: '14px', padding: '12px', zIndex: 900,
            display: 'flex', gap: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}>
            {Object.entries(TILE_LAYERS).map(([key, layer]) => (
              <button key={key} onClick={() => switchLayer(key)} style={{
                padding: '8px 14px', borderRadius: '8px', cursor: 'pointer',
                border: activeLayer === key ? '2px solid var(--cyan)' : '1px solid var(--border-subtle)',
                background: activeLayer === key ? 'rgba(0,229,255,0.1)' : 'var(--surface-2)',
                color: activeLayer === key ? 'var(--cyan)' : 'var(--text-secondary)',
                fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600,
                whiteSpace: 'nowrap',
              }}>{layer.name}</button>
            ))}
          </div>
        </>
      )}

      {/* List panel */}
      {showList && (
        <>
          <div onClick={() => setShowList(false)} style={{
            position: 'fixed', inset: 0, zIndex: 890, background: 'rgba(0,0,0,0.4)',
          }}/>
          <div style={{
            position: 'fixed', bottom: '70px', left: '50%', transform: 'translateX(-50%)',
            width: 'min(420px, 95vw)', maxHeight: '60vh',
            background: 'var(--surface-0)', border: '1px solid var(--border-default)',
            borderRadius: '14px', zIndex: 900, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}>
            <div style={{
              padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)',
              fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)',
              letterSpacing: '2px', display: 'flex', justifyContent: 'space-between',
            }}>
              <span>NEARBY TRANSPORT ({totalFound})</span>
              <button onClick={() => setShowList(false)} style={{
                background: 'none', border: 'none', color: 'var(--text-secondary)',
                cursor: 'pointer', fontSize: '16px',
              }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '8px' }}>
              {allItems.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  {from ? 'No transport found nearby' : 'Drop a pin to scan transport'}
                </div>
              ) : allItems.map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 10px', borderRadius: '8px',
                  borderBottom: '1px solid var(--border-faint)',
                }}>
                  <span style={{ fontSize: '18px', flexShrink: 0 }}>{item.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, lineHeight: 1.2,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.label || item.name}
                    </div>
                    {item.dist && (
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {item.dist < 1000 ? `${Math.round(item.dist)}m` : `${(item.dist/1000).toFixed(1)}km`}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Bottom toolbar */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: 'min(500px, 100vw)', height: '60px', zIndex: 880,
        background: 'var(--surface-1)',
        borderTop: '1px solid var(--border-default)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.4)',
      }}>
        {[
          { icon: '🗺️', label: 'Layers', action: () => setShowLayers(l => !l), active: showLayers },
          { icon: '≡',  label: 'List',   action: () => setShowList(l => !l),   active: showList,
            badge: totalFound > 0 ? totalFound : null },
          { icon: '🔍', label: 'Search', action: onSearch },
          { icon: '📍', label: 'Hold',   action: null, hint: true },
        ].map((btn, i) => (
          <button key={i} onClick={btn.action} style={{
            flex: 1, height: '100%', background: 'none', border: 'none',
            cursor: btn.action ? 'pointer' : 'default',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: '2px', position: 'relative',
            color: btn.active ? 'var(--cyan)' : btn.hint ? 'var(--text-muted)' : 'var(--text-secondary)',
          }}>
            {btn.badge && (
              <div style={{
                position: 'absolute', top: '8px', right: 'calc(50% - 18px)',
                background: 'var(--cyan)', color: '#000', borderRadius: '10px',
                fontSize: '9px', fontWeight: 800, padding: '1px 5px',
                fontFamily: 'var(--font-mono)',
              }}>{btn.badge}</div>
            )}
            <span style={{ fontSize: btn.icon === '≡' ? '20px' : '16px', lineHeight: 1 }}>{btn.icon}</span>
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', letterSpacing: '0.5px' }}>
              {btn.hint ? 'LONG PRESS' : btn.label.toUpperCase()}
            </span>
          </button>
        ))}
      </div>
    </>
  )
}
