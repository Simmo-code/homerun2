// useTrainDepartures.js — Live National Rail departures via OpenLDBWS
// Uses Darwin/OpenLDBWS SOAP API with CORS proxy

const LDB_TOKEN = 'b31e1e8a-6917-4c79-a160-ff7912e1329d'

// Station CRS codes for common South England stations
// Used to match Overpass station names to CRS codes
const STATION_CRS = {
  'grateley': 'GRT',
  'andover': 'ADV',
  'winchester': 'WIN',
  'southampton central': 'SOU',
  'southampton airport': 'SOA',
  'portsmouth': 'PMS',
  'portsmouth harbour': 'PMH',
  'portsmouth & southsea': 'PMS',
  'havant': 'HAV',
  'chichester': 'CCH',
  'worthing': 'WRH',
  'brighton': 'BTN',
  'gatwick airport': 'GTW',
  'crawley': 'CRW', 
  'three bridges': 'TBD',
  'horsham': 'HRH',
  'guildford': 'GLD',
  'woking': 'WOK',
  'basingstoke': 'BSK',
  'farnham': 'FNH',
  'alton': 'AON',
  'petersfield': 'PTR',
  'haslemere': 'HSL',
  'godalming': 'GOD',
  'liphook': 'LPH',
  'liss': 'LIS',
  'rowlands castle': 'RLO',
  'emsworth': 'EMS',
  'bosham': 'BOH',
  'fishbourne': 'FIS',
  'barnham': 'BAA',
  'ford': 'FOD',
  'arundel': 'ARU',
  'amberley': 'AMB',
  'pulborough': 'PUL',
  'billingshurst': 'BIG',
  'christs hospital': 'CHH',
  'london victoria': 'VIC',
  'london waterloo': 'WAT',
  'london paddington': 'PAD',
  'london bridge': 'LBG',
  'london charing cross': 'CHX',
  'clapham junction': 'CLJ',
  'east croydon': 'ECR',
  'surbiton': 'SRB',
  'wimbledon': 'WIM',
  'fareham': 'FRM',
  'eastleigh': 'ESL',
  'botley': 'BOE',
  'hedge end': 'HDE',
  'bursledon': 'BUO',
  'hamble': 'HME',
  'netley': 'NTL',
  'sholing': 'SHO',
  'bitterne': 'BTE',
  'st denys': 'SDN',
  'swaythling': 'SWG',
  'southampton airport parkway': 'SOA',
  'chandlers ford': 'CFD',
  'romsey': 'ROM',
  'salisbury': 'SAL',
  'tisbury': 'TIS',
  'gillingham': 'GIG',
  'templecombe': 'TMC',
  'yeovil junction': 'YVJ',
  'dorchester': 'DCH',
  'weymouth': 'WEY',
  'bournemouth': 'BMH',
  'poole': 'POO',
  'christchurch': 'CHR',
  'new milton': 'NWM',
  'hinton admiral': 'HNA',
  'brockenhurst': 'BCU',
  'beaulieu road': 'BEU',
  'ashurst': 'AHS',
  'totton': 'TTN',
  'redbridge': 'RDB',
  'millbrook': 'MBK',
}

// Find CRS code from station name
export function getCRS(stationName) {
  if (!stationName) return null
  const lower = stationName.toLowerCase()
    .replace(' station', '')
    .replace(' railway station', '')
    .replace(' rail station', '')
    .trim()
  
  // Direct match
  if (STATION_CRS[lower]) return STATION_CRS[lower]
  
  // Partial match
  for (const [key, crs] of Object.entries(STATION_CRS)) {
    if (lower.includes(key) || key.includes(lower)) return crs
  }
  
  return null
}

// Fetch live departures using OpenLDBWS SOAP API
// Uses a CORS-friendly approach via the public proxy
export async function fetchTrainDepartures(crs, numRows = 6) {
  if (!crs) return null

  // OpenLDBWS SOAP request
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
          <ldb:crs>${crs.toUpperCase()}</ldb:crs>
        </ldb:GetDepartureBoardRequest>
      </soap:Body>
    </soap:Envelope>
  `.trim()

  // OpenLDBWS endpoint — needs CORS proxy for browser use
  // Using corsproxy.io as it's reliable and free
  const endpoint = 'https://corsproxy.io/?' + encodeURIComponent(
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
    return parseSOAPResponse(xml, crs)
  } catch (err) {
    console.warn(`Train departures failed for ${crs}:`, err)
    return null
  }
}

function parseSOAPResponse(xml, crs) {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, 'text/xml')

    // Check for fault
    const fault = doc.querySelector('faultstring')
    if (fault) throw new Error(fault.textContent)

    // Station name
    const stationName = doc.querySelector('locationName')?.textContent || crs

    // Get all train services
    const services = [...doc.querySelectorAll('trainServices service')]

    const departures = services.map(svc => {
      const std    = svc.querySelector('std')?.textContent   // scheduled time
      const etd    = svc.querySelector('etd')?.textContent   // estimated time
      const platform = svc.querySelector('platform')?.textContent
      const dest   = svc.querySelector('destination location destination')?.textContent ||
                     svc.querySelector('destination location')?.textContent
      const operator = svc.querySelector('operator')?.textContent
      const serviceID = svc.querySelector('serviceID')?.textContent
      const cancelled = svc.querySelector('isCancelled')?.textContent === 'true'
      const delayReason = svc.querySelector('delayReason')?.textContent

      // Calculate minutes until departure
      let minutesUntil = null
      if (std) {
        const [h, m] = std.split(':').map(Number)
        const now = new Date()
        const dep = new Date(now)
        dep.setHours(h, m, 0, 0)
        if (dep < now) dep.setDate(dep.getDate() + 1)
        minutesUntil = Math.round((dep - now) / 60000)
      }

      // Is it delayed?
      const isDelayed = etd && etd !== 'On time' && etd !== std && !cancelled
      const displayTime = etd && etd !== 'On time' ? etd : std

      return {
        line:          null, // trains don't have line numbers
        route:         null,
        destination:   dest || 'Unknown',
        scheduledTime: std,
        estimatedTime: etd,
        displayTime,
        platform:      platform || null,
        operator:      operator || '',
        cancelled,
        delayed:       isDelayed,
        delayReason,
        minutesUntil,
        color:         cancelled ? '#ef4444' : isDelayed ? '#f59e0b' : '#00d4ff',
        serviceID,
      }
    })

    return {
      stationName,
      crs,
      departures,
      generatedAt: new Date().toISOString(),
    }

  } catch (err) {
    console.warn('SOAP parse error:', err)
    return null
  }
}