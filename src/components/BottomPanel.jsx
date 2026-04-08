// BottomPanel — the main split-view bottom panel
// Shows: scan results (what's around you) + Get Me Home routes
// Updated: live bus indicators on bus stop rows
import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { fmtDist, fmtWalk, fmtDuration, taxiCost, haversine } from '../utils/api'

// ── Live Bus Badge ────────────────────────────

function LiveBusBadge({ count }) {
  if (!count || count <= 0) return null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      padding: '1px 6px', borderRadius: '10px',
      background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.25)',
      fontSize: '9px', fontWeight: 800, fontFamily: 'var(--font-mono)',
      color: 'var(--live)', letterSpacing: '0.5px',
      animation: 'live-pulse 2s ease-in-out infinite',
    }}>
      <span style={{
        width: '5px', height: '5px', borderRadius: '50%',
        background: 'var(--live)',
        animation: 'live-dot-blink 1.5s ease-in-out infinite',
      }}/>
      {count} LIVE
    </span>
  )
}

// ── Transport Mode Row ─────────────────────────

function TransportRow({ icon, color, label, items, onItemClick, walkFrom, liveBusCount }) {
  if (!items || items.length === 0) return null

  const best = items[0]
  const hasNoData = best.noData === true
  const walkMins = walkFrom && best.lat ? Math.round(haversine(walkFrom.lat, walkFrom.lon, best.lat, best.lon) / 80) : null

  return (
    <div
      onClick={() => onItemClick(best)}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 0', borderBottom: '1px solid var(--border-faint)',
        cursor: 'pointer', transition: 'background 0.1s',
        borderRadius: '4px',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <span style={{ fontSize: '26px', width: '32px', textAlign: 'center', flexShrink: 0 }}>{icon}</span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '2px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {best.label}
          </span>
          {items.length > 1 && (
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              +{items.length - 1} more
            </span>
          )}
          {/* Live bus badge for bus-type rows */}
          {liveBusCount > 0 && <LiveBusBadge count={liveBusCount} />}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {best.routes && (
            <span style={{ fontSize: '12px', color: color, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              {(best.routes || '').split(';').filter(Boolean).slice(0,4).join(' · ')}
            </span>
          )}
          {best.operator && !best.routes && (
            <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{best.operator}</span>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '17px', fontFamily: 'var(--font-mono)', color: color, fontWeight: 800 }}>
          {fmtDist(best.dist)}
        </div>
        {walkMins !== null && (
          <div style={{ fontSize: '14px', color: 'var(--cyan)', fontWeight: 700, marginTop: '3px' }}>
            🚶 {walkMins < 2 ? 'here' : walkMins >= 60 ? `${Math.floor(walkMins/60)}h ${walkMins%60}m` : `${walkMins} min`}
          </div>
        )}
      </div>

      <svg width="12" height="20" viewBox="0 0 8 12" fill="var(--cyan)" style={{ flexShrink: 0 }}>
        <path d="M1 1l6 5-6 5"/>
      </svg>
    </div>
  )
}

// ── Local Taxi Row ─────────────────────────────

function LocalTaxiRow({ company, onCall }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '9px 0', borderBottom: '1px solid var(--border-faint)',
    }}>
      <span style={{ fontSize: '22px', width: '28px', textAlign: 'center' }}>📞</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 700 }}>{company.name}</div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '1px' }}>
          {fmtDist(company.dist)} · Local taxi
        </div>
      </div>
      {company.phone && (
        <a
          href={`tel:${company.phone}`}
          onClick={e => e.stopPropagation()}
          style={{
            height: '32px', padding: '0 12px', borderRadius: '6px',
            background: 'rgba(255,107,53,0.12)', border: '1px solid rgba(255,107,53,0.3)',
            color: 'var(--taxi)', textDecoration: 'none',
            fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: '5px',
          }}
        >📞 Call</a>
      )}
    </div>
  )
}

// ── Route Card ─────────────────────────────────

function RouteCard({ route, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? `${route.color.replace('var(--','rgba(').replace(')',', 0.08)')}` : 'transparent',
        border: `1px solid ${active ? route.color.replace('var(--','rgba(').replace(')',', 0.35)') : 'var(--border-subtle)'}`,
        borderRadius: '8px', cursor: 'pointer', marginBottom: '6px',
        transition: 'all 0.15s', overflow: 'hidden', padding: '10px 12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '3px', height: '48px', borderRadius: '2px',
          background: route.unavailable ? 'var(--border-default)' : route.color,
          flexShrink: 0,
        }}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: 700,
              color: route.unavailable ? 'var(--text-muted)' : route.color, lineHeight: 1,
            }}>
              {route.unavailable ? '—' : fmtDuration(route.duration)}
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {route.fastest && !route.unavailable && (
                <span style={{
                  padding: '2px 7px', borderRadius: '4px', fontSize: '9px', fontWeight: 700, letterSpacing: '1px',
                  background: 'rgba(0,230,118,0.1)', color: 'var(--live)', border: '1px solid rgba(0,230,118,0.25)',
                }}>⚡ FASTEST</span>
              )}
              {route.costEstimate && !route.unavailable && (
                <span style={{
                  padding: '2px 7px', borderRadius: '4px', fontSize: '9px', fontWeight: 600,
                  background: 'var(--surface-3)', color: 'var(--text-primary)',
                }}>{route.costEstimate}</span>
              )}
            </div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.4,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {route.summary}
          </div>
          {route.departTime && (
            <div style={{ fontSize: '11px', color: 'var(--amber)', fontFamily: 'var(--font-mono)', marginTop: '3px' }}>
              Departs {route.departTime}
            </div>
          )}
          {/* Show leg details for transit routes */}
          {route.legs && route.legs.length > 1 && active && (
            <div style={{ marginTop: '10px', borderTop: '1px solid var(--border-faint)', paddingTop: '8px' }}>
              {route.legs.map((leg, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '8px',
                  padding: '5px 0', borderBottom: i < route.legs.length-1 ? '1px solid var(--border-faint)' : 'none',
                }}>
                  <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>{leg.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: leg.color || 'var(--text-primary)', lineHeight: 1.3 }}>
                      {leg.label}
                    </div>
                    {leg.from && (
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                        {leg.from}{leg.to ? ' → ' + leg.to : ''}
                      </div>
                    )}
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    {leg.departTime && (
                      <div style={{ fontSize: '12px', color: 'var(--amber)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        {leg.departTime}
                      </div>
                    )}
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {leg.duration ? fmtDuration(leg.duration / 60) : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Destination Search ─────────────────────────

function DestSearch({ value, onChange, onClear, geocodeSearch }) {
  const [query, setQuery] = useState(value?.name || '')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const timerRef = useState(null)[0]

  const handleChange = (e) => {
    const q = e.target.value; setQuery(q)
    if (!q) { setResults([]); setOpen(false); return }
    clearTimeout(timerRef)
    const t = setTimeout(async () => {
      try { const r = await geocodeSearch(q); setResults(r); setOpen(true) } catch {}
    }, 420)
  }

  const handleSelect = (item) => {
    const loc = { lat: +item.lat, lon: +item.lon, name: (item.display_name || item.name || '').split(',').slice(0,2).join(', ') }
    setQuery(loc.name); setResults([]); setOpen(false); onChange(loc)
  }

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px',
        background: 'var(--surface-2)', border: '1px solid var(--border-default)',
        borderRadius: '8px', padding: '0 10px', height: '40px' }}>
        <span style={{ fontSize: '14px', flexShrink: 0 }}>🏠</span>
        <input
          value={query} onChange={handleChange}
          placeholder="Where are you going?"
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600 }}
        />
        {query && (
          <button onClick={() => { setQuery(''); onChange(null); onClear?.() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: '16px', lineHeight: 1, padding: '0 2px' }}>×</button>
        )}
      </div>
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', bottom: '44px', left: 0, right: 0, zIndex: 100,
          background: 'var(--surface-1)', border: '1px solid var(--border-default)',
          borderRadius: '8px', overflow: 'hidden', boxShadow: '0 -8px 30px rgba(0,0,0,0.6)',
        }}>
          {results.map((r, i) => (
            <div key={i} onMouseDown={() => handleSelect(r)}
              style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-faint)',
                transition: 'background 0.1s', fontSize: '13px' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ fontWeight: 600 }}>{(r.display_name || r.name || '').split(',').slice(0,2).join(', ')}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                {(r.display_name || r.name || '').split(',').slice(2,4).join(',')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── MAIN BOTTOM PANEL ──────────────────────────

const TABS = ['NEARBY', 'HOME ROUTES']

export default function BottomPanel({
  from, scanResults, localTaxis, scanState, noDataStops = new Set(),
  homeRoutes, activeRouteIdx, onRouteSelect,
  to, onToChange, onToClear,
  onComputeHome, onMarkerClick, onGetMeHome,
  geocodeSearch, homeRoutesLoading,
  liveBuses = [],
}) {
  const [tab, setTab] = useState('NEARBY')
  const hasScan = scanState === 'done'
  const totalFound = Object.values(scanResults).flat().length + localTaxis.length

  // ── Compute live bus counts per bus stop ─────
  const liveBusByStop = useMemo(() => {
    if (!liveBuses || liveBuses.length === 0 || !scanResults.bus || scanResults.bus.length === 0) {
      return { total: liveBuses?.length || 0, perStop: new Map() }
    }

    const perStop = new Map()
    const MATCH_RADIUS_M = 500 // match buses within 500m of each stop

    scanResults.bus.forEach(stop => {
      if (!stop.lat || !stop.lon) return
      let count = 0
      liveBuses.forEach(bus => {
        if (!bus.lat || !bus.lon) return
        const dist = haversine(stop.lat, stop.lon, bus.lat, bus.lon)
        if (dist <= MATCH_RADIUS_M) count++
      })
      if (count > 0) {
        // Use stop label or coords as key
        const key = stop.label || `${stop.lat}-${stop.lon}`
        perStop.set(key, count)
      }
    })

    return { total: liveBuses.length, perStop }
  }, [liveBuses, scanResults.bus])

  const SNAP_PEEK = 80
  const SNAP_HALF = Math.round(window.innerHeight * 0.40)
  const SNAP_FULL = Math.round(window.innerHeight * 0.85)
  const SNAPS = [SNAP_PEEK, SNAP_HALF, SNAP_FULL]

  const [panelH, setPanelH] = useState(SNAP_HALF)
  const startY = useRef(0)
  const startH = useRef(0)
  const isDrag = useRef(false)

  const snapTo = (h) => {
    const s = SNAPS.reduce((a, b) => Math.abs(b-h) < Math.abs(a-h) ? b : a)
    setPanelH(s)
  }

  useEffect(() => {
    const move = (e) => {
      if (!isDrag.current) return
      const y = e.touches ? e.touches[0].clientY : e.clientY
      const newH = Math.max(SNAP_PEEK, Math.min(SNAP_FULL, startH.current + startY.current - y))
      setPanelH(newH)
    }
    const end = (e) => {
      if (!isDrag.current) return
      isDrag.current = false
      const y = e.changedTouches ? e.changedTouches[0].clientY : e.clientY
      const newH = Math.max(SNAP_PEEK, Math.min(SNAP_FULL, startH.current + startY.current - y))
      snapTo(newH)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', end)
    window.addEventListener('touchmove', move, { passive: true })
    window.addEventListener('touchend', end)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', end)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', end)
    }
  }, [])

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 700,
      height: panelH + 'px',
      background: 'rgba(6,9,15,0.97)', backdropFilter: 'blur(20px)',
      borderTop: '1px solid var(--border-default)',
      borderRadius: '16px 16px 0 0',
      display: 'flex', flexDirection: 'column',
      transition: isDrag.current ? 'none' : 'height 0.2s ease',
      boxShadow: '0 -8px 40px rgba(0,0,0,0.7)',
    }}>
      {/* Drag handle */}
      <div
        onMouseDown={(e) => { isDrag.current=true; startY.current=e.clientY; startH.current=panelH }}
        onTouchStart={(e) => { isDrag.current=true; startY.current=e.touches[0].clientY; startH.current=panelH }}
        onClick={() => { const i=SNAPS.indexOf(panelH); setPanelH(SNAPS[(i+1)%SNAPS.length]) }}
        style={{ padding: '10px', display: 'flex', justifyContent: 'center', cursor: 'ns-resize', flexShrink: 0, touchAction: 'none' }}
      >
        <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border-default)' }}/>
      </div>

      {/* Destination bar */}
      <div style={{ padding: '0 12px 10px', flexShrink: 0, display: 'flex', gap: '8px', alignItems: 'center' }}>
        <DestSearch
          value={to} onChange={onToChange} onClear={onToClear}
          geocodeSearch={geocodeSearch}
        />
        {to && (
          <button
            onClick={onComputeHome}
            disabled={!from || homeRoutesLoading}
            style={{
              height: '40px', padding: '0 14px', borderRadius: '8px', border: 'none',
              background: from ? 'var(--amber)' : 'var(--surface-3)',
              color: from ? '#000' : 'var(--text-muted)',
              cursor: from ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 800,
              letterSpacing: '0.5px', whiteSpace: 'nowrap', flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: '5px',
            }}
          >
            {homeRoutesLoading
              ? <><div style={{ width:'12px',height:'12px',border:'2px solid #000',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.7s linear infinite' }}/> Finding…</>
              : '🔍 Find'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--border-subtle)',
        padding: '0 12px', flexShrink: 0, gap: '0',
      }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '6px 14px', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 700,
              letterSpacing: '1px', textTransform: 'uppercase',
              color: tab === t ? 'var(--cyan)' : 'var(--text-muted)',
              borderBottom: tab === t ? '2px solid var(--cyan)' : '2px solid transparent',
              marginBottom: '-1px', transition: 'all 0.15s',
            }}
          >
            {t}
            {t === 'NEARBY' && totalFound > 0 && (
              <span style={{
                marginLeft: '6px', padding: '1px 5px', borderRadius: '10px',
                background: 'rgba(0,229,255,0.15)', color: 'var(--cyan)',
                fontFamily: 'var(--font-mono)', fontSize: '9px',
              }}>{totalFound}</span>
            )}
            {t === 'NEARBY' && liveBusByStop.total > 0 && (
              <span style={{
                marginLeft: '4px', padding: '1px 5px', borderRadius: '10px',
                background: 'rgba(0,230,118,0.12)', color: 'var(--live)',
                fontFamily: 'var(--font-mono)', fontSize: '9px',
                animation: 'live-pulse 2s ease-in-out infinite',
              }}>🚌 {liveBusByStop.total}</span>
            )}
            {t === 'HOME ROUTES' && homeRoutes.length > 0 && (
              <span style={{
                marginLeft: '6px', padding: '1px 5px', borderRadius: '10px',
                background: 'rgba(251,191,36,0.15)', color: 'var(--amber)',
                fontFamily: 'var(--font-mono)', fontSize: '9px',
              }}>{homeRoutes.filter(r=>!r.unavailable).length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px 16px' }}>

        {/* ── NEARBY TAB ── */}
        {tab === 'NEARBY' && (
          <div>
            {/* Scan state */}
            {scanState === 'idle' && !from && (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px', lineHeight: 2 }}>
                <div style={{ fontSize: '28px', marginBottom: '8px', opacity: 0.3 }}>📡</div>
                TAP "I LANDED HERE" TO SCAN<br/>ALL TRANSPORT AROUND YOU
              </div>
            )}

            {scanState === 'scanning' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px 0' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--cyan)', letterSpacing: '2px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width:'10px',height:'10px',border:'2px solid var(--cyan)',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite' }}/>
                  DEEP SCANNING TRANSPORT NETWORKS…
                </div>
                {[0,1,2,3,4].map(i => (
                  <div key={i} style={{
                    height: '46px', borderRadius: '8px',
                    background: 'linear-gradient(90deg, var(--surface-1), var(--surface-2), var(--surface-1))',
                    backgroundSize: '200% 100%',
                    animation: `shimmer 1.5s ease ${i*0.12}s infinite`,
                  }}/>
                ))}
              </div>
            )}

            {scanState === 'done' && (
              <div>
                {/* Summary line */}
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)',
                  letterSpacing: '2px', marginBottom: '8px', padding: '4px 0',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <span>// {totalFound} OPTIONS FOUND · TAP ANY TO SEE LIVE DEPARTURES</span>
                  {liveBusByStop.total > 0 && (
                    <span style={{
                      color: 'var(--live)', fontWeight: 700,
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                    }}>
                      <span style={{
                        width: '5px', height: '5px', borderRadius: '50%',
                        background: 'var(--live)',
                        animation: 'live-dot-blink 1.5s ease-in-out infinite',
                        display: 'inline-block',
                      }}/>
                      {liveBusByStop.total} BUSES LIVE
                    </span>
                  )}
                </div>

                {/* Transport rows — bus row gets live count */}
                <TransportRow
                  icon="🚌" color="var(--bus)" label="Bus"
                  items={scanResults.bus} onItemClick={onMarkerClick} walkFrom={from}
                  liveBusCount={liveBusByStop.total}
                />
                <TransportRow icon="🚆" color="var(--train)"   label="Train"       items={scanResults.train}   onItemClick={onMarkerClick} walkFrom={from}/>
                <TransportRow icon="🚋" color="var(--coach)"   label="Tram"        items={scanResults.tram}    onItemClick={onMarkerClick} walkFrom={from}/>
                <TransportRow icon="🚇" color="var(--cyan)"    label="Metro"       items={scanResults.metro}   onItemClick={onMarkerClick} walkFrom={from}/>
                <TransportRow icon="🚌" color="var(--coach)"   label="Coach"       items={scanResults.coach}   onItemClick={onMarkerClick} walkFrom={from}/>
                <TransportRow icon="⛴️" color="var(--ferry)"   label="Ferry"       items={scanResults.ferry}   onItemClick={onMarkerClick} walkFrom={from}/>

                {/* Taxis section */}
                <div style={{ marginTop: '4px', marginBottom: '4px' }}>
                  <TransportRow icon="🚕" color="var(--taxi)"  label="Taxi rank"   items={scanResults.taxi}    onItemClick={onMarkerClick} walkFrom={from}/>
                  {localTaxis.map((co, i) => (
                    <LocalTaxiRow key={i} company={co}/>
                  ))}
                  {/* Uber/Bolt always shown if we have a location */}
                  {from && (
                    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border-faint)' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <a href={`https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${from.lat}&pickup[longitude]=${from.lon}`}
                          target="_blank" rel="noreferrer"
                          style={{
                            flex:1, height:'36px', borderRadius:'7px',
                            background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)',
                            color:'var(--text-primary)', textDecoration:'none',
                            display:'flex', alignItems:'center', justifyContent:'center', gap:'6px',
                            fontFamily:'var(--font-ui)', fontSize:'13px', fontWeight:700,
                          }}>🚗 Uber</a>
                        <a href="https://bolt.eu/" target="_blank" rel="noreferrer"
                          style={{
                            flex:1, height:'36px', borderRadius:'7px',
                            background:'rgba(52,199,89,0.07)', border:'1px solid rgba(52,199,89,0.2)',
                            color:'#34C759', textDecoration:'none',
                            display:'flex', alignItems:'center', justifyContent:'center', gap:'6px',
                            fontFamily:'var(--font-ui)', fontSize:'13px', fontWeight:700,
                          }}>⚡ Bolt</a>
                      </div>
                    </div>
                  )}
                </div>

                <TransportRow icon="🚲" color="var(--cycle)"   label="Cycle hire"  items={scanResults.cycle}   onItemClick={onMarkerClick} walkFrom={from}/>
                <TransportRow icon="🛴" color="var(--scooter)" label="E-Scooter"   items={scanResults.scooter} onItemClick={onMarkerClick} walkFrom={from}/>
                <TransportRow icon="🚗" color="var(--car)"     label="Car rental"  items={scanResults.car}     onItemClick={onMarkerClick} walkFrom={from}/>
                <TransportRow icon="✈️" color="var(--air)"     label="Airport"     items={scanResults.air}     onItemClick={onMarkerClick} walkFrom={from}/>
              </div>
            )}
          </div>
        )}

        {/* ── HOME ROUTES TAB ── */}
        {tab === 'HOME ROUTES' && (
          <div>
            {!to && (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px', lineHeight: 2 }}>
                <div style={{ fontSize: '28px', marginBottom: '8px', opacity: 0.3 }}>🏠</div>
                ENTER YOUR DESTINATION ABOVE<br/>TO FIND THE BEST ROUTE HOME
              </div>
            )}

            {to && homeRoutes.length === 0 && !homeRoutesLoading && (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                Tap FIND to calculate routes
              </div>
            )}

            {homeRoutesLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{
                    height: '80px', borderRadius: '8px',
                    background: 'linear-gradient(90deg, var(--surface-1), var(--surface-2), var(--surface-1))',
                    backgroundSize: '200% 100%', animation: `shimmer 1.5s ease ${i*0.12}s infinite`,
                  }}/>
                ))}
              </div>
            )}

            {!homeRoutesLoading && homeRoutes.map((route, i) => (
              <RouteCard
                key={route.id} route={route}
                active={i === activeRouteIdx}
                onClick={() => onRouteSelect(i)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Live bus animation keyframes */}
      <style>{`
        @keyframes live-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes live-dot-blink {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
      `}</style>
    </div>
  )
}
