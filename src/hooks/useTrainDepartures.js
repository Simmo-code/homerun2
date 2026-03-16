// useTrainDepartures.js — Live National Rail departures
// Dynamic CRS lookup covering ALL stations in England & Wales

const LDB_TOKEN = 'b31e1e8a-6917-4c79-a160-ff7912e1329d'
const STATIONS_URL = 'https://raw.githubusercontent.com/davwheat/uk-railway-stations/main/stations.json'

// Cache the stations list
let stationsCache = null
let stationsLoading = null

async function getStations() {
  if (stationsCache) return stationsCache
  if (stationsLoading) return stationsLoading

  stationsLoading = fetch(STATIONS_URL)
    .then(r => r.json())
    .then(data => {
      stationsCache = data
      stationsLoading = null
      return data
    })
    .catch(() => {
      stationsLoading = null
      return []
    })

  return stationsLoading
}

export async function getCRS(stationName) {
  if (!stationName) return null

  const clean = stationName.toLowerCase()
    .replace(/ station$/i, '')
    .replace(/ railway station$/i, '')
    .replace(/ rail station$/i, '')
    .replace(/ \(.*\)$/, '')
    .trim()

  const stations = await getStations()

  // Exact match first
  const exact = stations.find(s =>
    s.stationName.toLowerCase() === clean
  )
  if (exact) return exact.crsCode

  // Partial match
  const partial = stations.find(s =>
    s.stationName.toLowerCase().includes(clean) ||
    clean.includes(s.stationName.toLowerCase())
  )
  if (partial) return partial.crsCode

  return null
}

export async function findNearestStation(lat, lon, radiusKm = 2) {
  const stations = await getStations()
  let nearest = null
  let nearestDist = Infinity

  stations.forEach(s => {
    const d = haversine(lat, lon, s.lat, s.long)
    if (d < nearestDist) {
      nearestDist = d
      nearest = { ...s, distKm: d / 1000 }
    }
  })

  if (nearest && nearest.distKm <= radiusKm) return nearest
  return null
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

export async function fetchTrainDepartures(crs, numRows = 8) {
  if (!crs) return null

  const soapBody = `
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:typ="http://thalesgroup.com/RTTI/2013-11-28/Token/types"
               xmlns:ldb="http://thalesgroup.com/RTTI/2021-11-01/ldb/">
  <soap:Header>
    <typ:AccessToken>
      <typ:TokenValue>${LDB_TOKEN}</typ:TokenValue>
    </typ:AccessToken>
  </soap:Header>
  <soap:Body>
    <ldb:GetDepartureBoardRequest>
      <ldb:numRows>${numRows}</ldb:numRows>
      <ldb:crs>${(crs || "").toUpperCase()}</ldb:crs>
    </ldb:GetDepartureBoardRequest>
  </soap:Body>
</soap:Envelope>`.trim()

    if (!crs) return null

  const endpoint = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(
    'https://lite.realtime.nationalrail.co.uk/OpenLDBWS/ldb12.asmx'
  )

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://thalesgroup.com/RTTI/2012-01-13/ldb/GetDepartureBoard',
      },
      body: soapBody,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const xml = await res.text()
    return parseSOAP(xml, crs)
  } catch (err) {
    console.warn(`Train departures failed for ${crs}:`, err)
    return null
  }
}

function parseSOAP(xml, crs) {
  try {
    const doc = new DOMParser().parseFromString(xml, 'text/xml')
    const fault = doc.querySelector('faultstring')
    if (fault) throw new Error(fault.textContent)

    // Helper to get text from namespaced elements
    const getText = (el, tag) => {
      const found = el.getElementsByTagNameNS('*', tag)
      return found.length > 0 ? found[0].textContent : null
    }

    const stationName = getText(doc, 'locationName') || crs
    const services = [...doc.getElementsByTagNameNS('*', 'service')]

    const departures = services.map(svc => {
      const std      = getText(svc, 'std')
      const etd      = getText(svc, 'etd')
      const platform = getText(svc, 'platform')
      const destEls  = svc.getElementsByTagNameNS('*', 'destination')
      const dest     = destEls.length > 0
        ? getText(destEls[0], 'locationName')
        : null
      const operator    = getText(svc, 'operator')
      const cancelled   = getText(svc, 'isCancelled') === 'true'
      const delayReason = getText(svc, 'delayReason')

      let minutesUntil = null
      if (std) {
        const [h, m] = std.split(':').map(Number)
        const now = new Date()
        const dep = new Date(now)
        dep.setHours(h, m, 0, 0)
        if (dep < now) dep.setDate(dep.getDate() + 1)
        minutesUntil = Math.round((dep - now) / 60000)
      }

      const isDelayed = etd && etd !== 'On time' && etd !== std && !cancelled
      const displayTime = etd && etd !== 'On time' ? etd : std

      return {
        destination: dest || 'Unknown',
        scheduledTime: std,
        estimatedTime: etd,
        displayTime,
        platform: platform || null,
        operator: operator || '',
        cancelled,
        delayed: isDelayed,
        delayReason,
        minutesUntil,
        color: cancelled ? '#ef4444' : isDelayed ? '#f59e0b' : '#00d4ff',
      }
    })

    return { 
      stationName, 
      crs, 
      departures,
      isHeritage: departures.length === 0
    }
  } catch (err) {
    console.warn('SOAP parse error:', err)
    return null
  }
}
