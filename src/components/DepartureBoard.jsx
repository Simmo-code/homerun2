// DepartureBoard — Live departure panel
// Shows real National Rail data for train stations
// Shows Transitous/placeholder data for bus stops
import { useState, useEffect } from 'react'
import { fmtDist, fmtWalk, fetchLiveDepartures } from '../utils/api'
import { fetchTrainDepartures, getCRS } from '../hooks/useTrainDepartures'
import { fetchTransitousDepartures } from '../utils/transitousDepartures'
 
function MinuteBadge({ mins, cancelled, delayed }) {
  if (cancelled) return (
    <div style={{
      minWidth: '60px', height: '26px', borderRadius: '5px',
      background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
      color: '#ef4444', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>CANC</div>
  )
  if (mins === null || mins === undefined) return null
  const color = mins <= 2 ? '#ef4444' : mins <= 5 ? '#f59e0b' : delayed ? '#f59e0b' : '#00e676'
  const label = mins <= 0 ? 'DUE' : `${mins} min`
  return (
    <div style={{
      minWidth: '52px', height: '26px', borderRadius: '5px',
      background: `${color}18`, border: `1px solid ${color}40`,
      color, fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>{label}</div>
  )
}
 
// Train departure row — shows platform, destination, operator
function TrainRow({ dep, idx }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '10px 0', borderBottom: '1px solid var(--border-faint)',
      animation: `boardSlide 0.2s ease ${idx * 0.05}s both`,
    }}>
      {/* Time */}
      <div style={{ flexShrink: 0, width: '42px' }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700,
          color: dep.cancelled ? '#ef4444' : dep.delayed ? '#f59e0b' : 'var(--train)',
        }}>{dep.displayTime || dep.scheduledTime}</div>
        {dep.delayed && dep.scheduledTime !== dep.estimatedTime && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
            {dep.scheduledTime}
          </div>
        )}
      </div>
 
      {/* Platform */}
      {dep.platform && (
        <div style={{
          width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0,
          background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', lineHeight: 1 }}>Plat</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--train)', lineHeight: 1 }}>{dep.platform}</div>
        </div>
      )}
 
      {/* Destination + operator */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '14px', fontWeight: 700, lineHeight: 1.2,
          color: dep.cancelled ? 'var(--text-muted)' : 'var(--text-primary)',
          textDecoration: dep.cancelled ? 'line-through' : 'none',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{dep.destination}</div>
        {dep.operator && (
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>{dep.operator}</div>
        )}
        {dep.delayReason && (
          <div style={{ fontSize: '10px', color: '#f59e0b', marginTop: '2px' }}>⚠️ {dep.delayReason}</div>
        )}
      </div>
 
      {/* Minutes badge */}
      <MinuteBadge mins={dep.minutesUntil} cancelled={dep.cancelled} delayed={dep.delayed}/>
    </div>
  )
}
 
// Bus departure row
function BusRow({ dep, idx }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '9px 0', borderBottom: '1px solid var(--border-faint)',
      animation: `boardSlide 0.2s ease ${idx * 0.05}s both`,
    }}>
      <div style={{
        minWidth: '44px', height: '26px', borderRadius: '5px',
        background: dep.color ? `${dep.color}22` : 'var(--surface-3)',
        border: dep.color ? `1px solid ${dep.color}40` : '1px solid var(--border-subtle)',
        color: dep.color || 'var(--text-primary)',
        fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{dep.line || dep.route || '?'}</div>
 
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, lineHeight: 1.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {dep.destination || dep.headsign || 'Town Centre'}
        </div>
        {dep.platform && (
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
            Stop {dep.platform}
          </div>
        )}
      </div>
 
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '3px' }}>
          {dep.scheduledTime || '—'}
        </div>
        <MinuteBadge mins={dep.minutesUntil}/>
      </div>
    </div>
  )
}
 
// Taxi panel
function TaxiPanel({ item }) {
  const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${item.lat}&pickup[longitude]=${item.lon}`
  return (
    <div>
      {item.phone && (
        <div style={{
          background: 'rgba(255,107,53,0.06)', border: '1px solid rgba(255,107,53,0.2)',
          borderRadius: '8px', padding: '12px', marginBottom: '10px',
        }}>
          <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>{item.label}</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <a href={`tel:${item.phone}`} style={{
              height: '38px', padding: '0 14px', borderRadius: '7px',
              background: 'var(--taxi)', color: '#000', textDecoration: 'none',
              fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 800,
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>📞 {item.phone}</a>
            <a href={`https://wa.me/${item.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" style={{
              height: '38px', padding: '0 14px', borderRadius: '7px',
              background: 'rgba(37,211,102,0.15)', border: '1px solid rgba(37,211,102,0.3)',
              color: '#25D366', textDecoration: 'none',
              fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>💬 WhatsApp</a>
          </div>
        </div>
      )}
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '8px', letterSpacing: '1px' }}>RIDE-HAIL APPS</div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <a href={uberUrl} target="_blank" rel="noreferrer" style={{
          flex: 1, height: '42px', borderRadius: '8px',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          color: 'var(--text-primary)', textDecoration: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 700,
        }}>🚗 Uber</a>
        <a href="https://bolt.eu/" target="_blank" rel="noreferrer" style={{
          flex: 1, height: '42px', borderRadius: '8px',
          background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.2)',
          color: '#34C759', textDecoration: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 700,
        }}>⚡ Bolt</a>
      </div>
    </div>
  )
}
 
export default function DepartureBoard({ item, walkInfo, onClose, onGetMeHome }) {
  const [departures, setDepartures] = useState([])
  const [stationName, setStationName] = useState('')
  const [loading, setLoading]       = useState(false)
  const [source, setSource]         = useState(null) // 'nationalrail' | 'transitous' | 'placeholder'
 
  useEffect(() => {
    if (!item) return
    const isTransit = ['bus', 'bus_station', 'train', 'tram', 'metro', 'ferry', 'coach'].includes(item.type)
    if (!isTransit) return
 
    setLoading(true)
    setDepartures([])
 
    const load = async () => {
      // Try National Rail first for train stations
      if (item.type === 'train') {
        const crs = await getCRS(item.label) || await getCRS(item.name)
        if (crs) {
          const data = await fetchTrainDepartures(crs)
          if (data?.departures?.length > 0) {
            setDepartures(data.departures)
            setStationName(data.stationName)
            setSource('nationalrail')
            setLoading(false)
            return
          }
        }
      }
 
      // Try Transitous for buses/trams or if NR failed
      try {
        const deps = await fetchTransitousDepartures(item.label, item.lat, item.lon)
        if (deps?.length > 0) {
          setDepartures(deps)
          setSource('transitous')
          setLoading(false)
          return
        }
      } catch {}
 
      // Only show placeholder for bus stops, not train stations
      if (item.type !== 'train') {
        setDepartures(generatePlaceholder(item))
        setSource('placeholder')
      } else {
        setDepartures([])
        setSource('heritage')
      }
      setLoading(false)
    }
 
    load()
  }, [item])
 
  if (!item) return null
 
  const isTransit = ['bus', 'bus_station', 'train', 'tram', 'metro', 'ferry', 'coach'].includes(item.type)
  const isTaxi    = ['taxi', 'car_rental', 'car_share'].includes(item.type)
  const isHire    = ['cycle', 'scooter'].includes(item.type)
  const isTrain   = item.type === 'train' || item.type === 'heritage'
 
  const modeColors = {
    bus: 'var(--bus)', bus_station: 'var(--bus)', train: 'var(--train)', heritage: 'var(--orange)',
    tram: 'var(--coach)', metro: 'var(--cyan)', ferry: 'var(--ferry)',
    taxi: 'var(--taxi)', car_rental: 'var(--car)', cycle: 'var(--cycle)',
    scooter: 'var(--scooter)', coach: 'var(--coach)',
  }
  const modeColor = modeColors[item.type] || 'var(--text-primary)'
 
  const modeLabels = {
    bus: 'Bus Stop', bus_station: 'Bus Station', train: 'Railway Station', heritage: 'Heritage Railway',
    tram: 'Tram Stop', metro: 'Metro Station', ferry: 'Ferry Terminal',
    taxi: 'Taxi Rank', car_rental: 'Car Rental', car_share: 'Car Share',
    cycle: 'Cycle Hire', scooter: 'E-Scooter', coach: 'Coach Stop',
  }
  const modeLabel = modeLabels[item.type] || 'Transport'
 
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 800,
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)',
      }}/>
 
      <div style={{
        position: 'fixed', zIndex: 810,
        bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: 'min(480px, 100vw)',
        background: 'var(--surface-1)',
        border: '1px solid var(--border-default)', borderBottom: 'none',
        borderRadius: '16px 16px 0 0',
        maxHeight: '80vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 -16px 60px rgba(0,0,0,0.8)',
        animation: 'slideUp 0.25s var(--spring)',
      }}>
        {/* Handle */}
        <div style={{ padding: '10px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ width: '32px', height: '3px', borderRadius: '2px', background: 'var(--border-default)' }}/>
        </div>
 
        {/* Header */}
        <div style={{
          padding: '0 14px 12px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'flex-start', gap: '10px', flexShrink: 0,
        }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
            background: `${modeColor}15`, border: `1px solid ${modeColor}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
          }}>{item.icon}</div>
 
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: '16px', lineHeight: 1.2, marginBottom: '3px' }}>
              {stationName || item.label}
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '9px', color: modeColor,
                letterSpacing: '1.5px', padding: '2px 6px', borderRadius: '4px',
                background: `${modeColor}15`,
              }}>{modeLabel.toUpperCase()}</span>
 
              {walkInfo && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--live)',
                  fontWeight: 600, padding: '2px 8px', borderRadius: '4px',
                  background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.2)',
                }}>
                  🚶 {fmtWalk(walkInfo.distance)} walk from you
                </span>
              )}
 
              {source === 'nationalrail' && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--train)',
                  letterSpacing: '1px', padding: '2px 6px', borderRadius: '4px',
                  background: 'rgba(0,212,255,0.1)',
                }}>🇬🇧 NATIONAL RAIL LIVE</span>
              )}
            </div>
          </div>
 
          <button onClick={onClose} style={{
            width: '28px', height: '28px', borderRadius: '6px',
            background: 'var(--surface-2)', border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>×</button>
        </div>
 
        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
 
          {isTaxi && <TaxiPanel item={item}/>}
 
          {isHire && (
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>{item.network || item.label}</div>
              {item.capacity && (
                <div style={{
                  background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)',
                  borderRadius: '8px', padding: '10px 12px', marginBottom: '12px',
                }}>
                  <div style={{ fontSize: '22px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--cycle)' }}>
                    {item.capacity}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>bikes available</div>
                </div>
              )}
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Check operator app for real-time availability
              </div>
            </div>
          )}
 
          {isTransit && (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px',
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '2px' }}>
                  NEXT DEPARTURES
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--live)', animation: 'liveDot 1.5s infinite' }}/>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--live)' }}>LIVE</span>
                </div>
              </div>
 
              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[0,1,2,3].map(i => (
                    <div key={i} style={{
                      height: '48px', borderRadius: '6px',
                      background: 'linear-gradient(90deg, var(--surface-2), var(--surface-3), var(--surface-2))',
                      backgroundSize: '200% 100%', animation: `shimmer 1.5s ease ${i*0.1}s infinite`,
                    }}/>
                  ))}
                </div>
              )}
 
              {!loading && departures.length === 0 && (
                <div style={{
                  textAlign: 'center', padding: '24px',
                  fontFamily: 'var(--font-mono)', fontSize: '11px', lineHeight: 2,
                }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>🚂</div>
                  <div style={{ color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '6px', letterSpacing: '1px' }}>
                    NO LIVE DATA
                  </div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    Live departures unavailable for this station.<br/>
                    May be operated by a regional network<br/>
                    not covered by National Rail OpenData.
                  </div>
                  {item.operator && (
                    <div style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
                      Operator: {item.operator}
                    </div>
                  )}
                </div>
              )}
 
              {!loading && departures.map((dep, i) =>
                isTrain
                  ? <TrainRow key={i} dep={dep} idx={i}/>
                  : <BusRow   key={i} dep={dep} idx={i}/>
              )}
            </div>
          )}
        </div>
 
        {/* Get Me Home button */}
        {onGetMeHome && (
          <div style={{ padding: '10px 14px 14px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
            <button
              onClick={() => onGetMeHome(item)}
              style={{
                width: '100%', height: '46px', borderRadius: '9px', border: 'none',
                background: 'var(--amber)', color: '#000',
                fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 800,
                letterSpacing: '1px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
            >🏠 GET ME HOME FROM HERE</button>
          </div>
        )}
      </div>
    </>
  )
}
 
function generatePlaceholder(item) {
  const now = new Date()
  const routes = item.routes?.split(';').filter(Boolean) || ['—']
  return Array.from({ length: 5 }, (_, i) => {
    const t = new Date(now.getTime() + (i * 12 + Math.floor(Math.random() * 6) + 3) * 60000)
    return {
      line: routes[i % routes.length],
      destination: 'Town Centre',
      scheduledTime: t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      minutesUntil: Math.round((t - now) / 60000),
      color: item.type === 'train' ? '#00d4ff' : '#f59e0b',
      isPlaceholder: true,
    }
  })
}