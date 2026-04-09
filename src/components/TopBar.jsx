// TopBar v4 — collapsible top-left corner menu with map layers
import { useState } from 'react'

const TILE_LAYERS = {
  street:    { name: 'Street',    emoji: '🗺️', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' },
  satellite: { name: 'Satellite', emoji: '🛰️', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
  dark:      { name: 'Dark',      emoji: '🌑', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' },
  topo:      { name: 'Topo',      emoji: '⛰️', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png' },
}

export default function TopBar({ from, scanState, onShare, onReset, onRetry, mapRef }) {
  const [open,        setOpen]        = useState(false)
  const [activeLayer, setActiveLayer] = useState('street')

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
              from && { icon: '📍', label: 'Centre on Me', action: () => {
                const map = mapRef?.current
                if (map && from) map.flyTo([from.lat, from.lon], 15, { duration: 0.8 })
                setOpen(false)
              }},
              from && { icon: '🗺️', label: 'Open in Google Maps', action: () => {
                window.open(`https://www.google.com/maps/@${from.lat},${from.lon},15z`, '_blank')
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
              from && { icon: '🔄', label: 'Reset & Start Over', action: () => { onReset?.(); setOpen(false) }, color: '#6b7280' },
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
