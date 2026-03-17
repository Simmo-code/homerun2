// transitousDepartures.js — Live bus/train departures via Transitous
// Works for all of Great Britain using stop name geocoding

const BASE = 'https://api.transitous.org/api/v1'

// Cache stop IDs to avoid repeated geocode calls
const stopIdCache = {}

async function getStopId(name, lat, lon) {
  const key = name.toLowerCase().trim()
  if (stopIdCache[key]) return stopIdCache[key]

  try {
    const url = `${BASE}/geocode?text=${encodeURIComponent(key)}&lang=en`
    const res = await fetch(url)
    const data = await res.json()

    // Find closest STOP type result to our coordinates
    const stops = data.filter(d => d.type === 'STOP')
    if (!stops.length) return null

    // Pick closest to our lat/lon
    const closest = stops.reduce((best, s) => {
      const d = Math.hypot(s.lat - lat, s.lon - lon)
      const bd = Math.hypot(best.lat - lat, best.lon - lon)
      return d < bd ? s : best
    })

    stopIdCache[key] = closest.id
    return closest.id
  } catch {
    return null
  }
}

export async function fetchTransitousDepartures(name, lat, lon, n = 6) {
  try {
    const stopId = await getStopId(name, lat, lon)
    if (!stopId) return null

    const now = new Date()
    const datetime = now.toISOString().slice(0, 19)
    const url = `${BASE}/stoptimes?stopId=${encodeURIComponent(stopId)}&datetime=${datetime}&n=${n}`
    const res = await fetch(url)
    const data = await res.json()

    if (data.error || !data.stopTimes) return null

    return data.stopTimes.map(st => {
      const dep = new Date(st.place.scheduledDeparture)
      const actual = new Date(st.place.departure)
      const now2 = new Date()
      const minutesUntil = Math.round((dep - now2) / 60000)
      const isDelayed = actual > dep && (actual - dep) > 60000
      const cancelled = st.place.cancelled

      return {
        line:          st.route?.shortName || st.headsign?.split(' ')[0] || '—',
        destination:   st.headsign || 'Unknown',
        scheduledTime: dep.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        estimatedTime: actual.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        displayTime:   dep.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        platform:      st.place.scheduledTrack || null,
        minutesUntil,
        delayed:       isDelayed,
        cancelled,
        realTime:      st.realTime,
        mode:          st.mode,
        alerts:        st.place.alerts || [],
        color:         st.mode === 'REGIONAL_RAIL' ? '#00d4ff' :
                       st.mode === 'BUS' ? '#f59e0b' :
                       st.mode === 'TRAM' ? '#ec4899' : '#f59e0b',
      }
    })
  } catch (err) {
    console.warn('Transitous departures failed:', err)
    return null
  }
}
