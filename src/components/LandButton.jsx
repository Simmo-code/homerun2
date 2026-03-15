// LandButton — "I Landed Here" primary GPS button
// Floats above the bottom panel on the map

export default function LandButton({ onLand, hasLocation, scanning }) {
  if (hasLocation) return null // hide once location is set

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(var(--panel-h) + 14px)',
      left: '50%', transform: 'translateX(-50%)',
      zIndex: 600,
    }}>
      <button
        onClick={onLand}
        disabled={scanning}
        style={{
          height: '56px', padding: '0 28px',
          borderRadius: '28px',
          background: scanning
            ? 'rgba(0,229,255,0.08)'
            : 'rgba(0,229,255,0.12)',
          border: '2px solid var(--cyan)',
          color: 'var(--cyan)',
          cursor: scanning ? 'default' : 'pointer',
          fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: 800,
          letterSpacing: '2px', textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', gap: '10px',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 0 30px rgba(0,229,255,0.15), 0 4px 20px rgba(0,0,0,0.4)',
          transition: 'all 0.2s',
          position: 'relative', overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        {/* Animated scan line */}
        {!scanning && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.08), transparent)',
            animation: 'shimmer 2s ease infinite',
            backgroundSize: '200% 100%',
          }}/>
        )}

        {scanning ? (
          <>
            <div style={{
              width: '16px', height: '16px',
              border: '2.5px solid var(--cyan)', borderTopColor: 'transparent',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0,
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
    </div>
  )
}
