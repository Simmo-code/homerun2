// TopBar v3 — collapsible top-left corner menu
import { useState } from 'react'

export default function TopBar({ from, scanState, onShare, onReset }) {
  const [open, setOpen] = useState(false)

  const isLive     = scanState === 'done' && from
  const isScanning = scanState === 'scanning'

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
            border: '1px solid var(--border-default)',
            color: 'var(--cyan)', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: '4px', flexShrink: 0,
            boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
          }}
        >
          {open ? (
            <span style={{ fontSize: '18px', lineHeight: 1 }}>✕</span>
          ) : (
            <>
              <div style={{ width: '16px', height: '2px', borderRadius: '1px', background: 'var(--cyan)' }}/>
              <div style={{ width: '16px', height: '2px', borderRadius: '1px', background: 'var(--cyan)' }}/>
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
            fontFamily: 'var(--font-ui)', fontWeight: 900, fontSize: '15px',
            letterSpacing: '3px', color: 'var(--cyan)', textTransform: 'uppercase',
            userSelect: 'none',
          }}>
            HOM<span style={{ color: 'var(--amber)' }}>E</span>RUN
          </span>

          {/* Status indicator */}
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
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 895 }}
          />

          {/* Menu panel */}
          <div style={{
            position: 'fixed', top: '58px', left: '10px', zIndex: 896,
            background: 'rgba(13,20,32,0.98)', backdropFilter: 'blur(20px)',
            border: '1px solid var(--border-default)',
            borderRadius: '12px', overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
            minWidth: '200px',
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

            {/* Menu items */}
            {[
              from && { icon: '🔄', label: 'Reset & Start Over', action: () => { onReset?.(); setOpen(false) }, color: '#ef4444' },
              { icon: '📤', label: 'Share Location', action: () => { onShare?.(); setOpen(false) } },
              { icon: '🏠', label: 'About HOMERUN', action: () => setOpen(false) },
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

            {/* Version */}
            <div style={{
              padding: '8px 14px',
              fontFamily: 'var(--font-mono)', fontSize: '9px',
              color: 'var(--text-muted)', letterSpacing: '1px',
            }}>
              HOMERUN v2.0 · Free &amp; Open
            </div>
          </div>
        </>
      )}
    </>
  )
}