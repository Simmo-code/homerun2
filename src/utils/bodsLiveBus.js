/**
 * BODS SIRI-VM Live Bus Positions
 * 
 * Queries the Bus Open Data Service (data.bus-data.dft.gov.uk) SIRI-VM endpoint
 * for real-time bus vehicle positions near a given location.
 * 
 * Uses Cloudflare Worker proxy to avoid CORS issues (BODS doesn't support CORS).
 * Proxy at: falling-sound-fa1a.simmo-justin.workers.dev/bods
 */

const BODS_API_KEY = '9cf4f123d9746c5548bacfdb612969675c732a09';
const BODS_PROXY_URL = 'https://falling-sound-fa1a.simmo-justin.workers.dev/bods';

// Cache for 30 seconds — bus positions update frequently
const busCache = new Map();
const CACHE_TTL_MS = 30_000;

/**
 * Create a bounding box around a lat/lon point.
 * BODS format: minLongitude, minLatitude, maxLongitude, maxLatitude
 */
function createBoundingBox(lat, lon, radiusKm = 2) {
  const latOffset = radiusKm / 111;
  const lonOffset = radiusKm / (111 * Math.cos(lat * Math.PI / 180));

  return [
    (lon - lonOffset).toFixed(6),
    (lat - latOffset).toFixed(6),
    (lon + lonOffset).toFixed(6),
    (lat + latOffset).toFixed(6),
  ].join(',');
}

/**
 * Fetch live bus positions from BODS SIRI-VM via Cloudflare Worker proxy.
 */
export async function fetchLiveBuses(lat, lon, radiusKm = 2) {
  const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)},${radiusKm}`;
  const cached = busCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const boundingBox = createBoundingBox(lat, lon, radiusKm);

  // BODS doesn't support CORS, so always use the Cloudflare Worker proxy
  let xmlText = null;
  try {
    xmlText = await fetchBodsViaProxy(boundingBox);
  } catch (err) {
    console.warn('[BODS] Proxy failed:', err.message);
    return [];
  }

  if (!xmlText) return [];

  const buses = parseSiriVmXml(xmlText, lat, lon);
  busCache.set(cacheKey, { data: buses, timestamp: Date.now() });
  return buses;
}

/**
 * BODS via Cloudflare Worker proxy.
 */
async function fetchBodsViaProxy(boundingBox) {
  const response = await fetch(BODS_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      boundingBox,
      apiKey: BODS_API_KEY,
    }),
  });

  if (!response.ok) {
    throw new Error(`BODS proxy HTTP ${response.status}`);
  }

  return response.text();
}

/**
 * Parse SIRI-VM XML response into structured bus position objects.
 */
function parseSiriVmXml(xmlText, centreLat, centreLon) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');

    const activities = doc.getElementsByTagName('VehicleActivity');
    if (!activities.length) {
      const nsActivities = doc.getElementsByTagNameNS('*', 'VehicleActivity');
      if (!nsActivities?.length) {
        console.debug('[BODS] No VehicleActivity elements found');
        return [];
      }
    }

    const buses = [];

    for (const activity of activities) {
      try {
        const bus = parseVehicleActivity(activity, centreLat, centreLon);
        if (bus) buses.push(bus);
      } catch (err) {
        console.debug('[BODS] Skipping malformed vehicle activity:', err.message);
      }
    }

    buses.sort((a, b) => a.distanceKm - b.distanceKm);
    console.log(`[BODS] Parsed ${buses.length} live bus positions`);
    return buses;
  } catch (err) {
    console.warn('[BODS] XML parse error:', err.message);
    return [];
  }
}

/**
 * Parse a single VehicleActivity element.
 */
function parseVehicleActivity(activity, centreLat, centreLon) {
  const getText = (parent, tagName) => {
    const el = parent.getElementsByTagName(tagName)[0] ||
               parent.querySelector(tagName) ||
               parent.getElementsByTagNameNS('*', tagName)[0];
    return el?.textContent?.trim() || null;
  };

  const recordedAt = getText(activity, 'RecordedAtTime');
  const lineRef = getText(activity, 'LineRef');
  const lineName = getText(activity, 'PublishedLineName') || lineRef;
  const direction = getText(activity, 'DirectionRef');
  const operatorRef = getText(activity, 'OperatorRef');
  const destinationName = getText(activity, 'DestinationName');
  const originName = getText(activity, 'OriginName');
  const vehicleRef = getText(activity, 'VehicleRef');
  const bearing = getText(activity, 'Bearing');
  const delayStr = getText(activity, 'Delay');

  const latStr = getText(activity, 'Latitude');
  const lonStr = getText(activity, 'Longitude');
  if (!latStr || !lonStr) return null;

  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);
  if (isNaN(lat) || isNaN(lon)) return null;

  const distanceKm = haversineDistance(centreLat, centreLon, lat, lon);
  const delayMinutes = parseIsoDuration(delayStr);

  const nextStopName = getText(activity, 'StopPointName');
  const aimedArrival = getText(activity, 'AimedArrivalTime');
  const expectedArrival = getText(activity, 'ExpectedArrivalTime');

  return {
    id: vehicleRef || `${lineRef}-${lat}-${lon}`,
    line: lineName,
    lineRef,
    direction: direction || null,
    operator: operatorRef || null,
    origin: originName || null,
    destination: destinationName || null,
    lat,
    lon,
    bearing: bearing ? parseFloat(bearing) : null,
    delayMinutes,
    delayText: formatDelay(delayMinutes),
    nextStop: nextStopName || null,
    aimedArrival: aimedArrival || null,
    expectedArrival: expectedArrival || null,
    recordedAt: recordedAt || null,
    distanceKm: Math.round(distanceKm * 100) / 100,
    distanceText: distanceKm < 1
      ? `${Math.round(distanceKm * 1000)}m away`
      : `${distanceKm.toFixed(1)}km away`,
    status: getStatusFromDelay(delayMinutes),
  };
}

function parseIsoDuration(durationStr) {
  if (!durationStr) return 0;
  const negative = durationStr.startsWith('-');
  const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  const totalMinutes = hours * 60 + minutes + Math.round(seconds / 60);
  return negative ? -totalMinutes : totalMinutes;
}

function formatDelay(delayMinutes) {
  if (delayMinutes === 0 || delayMinutes === null) return 'On time';
  if (delayMinutes < 0) return `${Math.abs(delayMinutes)} min early`;
  return `${delayMinutes} min late`;
}

function getStatusFromDelay(delayMinutes) {
  if (delayMinutes === null || delayMinutes === undefined) return 'unknown';
  if (delayMinutes <= 0) return 'on-time';
  if (delayMinutes <= 3) return 'on-time';
  if (delayMinutes <= 10) return 'delayed';
  return 'very-delayed';
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ============================================================================
// HIGHER-LEVEL FUNCTIONS
// ============================================================================

export async function fetchLiveBusesByLine(lat, lon, radiusKm = 2) {
  const buses = await fetchLiveBuses(lat, lon, radiusKm);
  const byLine = {};
  for (const bus of buses) {
    const key = bus.line || 'Unknown';
    if (!byLine[key]) byLine[key] = [];
    byLine[key].push(bus);
  }
  return byLine;
}

export async function matchBusesToStops(stops, centreLat, centreLon) {
  if (!stops?.length) return [];

  const buses = await fetchLiveBuses(centreLat, centreLon, 3);

  if (!buses.length) {
    return stops.map(stop => ({
      ...stop,
      liveBuses: [],
      liveStatus: 'no-data',
      liveMessage: 'No live bus data available',
    }));
  }

  return stops.map(stop => {
    const nearbyBuses = buses.filter(bus => {
      const distToStop = haversineDistance(bus.lat, bus.lon, stop.lat, stop.lon);
      return distToStop < 2;
    });

    const busesByLine = {};
    for (const bus of nearbyBuses) {
      const key = bus.line || 'Unknown';
      if (!busesByLine[key]) busesByLine[key] = [];
      busesByLine[key].push({
        ...bus,
        distanceToStop: haversineDistance(bus.lat, bus.lon, stop.lat, stop.lon),
      });
    }

    const liveBuses = Object.entries(busesByLine).map(([line, vehicles]) => {
      vehicles.sort((a, b) => a.distanceToStop - b.distanceToStop);
      const closest = vehicles[0];
      return {
        line,
        destination: closest.destination,
        distanceToStop: closest.distanceToStop,
        estimatedMinutes: estimateArrivalMinutes(closest.distanceToStop),
        delayMinutes: closest.delayMinutes,
        status: closest.status,
        vehicleCount: vehicles.length,
      };
    });

    liveBuses.sort((a, b) => a.estimatedMinutes - b.estimatedMinutes);

    return {
      ...stop,
      liveBuses,
      liveStatus: liveBuses.length > 0 ? 'live' : 'no-nearby-buses',
      liveMessage: liveBuses.length > 0
        ? `${liveBuses.length} bus line${liveBuses.length > 1 ? 's' : ''} nearby`
        : 'No buses detected nearby',
    };
  });
}

function estimateArrivalMinutes(distanceKm) {
  const avgSpeedKmh = 20;
  return Math.max(1, Math.round((distanceKm / avgSpeedKmh) * 60));
}

export function clearBusCache() {
  busCache.clear();
}

export default {
  fetchLiveBuses,
  fetchLiveBusesByLine,
  matchBusesToStops,
  clearBusCache,
};
