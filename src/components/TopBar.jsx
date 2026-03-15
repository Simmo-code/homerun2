// TopBar v2 — minimal strip with scan status
export default function TopBar({ from, scanState, onShare, onSidebarToggle, onReset }) {
  const scanLabel = {
    idle:     null,
    scanning: 'SCANNING…',
    done:     'SCAN COMPLETE',
  }[scanState]

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: '44px', zIndex: 900,
      background: 'rgba(6,9,15,0.94)', backdropFilter: 'blur(14px)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex', alignItems: 'center', padding: '0 10px', gap: '8px',
    }}>
      <button
        onClick={onSidebarToggle}
        style={{
          width: '30px', height: '30px', borderRadius: '6px',
          background: 'transparent', border: '1px solid var(--border-subtle)',
          color: 'var(--text-secondary)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
        }}
      >
        <svg width="13" height="10" viewBox="0 0 13 10" fill="currentColor">
          <rect width="13" height="1.5" rx="0.75"/>
          <rect y="4" width="9" height="1.5" rx="0.75"/>
          <rect y="8" width="13" height="1.5" rx="0.75"/>
        </svg>
      </button>

      <div style={{
        fontFamily: 'var(--font-ui)', fontWeight: 900, fontSize: '17px',
        letterSpacing: '3px', color: 'var(--cyan)', textTransform: 'uppercase',
        userSelect: 'none',
      }}>
        HOM<span style={{ color: 'var(--amber)' }}>E</span>RUN
      </div>

      <div style={{ width: '1px', height: '18px', background: 'var(--border-subtle)' }}/>

      {/* Scan status */}
      {scanState === 'scanning' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            border: '2px solid var(--cyan)', borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite',
          }}/>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--cyan)', letterSpacing: '2px' }}>
            DEEP SCANNING
          </span>
        </div>
      )}

      {scanState === 'done' && from && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--live)', animation: 'liveDot 2s infinite' }}/>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 600, color: 'var(--live)' }}>LIVE</span>
        </div>
      )}

      <div style={{ flex: 1 }}/>

      {/* Coordinates */}
      {from && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)' }}>
          {from.lat.toFixed(4)}°&nbsp;{from.lon.toFixed(4)}°
        </div>
      )}

      <button
        onClick={onShare}
        style={{
          height: '28px', padding: '0 10px', borderRadius: '5px',
          border: '1px solid var(--border-default)', background: 'var(--surface-1)',
          color: 'var(--text-secondary)', cursor: 'pointer',
          fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--cyan)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-default)' }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
        Share
      </button>
    </div>
  )
}
