/**
 * BODS SIRI-VM Live Bus Positions
 * 
 * Queries the Bus Open Data Service (data.bus-data.dft.gov.uk) SIRI-VM endpoint
 * for real-time bus vehicle positions near a given location.
 * 
 * This uses the SAME BODS API key already obtained for timetable data.
 * The SIRI-VM endpoint returns live vehicle positions, bearing, delay,
 * and route info for most buses in England outside London.
 * 
 * For London buses, use TfL API instead (separate module).
 * 
 * NOTE: BODS SIRI-VM responses are XML. We parse client-side since the
 * responses are typically not blocked by CORS when using the API key.
 * If CORS becomes an issue, route through the Cloudflare Worker.
 */

const BODS_API_KEY = '9cf4f123d9746c5548bacfdb612969675c732a09';
const BODS_BASE_URL = 'https://data.bus-data.dft.gov.uk/api/v1/datafeed/';

// Use Cloudflare Worker proxy if direct BODS calls hit CORS issues
const BODS_PROXY_URL = 'https://falling-sound-fa1a.simmo-justin.workers.dev/bods';

// Cache for 30 seconds — bus positions update frequently
const busCache = new Map();
const CACHE_TTL_MS = 30_000;

/**
 * Create a bounding box around a lat/lon point.
 * @param {number} lat
 * @param {number} lon
 * @param {number} radiusKm - Radius in kilometres (default 2km)
 * @returns {string} "minLat,minLon,maxLat,maxLon"
 */
function createBoundingBox(lat, lon, radiusKm = 2) {
  // Rough conversion: 1 degree lat ≈ 111km, 1 degree lon ≈ 111km * cos(lat)
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
 * Fetch live bus positions from BODS SIRI-VM.
 * 
 * Tries direct API first, falls back to Cloudflare Worker proxy if CORS blocked.
 * 
 * @param {number} lat - Centre latitude
 * @param {number} lon - Centre longitude
 * @param {number} radiusKm - Search radius in km (default 2)
 * @returns {Array} Array of bus position objects
 */
export async function fetchLiveBuses(lat, lon, radiusKm = 2) {
  const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)},${radiusKm}`;
  const cached = busCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const boundingBox = createBoundingBox(lat, lon, radiusKm);

  // Try direct BODS API first
  let xmlText = null;
  try {
    xmlText = await fetchBodsDirect(boundingBox);
  } catch (err) {
    console.warn('[BODS] Direct API failed, trying proxy:', err.message);
    try {
      xmlText = await fetchBodsViaProxy(boundingBox);
    } catch (proxyErr) {
      console.warn('[BODS] Proxy also failed:', proxyErr.message);
      return [];
    }
  }

  if (!xmlText) return [];

  const buses = parseSiriVmXml(xmlText, lat, lon);
  busCache.set(cacheKey, { data: buses, timestamp: Date.now() });
  return buses;
}

/**
 * Direct BODS API call.
 */
async function fetchBodsDirect(boundingBox) {
  const url = `${BODS_BASE_URL}?api_key=${BODS_API_KEY}&boundingBox=${boundingBox}`;

  const response = await fetch(url, {
    headers: {
      'Accept': 'text/xml',
    },
  });

  if (!response.ok) {
    throw new Error(`BODS HTTP ${response.status}`);
  }

  return response.text();
}

/**
 * BODS via Cloudflare Worker proxy (if CORS blocks direct).
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
 * 
 * SIRI-VM structure (simplified):
 *   <VehicleActivity>
 *     <RecordedAtTime>2025-01-15T14:23:00Z</RecordedAtTime>
 *     <MonitoredVehicleJourney>
 *       <LineRef>47</LineRef>
 *       <DirectionRef>outbound</DirectionRef>
 *       <PublishedLineName>47</PublishedLineName>
 *       <OperatorRef>SCSO</OperatorRef>
 *       <DestinationName>Brighton</DestinationName>
 *       <OriginName>Worthing</OriginName>
 *       <VehicleLocation>
 *         <Latitude>50.8429</Latitude>
 *         <Longitude>-0.1413</Longitude>
 *       </VehicleLocation>
 *       <Bearing>180</Bearing>
 *       <Delay>PT2M30S</Delay>
 *       <MonitoredCall>
 *         <StopPointName>Church Road</StopPointName>
 *         <AimedArrivalTime>...</AimedArrivalTime>
 *         <ExpectedArrivalTime>...</ExpectedArrivalTime>
 *       </MonitoredCall>
 *     </MonitoredVehicleJourney>
 *   </VehicleActivity>
 */
function parseSiriVmXml(xmlText, centreLat, centreLon) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');

    const activities = doc.getElementsByTagName('VehicleActivity');
    if (!activities.length) {
      // Try with namespace prefix
      const nsActivities = doc.querySelectorAll('VehicleActivity') ||
                           doc.getElementsByTagNameNS('*', 'VehicleActivity');
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
        // Skip malformed entries
        console.debug('[BODS] Skipping malformed vehicle activity:', err.message);
      }
    }

    // Sort by distance from centre
    buses.sort((a, b) => a.distanceKm - b.distanceKm);

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
    // Try without namespace first, then with common SIRI prefixes
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

  // Get vehicle location
  const latStr = getText(activity, 'Latitude');
  const lonStr = getText(activity, 'Longitude');
  if (!latStr || !lonStr) return null;

  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);
  if (isNaN(lat) || isNaN(lon)) return null;

  // Calculate distance from search centre
  const distanceKm = haversineDistance(centreLat, centreLon, lat, lon);

  // Parse delay (ISO 8601 duration: PT2M30S = 2 minutes 30 seconds)
  const delayMinutes = parseIsoDuration(delayStr);

  // Get monitored call info (next stop)
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

/**
 * Parse ISO 8601 duration string to minutes.
 * Handles: PT2M30S, -PT1M, PT0S, PT5M, P0DT0H3M0S, etc.
 */
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

/**
 * Format delay minutes into human-readable text.
 */
function formatDelay(delayMinutes) {
  if (delayMinutes === 0 || delayMinutes === null) return 'On time';
  if (delayMinutes < 0) return `${Math.abs(delayMinutes)} min early`;
  return `${delayMinutes} min late`;
}

/**
 * Get status category from delay.
 */
function getStatusFromDelay(delayMinutes) {
  if (delayMinutes === null || delayMinutes === undefined) return 'unknown';
  if (delayMinutes <= 0) return 'on-time';
  if (delayMinutes <= 3) return 'on-time';   // Within tolerance
  if (delayMinutes <= 10) return 'delayed';
  return 'very-delayed';
}

/**
 * Haversine distance between two lat/lon points, in kilometres.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
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

/**
 * Get live buses near a location, grouped by line.
 * Returns an object keyed by line name, each containing an array of vehicles.
 * 
 * @param {number} lat
 * @param {number} lon
 * @param {number} radiusKm
 * @returns {Object} { "47": [bus1, bus2], "700": [bus3] }
 */
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

/**
 * Match live bus positions to nearby bus stops.
 * For each stop (from Overpass data), find buses heading towards it.
 * 
 * @param {Array} stops - Nearby bus stops from Overpass [{ lat, lon, name, ... }]
 * @param {number} centreLat - Pilot's location
 * @param {number} centreLon - Pilot's location
 * @returns {Array} Stops enriched with approaching bus info
 */
export async function matchBusesToStops(stops, centreLat, centreLon) {
  if (!stops?.length) return [];

  // Fetch live buses in a wider radius to catch approaching vehicles
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
    // Find buses that might be heading to this stop
    // A bus is "approaching" if it's within 2km of the stop and heading roughly towards it
    const nearbyBuses = buses.filter(bus => {
      const distToStop = haversineDistance(bus.lat, bus.lon, stop.lat, stop.lon);
      return distToStop < 2; // Within 2km of the stop
    });

    // Group by line and sort by distance to stop
    const busesByLine = {};
    for (const bus of nearbyBuses) {
      const key = bus.line || 'Unknown';
      if (!busesByLine[key]) busesByLine[key] = [];
      busesByLine[key].push({
        ...bus,
        distanceToStop: haversineDistance(bus.lat, bus.lon, stop.lat, stop.lon),
      });
    }

    // For each line, pick the closest bus
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

/**
 * Rough estimate of bus arrival time based on distance.
 * Assumes average urban bus speed of ~20 km/h including stops.
 */
function estimateArrivalMinutes(distanceKm) {
  const avgSpeedKmh = 20;
  return Math.max(1, Math.round((distanceKm / avgSpeedKmh) * 60));
}

/**
 * Clear the bus position cache (call when user moves significantly).
 */
export function clearBusCache() {
  busCache.clear();
}

export default {
  fetchLiveBuses,
  fetchLiveBusesByLine,
  matchBusesToStops,
  clearBusCache,
};
