// TopBar v2 — with reset button
export default function TopBar({ from, scanState, onShare, onSidebarToggle, onReset }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: '44px', zIndex: 900,
      background: 'rgba(13,20,32,0.97)', backdropFilter: 'blur(14px)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex', alignItems: 'center', padding: '0 10px', gap: '8px',
    }}>
      {/* Logo */}
      <div style={{
        fontFamily: 'var(--font-ui)', fontWeight: 900, fontSize: '18px',
        letterSpacing: '3px', color: 'var(--cyan)', textTransform: 'uppercase',
        userSelect: 'none', flexShrink: 0,
      }}>
        HOM<span style={{ color: 'var(--amber)' }}>E</span>RUN
      </div>

      <div style={{ width: '1px', height: '18px', background: 'var(--border-default)', flexShrink: 0 }}/>

      {/* Scan status */}
      {scanState === 'scanning' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <div style={{
            width: '8px', height: '8px',
            border: '2px solid var(--cyan)', borderTopColor: 'transparent',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite',
          }}/>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--cyan)', letterSpacing: '2px' }}>
            SCANNING
          </span>
        </div>
      )}

      {scanState === 'done' && from && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--live)', animation: 'liveDot 2s infinite' }}/>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 600, color: 'var(--live)' }}>LIVE</span>
        </div>
      )}

      <div style={{ flex: 1 }}/>

      {/* Coordinates */}
      {from && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', flexShrink: 0 }}>
          {from.lat.toFixed(4)}°&nbsp;{from.lon.toFixed(4)}°
        </div>
      )}

      {/* Reset button — only shown when location is set */}
      {from && (
        <button
          onClick={onReset}
          title="Reset and start new search"
          style={{
            height: '28px', padding: '0 10px', borderRadius: '5px', flexShrink: 0,
            border: '1px solid rgba(255,100,100,0.35)',
            background: 'rgba(255,100,100,0.08)',
            color: '#ff8080', cursor: 'pointer',
            fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: '4px',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,100,100,0.16)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,100,100,0.08)' }}
        >↺ Reset</button>
      )}

      {/* Share button */}
      <button
        onClick={onShare}
        style={{
          height: '28px', padding: '0 10px', borderRadius: '5px', flexShrink: 0,
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