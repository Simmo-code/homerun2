// GetMeHome.jsx — Smart journey optimiser
// Uses Transitous with datetime parameter for real UK transit routing

import { useState, useCallback, useEffect } from 'react'
import { fmtDist, fmtDuration } from '../utils/api'

const TRANSITOUS = 'https://api.transitous.org/api/v1/plan'

const MODE_STYLE = {
  WALK:          { icon: '🚶', color: '#4ade80', label: 'Walk' },
  BUS:           { icon: '🚌', color: '#f59e0b', label: 'Bus' },
  RAIL:          { icon: '🚆', color: '#00d4ff', label: 'Train' },
  REGIONAL_RAIL: { icon: '🚆', color: '#00d4ff', label: 'Train' },
  SUBWAY:        { icon: '🚇', color: '#00e5ff', label: 'Tube' },
  TRAM:          { icon: '🚋', color: '#ec4899', label: 'Tram' },
  FERRY:         { icon: '⛴️', color: '#06b6d4', label: 'Ferry' },
  BICYCLE:       { icon: '🚴', color: '#8b5cf6', label: 'Cycle' },
}

function modeStyle(mode) {
  return MODE_STYLE[mode?.toUpperCase()] || { icon: '🚌', color: '#f59e0b', label: mode || 'Transit' }
}

function fmtTime(ms) {
  if (!ms) return '—'
  return new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function fmtMins(secs) {
  if (!secs) return '—'
  const m = Math.round(secs / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m/60)}h ${m%60 ? m%60+'m' : ''}`
}

// ── Journey card ────────────────────────────

function JourneyCard({ journey, index, fastest, active, onClick }) {
  const [expanded, setExpanded] = useState(false)
  const totalMins = Math.round(journey.duration / 60)
  const depart = journey.legs?.[0]?.startTime
  const arrive = journey.legs?.[journey.legs.length-1]?.endTime
  const transitLegs = journey.legs?.filter(l => l.mode !== 'WALK') || []
  const walkDist = journey.walkDistance || 0
  const transfers = Math.max(0, transitLegs.length - 1)

  // Summarise the journey
  const summary = journey.legs
    ?.filter(l => l.mode !== 'WALK' || journey.legs.indexOf(l) === 0 || journey.legs.indexOf(l) === journey.legs.length-1)
    .map(l => {
      const s = modeStyle(l.mode)
      const name = l.routeShortName || (l.mode === 'WALK' ? `Walk ${Math.round((l.endTime-l.startTime)/60000)}m` : l.mode)
      return `${s.icon} ${name}`
    }).join(' → ') || 'Walk'

  const urgency = depart ? Math.round((depart - Date.now()) / 60000) : null

  return (
    <div
      onClick={() => { onClick(); setExpanded(e => !e) }}
      style={{
        background: active ? 'rgba(0,212,255,0.06)' : 'var(--surface-1)',
        border: `1px solid ${active ? 'rgba(0,212,255,0.3)' : 'var(--border-subtle)'}`,
        borderRadius: '10px', cursor: 'pointer', marginBottom: '8px',
        overflow: 'hidden', transition: 'all 0.15s',
      }}
    >
      {/* Card header */}
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: '26px', fontWeight: 700,
              color: active ? 'var(--cyan)' : 'var(--text-primary)', lineHeight: 1,
              marginBottom: '4px',
            }}>
              {fmtMins(journey.duration)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {fmtTime(depart)} → {fmtTime(arrive)}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            {fastest && (
              <span style={{
                padding: '3px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: 700, letterSpacing: '1px',
                background: 'rgba(0,230,118,0.12)', color: 'var(--live)',
                border: '1px solid rgba(0,230,118,0.25)',
              }}>⚡ FASTEST</span>
            )}
            {urgency !== null && urgency >= 0 && urgency <= 30 && (
              <span style={{
                padding: '3px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: 700,
                background: urgency <= 5 ? 'rgba(239,68,68,0.15)' : 'rgba(251,191,36,0.12)',
                color: urgency <= 5 ? '#ef4444' : 'var(--amber)',
                border: `1px solid ${urgency <= 5 ? 'rgba(239,68,68,0.3)' : 'rgba(251,191,36,0.25)'}`,
              }}>
                {urgency <= 0 ? 'LEAVE NOW' : `${urgency} min`}
              </span>
            )}
          </div>
        </div>

        {/* Journey summary pills */}
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.5 }}>
          {summary}
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: '12px', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {walkDist > 0 && <span>🚶 {fmtDist(walkDist)} walk</span>}
          {transfers > 0 && <span>🔄 {transfers} change{transfers !== 1 ? 's' : ''}</span>}
          {transitLegs.length === 0 && <span>👟 Walking only</span>}
        </div>
      </div>

      {/* Expanded step by step */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '0 14px 12px' }}>
          <div style={{ paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '0' }}>
            {journey.legs?.map((leg, i) => {
              const s = modeStyle(leg.mode)
              const isWalk = leg.mode === 'WALK'
              const dur = Math.round((leg.endTime - leg.startTime) / 60000)
              const dist = leg.distance || 0

              return (
                <div key={i} style={{
                  display: 'flex', gap: '10px', padding: '8px 0',
                  borderBottom: i < journey.legs.length-1 ? '1px solid var(--border-faint)' : 'none',
                }}>
                  {/* Icon + line */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '28px', flexShrink: 0 }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '7px', flexShrink: 0,
                      background: `${s.color}18`, border: `1px solid ${s.color}33`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
                    }}>{s.icon}</div>
                    {i < journey.legs.length-1 && (
                      <div style={{
                        width: '2px', flex: 1, minHeight: '12px',
                        background: isWalk ? `${s.color}30` : `${s.color}60`,
                        marginTop: '2px',
                        borderRadius: '1px',
                      }}/>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, paddingBottom: '4px' }}>
                    {/* From */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, lineHeight: 1.3, marginBottom: '2px' }}>
                          {isWalk
                            ? `Walk to ${leg.to?.name?.replace('START','your location').replace('END','destination')}`
                            : `${s.label} ${leg.routeShortName || ''} → ${leg.headsign || leg.to?.name || ''}`
                          }
                        </div>
                        {!isWalk && leg.from?.name && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            From: {leg.from.name}
                          </div>
                        )}
                        {!isWalk && leg.to?.name && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            To: {leg.to.name}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: s.color, fontWeight: 600 }}>
                          {fmtTime(leg.startTime)}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
                          {dur} min{dist > 0 ? ` · ${fmtDist(dist)}` : ''}
                        </div>
                      </div>
                    </div>

                    {/* Intermediate stops count */}
                    {!isWalk && leg.intermediateStops?.length > 0 && (
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px', fontFamily: 'var(--font-mono)' }}>
                        {leg.intermediateStops.length} stops
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Arrive */}
            <div style={{ display: 'flex', gap: '10px', paddingTop: '6px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>🏠</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 700 }}>Arrive at destination</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--amber)', fontWeight: 600 }}>
                  {fmtTime(arrive)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────

export default function GetMeHome({ from, to, onClose }) {
  const [journeys,   setJourneys]  = useState([])
  const [loading,    setLoading]   = useState(false)
  const [error,      setError]     = useState(null)
  const [activeIdx,  setActiveIdx] = useState(0)
  const [searched,   setSearched]  = useState(false)

  const fetchJourneys = useCallback(async () => {
    if (!from || !to) return
    setLoading(true)
    setError(null)
    setJourneys([])
    setSearched(true)

    try {
      const now = new Date()
      // Round up to next 2 minutes
      now.setMinutes(now.getMinutes() + 2)
      const datetime = now.toISOString().slice(0, 16)

      const url = `${TRANSITOUS}?fromPlace=${from.lat},${from.lon}&toPlace=${to.lat},${to.lon}&numItineraries=5&datetime=${datetime}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()

      if (data.error) throw new Error(data.error)

      const itins = data.itineraries || []
      if (itins.length === 0) throw new Error('No routes found — try a different time or destination')

      // Sort by duration
      itins.sort((a, b) => a.duration - b.duration)
      if (itins[0]) itins[0].fastest = true

      setJourneys(itins)
      setActiveIdx(0)
    } catch (err) {
      setError(err.message)
    }

    setLoading(false)
  }, [from, to])

  // Auto-fetch on mount
  useEffect(() => {
    if (from && to) fetchJourneys()
  }, [])

  if (!from || !to) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 850, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', zIndex: 860,
        top: '44px', left: '50%', transform: 'translateX(-50%)',
        width: 'min(500px, 100vw)',
        height: 'calc(100vh - 44px)',
        background: 'var(--surface-0)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
        animation: 'fadeUp 0.2s ease',
      }}>

        {/* Header */}
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'flex-start', gap: '10px', flexShrink: 0,
          background: 'var(--surface-1)',
        }}>
          <button onClick={onClose} style={{
            width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
            background: 'var(--surface-2)', border: '1px solid var(--border-default)',
            color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>‹</button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '4px' }}>
              🏠 Get Me Home
            </div>
            <div style={{
              fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {from.name.split(',')[0]} → {to.name.split(',')[0]}
            </div>
          </div>

          <button onClick={fetchJourneys} style={{
            height: '32px', padding: '0 12px', borderRadius: '7px', flexShrink: 0,
            border: '1px solid var(--border-default)', background: 'var(--surface-2)',
            color: 'var(--text-secondary)', cursor: 'pointer',
            fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '5px',
          }}>
            {loading ? <div style={{ width:'12px',height:'12px',border:'2px solid var(--cyan)',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.7s linear infinite' }}/> : '↺'}
            {loading ? 'Searching…' : 'Refresh'}
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>

          {/* Loading */}
          {loading && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--cyan)', letterSpacing: '2px' }}>
                <div style={{ width:'10px',height:'10px',border:'2px solid var(--cyan)',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite' }}/>
                SCANNING TRANSIT NETWORKS…
              </div>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  height: '100px', borderRadius: '10px', marginBottom: '8px',
                  background: 'linear-gradient(90deg, var(--surface-1), var(--surface-2), var(--surface-1))',
                  backgroundSize: '200% 100%', animation: `shimmer 1.5s ease ${i*0.15}s infinite`,
                }}/>
              ))}
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div style={{
              padding: '20px', borderRadius: '10px', textAlign: 'center',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              color: '#ef4444', fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: 1.8,
            }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚠️</div>
              {error}
              <div style={{ marginTop: '12px' }}>
                <button onClick={fetchJourneys} style={{
                  padding: '8px 16px', borderRadius: '7px',
                  border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)',
                  color: '#ef4444', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600,
                }}>Try again</button>
              </div>
            </div>
          )}

          {/* Journeys */}
          {!loading && !error && journeys.length > 0 && (
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '2px', marginBottom: '10px' }}>
                // {journeys.length} ROUTES FOUND · TAP TO EXPAND STEPS
              </div>
              {journeys.map((j, i) => (
                <JourneyCard
                  key={i} journey={j} index={i}
                  fastest={j.fastest} active={i === activeIdx}
                  onClick={() => setActiveIdx(i)}
                />
              ))}
            </div>
          )}

          {/* No results yet */}
          {!loading && !error && journeys.length === 0 && searched && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px', lineHeight: 2 }}>
              <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>🚌</div>
              No routes found<br/>
              Check destination or try later
            </div>
          )}
        </div>
      </div>
    </>
  )
}