// ToastStack
import { buildShareUrl } from '../utils/api'

export function ToastStack({ toasts }) {
  if (!toasts.length) return null
  return (
    <div style={{
      position: 'fixed', zIndex: 9999,
      bottom: 'calc(var(--panel-h) + 70px)',
      left: '50%', transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column-reverse', gap: '6px',
      pointerEvents: 'none', alignItems: 'center',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: 'rgba(9,13,24,0.97)', backdropFilter: 'blur(12px)',
          border: '1px solid var(--border-default)',
          borderRadius: '8px', padding: '9px 16px',
          fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600,
          color: t.type === 'error' ? 'var(--dead)' : t.type === 'success' ? 'var(--live)' : 'var(--text-primary)',
          whiteSpace: 'nowrap', boxShadow: '0 6px 24px rgba(0,0,0,0.6)',
          animation: 'toastIn 0.2s ease, toastOut 0.2s ease 2.5s forwards',
        }}>{t.message}</div>
      ))}
    </div>
  )
}

// SharePanel
export function SharePanel({ from, to, onClose, showToast }) {
  const url = buildShareUrl(from, to)
  const copy = async () => { await navigator.clipboard?.writeText(url); showToast('🔗 Link copied!', 'success') }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed',inset:0,zIndex:850,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(3px)' }}/>
      <div style={{
        position:'fixed',zIndex:860,bottom:0,left:'50%',transform:'translateX(-50%)',
        width:'min(440px,100vw)',background:'var(--surface-1)',
        border:'1px solid var(--border-default)',borderBottom:'none',
        borderRadius:'16px 16px 0 0',padding:'16px 18px 28px',
        boxShadow:'0 -12px 50px rgba(0,0,0,0.8)',animation:'slideUp 0.2s var(--spring)',
      }}>
        <div style={{width:'32px',height:'3px',borderRadius:'2px',background:'var(--border-default)',margin:'0 auto 16px'}}/>
        <div style={{fontFamily:'var(--font-ui)',fontSize:'17px',fontWeight:800,marginBottom:'14px'}}>📤 Share Journey</div>
        <div onClick={copy} style={{
          background:'var(--surface-0)',border:'1px solid var(--border-default)',borderRadius:'7px',
          padding:'10px 12px',fontFamily:'var(--font-mono)',fontSize:'10px',color:'var(--text-secondary)',
          wordBreak:'break-all',cursor:'pointer',marginBottom:'12px',lineHeight:1.5,
        }}>
          {url} <span style={{color:'var(--cyan)'}}>⎘ copy</span>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:'7px',marginBottom:'14px'}}>
          {from && to && <>
            <a href={`https://www.google.com/maps/dir/${from.lat},${from.lon}/${to.lat},${to.lon}`} target="_blank" rel="noreferrer"
              style={{height:'46px',borderRadius:'8px',border:'1px solid var(--border-default)',background:'var(--surface-2)',color:'var(--text-primary)',textDecoration:'none',display:'flex',alignItems:'center',gap:'10px',padding:'0 14px',fontFamily:'var(--font-ui)',fontSize:'14px',fontWeight:600}}>
              🗺️ Open in Google Maps
            </a>
            <a href={`https://citymapper.com/directions?startcoord=${from.lat},${from.lon}&endcoord=${to.lat},${to.lon}`} target="_blank" rel="noreferrer"
              style={{height:'46px',borderRadius:'8px',border:'1px solid var(--border-default)',background:'var(--surface-2)',color:'var(--text-primary)',textDecoration:'none',display:'flex',alignItems:'center',gap:'10px',padding:'0 14px',fontFamily:'var(--font-ui)',fontSize:'14px',fontWeight:600}}>
              🚇 Open in Citymapper
            </a>
          </>}
          {from && <button onClick={() => { navigator.clipboard?.writeText(`${from.lat.toFixed(6)}, ${from.lon.toFixed(6)}`); showToast('📍 Coords copied') }}
            style={{height:'46px',borderRadius:'8px',border:'1px solid var(--border-default)',background:'var(--surface-2)',color:'var(--text-primary)',cursor:'pointer',display:'flex',alignItems:'center',gap:'10px',padding:'0 14px',fontFamily:'var(--font-ui)',fontSize:'14px',fontWeight:600}}>
            📍 Copy coordinates
          </button>}
          {from && <a href={`sms:?body=${encodeURIComponent(`I landed at: ${from?.name}\n${url}`)}`}
            style={{height:'46px',borderRadius:'8px',border:'1px solid var(--border-default)',background:'var(--surface-2)',color:'var(--text-primary)',textDecoration:'none',display:'flex',alignItems:'center',gap:'10px',padding:'0 14px',fontFamily:'var(--font-ui)',fontSize:'14px',fontWeight:600}}>
            💬 Send via SMS
          </a>}
          {from && <a href={`sms:?body=${encodeURIComponent(`🆘 EMERGENCY — I need help!\nI'm at: ${from?.name}\nCoords: ${from?.lat?.toFixed(5)}, ${from?.lon?.toFixed(5)}\n${url}`)}`}
            style={{height:'46px',borderRadius:'8px',border:'1px solid rgba(239,68,68,0.3)',background:'rgba(239,68,68,0.07)',color:'var(--dead)',textDecoration:'none',display:'flex',alignItems:'center',gap:'10px',padding:'0 14px',fontFamily:'var(--font-ui)',fontSize:'14px',fontWeight:700}}>
            🆘 SOS — Send location
          </a>}
        </div>
        <button onClick={onClose} style={{width:'100%',height:'42px',borderRadius:'8px',border:'1px solid var(--border-default)',background:'transparent',color:'var(--text-secondary)',cursor:'pointer',fontFamily:'var(--font-ui)',fontSize:'14px',fontWeight:600}}>Close</button>
      </div>
    </>
  )
}
