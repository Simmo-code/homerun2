// LandButton — GPS button + manual location entry
import { useState, useRef } from 'react'
import { geocodeSearch } from '../utils/api'

export default function LandButton({ onLand, onManualLocation, hasLocation, scanning }) {
  const [showManual, setShowManual]   = useState(false)
  const [query, setQuery]             = useState('')
  const [results, setResults]         = useState([])
  const [searching, setSearching]     = useState(false)
  const timerRef                      = useRef(null)

  const handleQueryChange = (e) => {
    const q = e.target.value
    setQuery(q)
    clearTimeout(timerRef.current)
    if (!q.trim()) { setResults([]); return }
    timerRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await geocodeSearch(q)
        setResults(res)
      } catch {}
      setSearching(false)
    }, 420)
  }

  const handleSelect = (item) => {
    const loc = {
      lat:  parseFloat(item.lat),
      lon:  parseFloat(item.lon),
      name: item.display_name.split(',').slice(0, 3).join(', ').trim(),
    }
    setQuery(loc.name)
    setResults([])
    setShowManual(false)
    onManualLocation(loc)
  }

  if (hasLocation) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(var(--panel-h) + 16px)',
      left: '50%', transform: 'translateX(-50%)',
      zIndex: 600,
      width: 'calc(100vw - 24px)',
      maxWidth: '400px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>

      {/* Manual search box */}
      {showManual && (
        <div style={{
          background: 'rgba(13,20,32,0.98)',
          border: '1px solid var(--border-default)',
          borderRadius: '12px',
          overflow: 'visible',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          position: 'relative',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '0 12px', height: '48px',
          }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>📍</span>
            <input
              autoFocus
              value={query}
              onChange={handleQueryChange}
              placeholder="Type your landing location…"
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600,
              }}
            />
            {searching && (
              <div style={{
                width: '14px', height: '14px', flexShrink: 0,
                border: '2px solid var(--cyan)', borderTopColor: 'transparent',
                borderRadius: '50%', animation: 'spin 0.8s linear infinite',
              }}/>
            )}
            <button
              onClick={() => { setShowManual(false); setQuery(''); setResults([]) }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: '20px', lineHeight: 1,
                flexShrink: 0, padding: '0 2px',
              }}
            >×</button>
          </div>

          {/* Results dropdown */}
          {results.length > 0 && (
            <div style={{
              borderTop: '1px solid var(--border-subtle)',
              maxHeight: '220px', overflowY: 'auto',
            }}>
              {results.map((r, i) => {
                const parts = r.display_name.split(',')
                const name  = parts.slice(0, 2).join(', ')
                const detail = parts.slice(2, 5).join(',').trim()
                return (
                  <div
                    key={i}
                    onClick={() => handleSelect(r)}
                    style={{
                      padding: '10px 14px', cursor: 'pointer',
                      borderBottom: '1px solid var(--border-faint)',
                      transition: 'background 0.1s',
                      display: 'flex', alignItems: 'flex-start', gap: '8px',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ color: 'var(--cyan)', fontSize: '12px', marginTop: '2px', flexShrink: 0 }}>◉</span>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, lineHeight: 1.3 }}>{name}</div>
                      {detail && <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{detail}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Button row */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {/* GPS button */}
        <button
          onClick={onLand}
          disabled={scanning}
          style={{
            flex: 1, height: '52px',
            borderRadius: '12px',
            background: scanning ? 'rgba(0,229,255,0.06)' : 'rgba(0,229,255,0.1)',
            border: '2px solid var(--cyan)',
            color: 'var(--cyan)',
            cursor: scanning ? 'default' : 'pointer',
            fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 800,
            letterSpacing: '1.5px', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 0 24px rgba(0,229,255,0.12), 0 4px 16px rgba(0,0,0,0.4)',
            transition: 'all 0.2s',
            position: 'relative', overflow: 'hidden',
          }}
        >
          {!scanning && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.06), transparent)',
              animation: 'shimmer 2.5s ease infinite',
              backgroundSize: '200% 100%',
            }}/>
          )}
          {scanning ? (
            <>
              <div style={{
                width: '16px', height: '16px', flexShrink: 0,
                border: '2.5px solid var(--cyan)', borderTopColor: 'transparent',
                borderRadius: '50%', animation: 'spin 0.8s linear infinite',
              }}/>
              SCANNING…
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>
              </svg>
              I LANDED HERE
            </>
          )}
        </button>

        {/* Manual entry button */}
        <button
          onClick={() => setShowManual(m => !m)}
          title="Enter location manually"
          style={{
            width: '52px', height: '52px', borderRadius: '12px', flexShrink: 0,
            background: showManual ? 'rgba(251,191,36,0.12)' : 'rgba(13,20,32,0.9)',
            border: `2px solid ${showManual ? 'var(--amber)' : 'var(--border-default)'}`,
            color: showManual ? 'var(--amber)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(12px)',
            transition: 'all 0.2s',
            fontSize: '20px',
          }}
        >
          ⌨️
        </button>
      </div>
    </div>
  )
}