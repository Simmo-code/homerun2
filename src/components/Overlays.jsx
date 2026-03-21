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

  // Build a readable address string from from.name (Nominatim returns "road, suburb, city, postcode, England")
  const addressText = from?.name || ''
  const shareMsg = [
    `🪂 I've landed and need a lift home!`,
    ``,
    `📍 Location: ${addressText || `${from?.lat?.toFixed(5)}, ${from?.lon?.toFixed(5)}`}`,
    `🗺️ Track me: ${url}`,
    ``,
    `(Tap the link to see my location on a map)`
  ].join('\n')
  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareMsg)}`
  const messengerUrl = `fb-messenger://share?link=${encodeURIComponent(url)}`

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
        <div style={{
          background:'var(--surface-0)',border:'1px solid var(--border-default)',borderRadius:'10px',
          padding:'12px 14px',marginBottom:'12px',
        }}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'10px'}}>
            <div>
              <div style={{fontFamily:'var(--font-ui)',fontSize:'13px',fontWeight:700,color:'var(--cyan)',marginBottom:'4px'}}>📍 Landing location</div>
              <div style={{fontFamily:'var(--font-ui)',fontSize:'14px',color:'var(--text-primary)',lineHeight:1.5}}>
                {from?.name && !/^-?\d+\.\d+,\s*-?\d+/.test(from.name)
                  ? from.name
                  : <span style={{color:'var(--text-secondary)',fontSize:'12px'}}>Waiting for address… (tap map to set location)</span>
                }
              </div>
            </div>
            <button onClick={copy} style={{
              flexShrink:0,height:'34px',padding:'0 12px',borderRadius:'6px',
              border:'1px solid var(--border-default)',background:'var(--surface-2)',
              color:'var(--cyan)',cursor:'pointer',fontFamily:'var(--font-ui)',fontSize:'12px',fontWeight:700
            }}>⎘ Copy link</button>
          </div>
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
          {from && <a href={`https://www.google.com/maps?q=${from.lat},${from.lon}`} target="_blank" rel="noreferrer"
            style={{height:'46px',borderRadius:'8px',border:'1px solid rgba(66,133,244,0.3)',background:'rgba(66,133,244,0.07)',color:'#4285f4',textDecoration:'none',display:'flex',alignItems:'center',gap:'10px',padding:'0 14px',fontFamily:'var(--font-ui)',fontSize:'14px',fontWeight:600}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#4285f4"/></svg>
            Open in Google Maps
          </a>}
          {from && <button onClick={() => { navigator.clipboard?.writeText(`${from.lat.toFixed(6)}, ${from.lon.toFixed(6)}`); showToast('📍 Coords copied') }}
            style={{height:'46px',borderRadius:'8px',border:'1px solid var(--border-default)',background:'var(--surface-2)',color:'var(--text-primary)',cursor:'pointer',display:'flex',alignItems:'center',gap:'10px',padding:'0 14px',fontFamily:'var(--font-ui)',fontSize:'14px',fontWeight:600}}>
            📍 Copy coordinates
          </button>}
          {from && <a href={`sms:?body=${encodeURIComponent(shareMsg)}`}
            style={{height:'46px',borderRadius:'8px',border:'1px solid var(--border-default)',background:'var(--surface-2)',color:'var(--text-primary)',textDecoration:'none',display:'flex',alignItems:'center',gap:'10px',padding:'0 14px',fontFamily:'var(--font-ui)',fontSize:'14px',fontWeight:600}}>
            💬 Send via SMS
          </a>}
          {from && <a href={waUrl} target="_blank" rel="noreferrer"
            style={{height:'46px',borderRadius:'8px',border:'1px solid rgba(37,211,102,0.3)',background:'rgba(37,211,102,0.07)',color:'#25d366',textDecoration:'none',display:'flex',alignItems:'center',gap:'10px',padding:'0 14px',fontFamily:'var(--font-ui)',fontSize:'14px',fontWeight:600}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Share via WhatsApp
          </a>}
          {from && <a href={messengerUrl} target="_blank" rel="noreferrer"
            style={{height:'46px',borderRadius:'8px',border:'1px solid rgba(0,132,255,0.3)',background:'rgba(0,132,255,0.07)',color:'#0084ff',textDecoration:'none',display:'flex',alignItems:'center',gap:'10px',padding:'0 14px',fontFamily:'var(--font-ui)',fontSize:'14px',fontWeight:600}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#0084ff"><path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.652V24l4.088-2.242c1.092.301 2.246.464 3.443.464 6.627 0 12-4.974 12-11.111S18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8l3.131 3.26L19.752 8l-6.561 6.963z"/></svg>
            Share via Messenger
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
