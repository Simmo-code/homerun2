/**
 * Darwin Live Train Verification
 * 
 * Cross-references Transitous journey plan rail legs with live National Rail
 * Darwin (OpenLDBWS) data to add real-time platform, delay, and cancellation info.
 * 
 * Uses the existing Cloudflare Worker proxy at:
 *   https://falling-sound-fa1a.simmo-justin.workers.dev
 * 
 * Flow:
 *   1. Transitous returns a journey with rail legs
 *   2. For each rail leg, extract the departure station name
 *   3. Look up the CRS code from our station table
 *   4. Query Darwin for live departures at that station
 *   5. Match the service by scheduled time + destination
 *   6. Enrich the leg with: live status, delay, platform, cancellation
 */

import { getCrsCode, normalizeStationName } from '../data/crsStations.js';

const DARWIN_PROXY_URL = 'https://falling-sound-fa1a.simmo-justin.workers.dev';
const DARWIN_TOKEN = 'b31e1e8a-6917-4c79-a160-ff7912e1329d';

// Cache Darwin responses for 60 seconds to avoid hammering the API
const darwinCache = new Map();
const CACHE_TTL_MS = 60_000;

/**
 * Build the SOAP XML envelope for a GetDepBoardWithDetails request.
 */
function buildDarwinSoapRequest(crsCode, numRows = 10, timeWindow = 60) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:typ="http://thalesgroup.com/RTTI/2013-11-28/Token/types"
               xmlns:ldb="http://thalesgroup.com/RTTI/2017-10-01/ldb/">
  <soap:Header>
    <typ:AccessToken>
      <typ:TokenValue>${DARWIN_TOKEN}</typ:TokenValue>
    </typ:AccessToken>
  </soap:Header>
  <soap:Body>
    <ldb:GetDepBoardWithDetailsRequest>
      <ldb:numRows>${numRows}</ldb:numRows>
      <ldb:crs>${crsCode}</ldb:crs>
      <ldb:timeWindow>${timeWindow}</ldb:timeWindow>
    </ldb:GetDepBoardWithDetailsRequest>
  </soap:Body>
</soap:Envelope>`;
}

/**
 * Fetch live departures from Darwin for a given CRS code.
 * Returns parsed departure services or empty array on failure.
 */
async function fetchDarwinDepartures(crsCode) {
  const cacheKey = crsCode;
  const cached = darwinCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const soapBody = buildDarwinSoapRequest(crsCode);
    const response = await fetch(DARWIN_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      body: soapBody,
    });

    if (!response.ok) {
      console.warn(`[Darwin] HTTP ${response.status} for ${crsCode}`);
      return [];
    }

    const xmlText = await response.text();
    const services = parseDarwinXml(xmlText);

    darwinCache.set(cacheKey, { data: services, timestamp: Date.now() });
    return services;
  } catch (err) {
    console.warn(`[Darwin] Failed to fetch departures for ${crsCode}:`, err.message);
    return [];
  }
}

/**
 * Parse Darwin SOAP XML response into an array of service objects.
 */
function parseDarwinXml(xmlText) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');

    // Handle SOAP namespace variations
    const services = doc.querySelectorAll('service') || 
                     doc.getElementsByTagName('lt7:service') ||
                     doc.getElementsByTagName('service');

    const results = [];

    for (const service of services) {
      const getTagText = (tagNames) => {
        for (const tag of (Array.isArray(tagNames) ? tagNames : [tagNames])) {
          // Try with and without namespace prefixes
          const el = service.querySelector(tag) ||
                     service.getElementsByTagName(tag)[0] ||
                     service.getElementsByTagName(`lt7:${tag}`)[0] ||
                     service.getElementsByTagName(`lt5:${tag}`)[0] ||
                     service.getElementsByTagName(`lt4:${tag}`)[0];
          if (el?.textContent) return el.textContent.trim();
        }
        return null;
      };

      const std = getTagText(['std']);           // Scheduled Time of Departure
      const etd = getTagText(['etd']);           // Estimated Time of Departure
      const platform = getTagText(['platform']);
      const operator = getTagText(['operator']);
      const operatorCode = getTagText(['operatorCode']);
      const isCancelled = getTagText(['isCancelled']);
      const cancelReason = getTagText(['cancelReason']);
      const delayReason = getTagText(['delayReason']);

      // Get destination(s)
      const destElements = service.querySelectorAll('destination location') ||
                           service.getElementsByTagName('location');
      const destinations = [];
      for (const dest of destElements) {
        const name = dest.querySelector('locationName')?.textContent ||
                     dest.getElementsByTagName('lt4:locationName')[0]?.textContent ||
                     dest.getElementsByTagName('locationName')[0]?.textContent;
        if (name) destinations.push(name.trim());
      }

      // Get calling points for route matching
      const callingPoints = [];
      const cpElements = service.querySelectorAll('callingPoint') ||
                         service.getElementsByTagName('lt7:callingPoint') ||
                         service.getElementsByTagName('callingPoint');
      for (const cp of cpElements) {
        const cpName = cp.querySelector('locationName')?.textContent ||
                       cp.getElementsByTagName('locationName')[0]?.textContent;
        const cpSt = cp.querySelector('st')?.textContent ||
                     cp.getElementsByTagName('st')[0]?.textContent;
        const cpEt = cp.querySelector('et')?.textContent ||
                     cp.getElementsByTagName('et')[0]?.textContent;
        if (cpName) {
          callingPoints.push({
            name: cpName.trim(),
            scheduledTime: cpSt?.trim() || null,
            estimatedTime: cpEt?.trim() || null,
          });
        }
      }

      results.push({
        scheduledDeparture: std,
        estimatedDeparture: etd,
        platform: platform || null,
        operator: operator || null,
        operatorCode: operatorCode || null,
        destinations,
        callingPoints,
        isCancelled: isCancelled === 'true',
        cancelReason: cancelReason || null,
        delayReason: delayReason || null,
      });
    }

    return results;
  } catch (err) {
    console.warn('[Darwin] XML parse error:', err.message);
    return [];
  }
}

/**
 * Match a Transitous rail leg to a Darwin service.
 * 
 * @param {string} scheduledTime - HH:MM format from Transitous leg startTime
 * @param {string} destinationName - Final destination from Transitous leg
 * @param {Array} darwinServices - Parsed Darwin services for the departure station
 * @returns {Object|null} Matched service with live data, or null
 */
function matchService(scheduledTime, destinationName, darwinServices) {
  if (!scheduledTime || !darwinServices.length) return null;

  const targetHHMM = scheduledTime.substring(0, 5);
  const normalizedDest = normalizeStationName(destinationName) || '';

  // Try exact time + destination match first
  for (const service of darwinServices) {
    if (service.scheduledDeparture === targetHHMM) {
      const destMatch = normalizedDest && service.destinations.some(d => {
        const nd = normalizeStationName(d) || '';
        return nd && (nd.includes(normalizedDest) || normalizedDest.includes(nd));
      });
      const callingMatch = normalizedDest && service.callingPoints.some(cp => {
        const nc = normalizeStationName(cp.name) || '';
        return nc && (nc.includes(normalizedDest) || normalizedDest.includes(nc));
      });

      if (destMatch || callingMatch) {
        return service;
      }
    }
  }

  // Fallback: match within ±2 minutes
  for (const service of darwinServices) {
    if (!service.scheduledDeparture) continue;
    const diff = timeDiffMinutes(targetHHMM, service.scheduledDeparture);
    if (Math.abs(diff) <= 2) {
      const destMatch = normalizedDest && service.destinations.some(d => {
        const nd = normalizeStationName(d) || '';
        return nd && (nd.includes(normalizedDest) || normalizedDest.includes(nd));
      });
      const callingMatch = normalizedDest && service.callingPoints.some(cp => {
        const nc = normalizeStationName(cp.name) || '';
        return nc && (nc.includes(normalizedDest) || normalizedDest.includes(nc));
      });
      if (destMatch || callingMatch) return service;
    }
  }

  // Last resort: time match only (if no destination info)
  if (!destinationName) {
    for (const service of darwinServices) {
      if (service.scheduledDeparture === targetHHMM) return service;
    }
  }

  return null;
}

/**
 * Calculate difference in minutes between two HH:MM strings.
 */
function timeDiffMinutes(time1, time2) {
  const [h1, m1] = time1.split(':').map(Number);
  const [h2, m2] = time2.split(':').map(Number);
  return (h1 * 60 + m1) - (h2 * 60 + m2);
}

/**
 * Compute a delay in minutes from scheduled vs estimated departure.
 */
function computeDelay(scheduled, estimated) {
  if (!scheduled || !estimated) return 0;
  if (estimated === 'On time') return 0;
  if (estimated === 'Cancelled') return null;
  if (estimated === 'Delayed') return null; // Unknown delay
  // estimated is an HH:MM string
  if (/^\d{2}:\d{2}$/.test(estimated)) {
    return timeDiffMinutes(estimated, scheduled);
  }
  return 0;
}

/**
 * Determine the live status of a service.
 * Returns an object with status info for display.
 */
function getLiveStatus(service) {
  if (!service) {
    return {
      confidence: 'none',       // 'live' | 'timetable' | 'none'
      status: 'unknown',        // 'on-time' | 'delayed' | 'cancelled' | 'unknown'
      delayMinutes: 0,
      platform: null,
      message: null,
      color: '#6b7280',         // grey
      icon: '❓',
    };
  }

  if (service.isCancelled) {
    return {
      confidence: 'live',
      status: 'cancelled',
      delayMinutes: null,
      platform: service.platform,
      message: service.cancelReason || 'Service cancelled',
      color: '#ff3b3b',
      icon: '🚫',
    };
  }

  const delay = computeDelay(service.scheduledDeparture, service.estimatedDeparture);

  if (delay === null) {
    return {
      confidence: 'live',
      status: 'delayed',
      delayMinutes: null,
      platform: service.platform,
      message: service.delayReason || 'Delayed — no estimate',
      color: '#ff8c00',
      icon: '⚠️',
    };
  }

  if (delay > 0) {
    return {
      confidence: 'live',
      status: 'delayed',
      delayMinutes: delay,
      platform: service.platform,
      message: service.delayReason || `Running ${delay} min late`,
      color: delay >= 10 ? '#ff3b3b' : '#ffd700',
      icon: delay >= 10 ? '🔴' : '🟡',
    };
  }

  return {
    confidence: 'live',
    status: 'on-time',
    delayMinutes: 0,
    platform: service.platform,
    message: `On time${service.platform ? ` — Platform ${service.platform}` : ''}`,
    color: '#00ff9d',
    icon: '✅',
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Enrich a single Transitous rail leg with live Darwin data.
 * 
 * @param {Object} leg - A Transitous itinerary leg object
 *   Expected shape: { mode: 'RAIL'|'TRANSIT', from: { name }, to: { name },
 *                     startTime: '2025-01-15T14:23:00', ... }
 * @returns {Object} The leg with an added `liveStatus` property
 */
export async function enrichRailLeg(leg) {
  // Only enrich rail/train legs
  const mode = (leg.mode || leg.transitLeg?.mode || '').toUpperCase();
  if (!['RAIL', 'TRAIN', 'SUBWAY', 'TRAM'].includes(mode) && !(typeof leg.routeType === 'string' && leg.routeType.includes('rail'))) {
    return { ...leg, liveStatus: getLiveStatus(null) };
  }

  // Get departure station CRS code
  const fromName = leg.from?.name || leg.from?.stopId || '';
  const crsCode = getCrsCode(fromName);

  if (!crsCode) {
    console.debug(`[Darwin] No CRS code found for "${fromName}"`);
    return {
      ...leg,
      liveStatus: {
        ...getLiveStatus(null),
        confidence: 'timetable',
        status: 'timetable-only',
        message: 'Timetable data only — no live feed for this station',
        color: '#6b7280',
        icon: '📋',
      },
    };
  }

  // Fetch live departures
  const services = await fetchDarwinDepartures(crsCode);

  if (!services.length) {
    return {
      ...leg,
      liveStatus: {
        ...getLiveStatus(null),
        confidence: 'timetable',
        status: 'no-data',
        message: 'No live departures available',
        color: '#6b7280',
        icon: '📋',
      },
    };
  }

  // Extract scheduled time from Transitous leg
  const startTime = leg.startTime || leg.from?.departure;
  let scheduledHHMM = null;
  if (startTime) {
    const date = new Date(startTime);
    if (!isNaN(date)) {
      scheduledHHMM = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    } else if (/\d{2}:\d{2}/.test(startTime)) {
      scheduledHHMM = startTime.match(/(\d{2}:\d{2})/)?.[1];
    }
  }

  // Get destination for matching
  const toName = leg.to?.name || leg.headsign || '';

  // Match and enrich
  const matched = matchService(scheduledHHMM, toName, services);
  const liveStatus = getLiveStatus(matched);

  // Add operator info if matched
  if (matched) {
    liveStatus.operator = matched.operator;
    liveStatus.operatorCode = matched.operatorCode;
    liveStatus.estimatedDeparture = matched.estimatedDeparture;
    liveStatus.callingPoints = matched.callingPoints;
  }

  return { ...leg, liveStatus };
}

/**
 * Enrich all rail legs in a Transitous itinerary.
 * Non-rail legs get a 'none' confidence status.
 * 
 * @param {Object} itinerary - A Transitous itinerary with a `legs` array
 * @returns {Object} The itinerary with enriched legs
 */
export async function enrichItinerary(itinerary) {
  if (!itinerary?.legs?.length) return itinerary;

  // Process rail legs in parallel
  const enrichedLegs = await Promise.all(
    itinerary.legs.map(leg => enrichRailLeg(leg))
  );

  // Compute overall confidence for the itinerary
  const railLegs = enrichedLegs.filter(l => l.liveStatus?.confidence === 'live');
  const hasDelays = railLegs.some(l => l.liveStatus?.status === 'delayed');
  const hasCancellations = railLegs.some(l => l.liveStatus?.status === 'cancelled');

  return {
    ...itinerary,
    legs: enrichedLegs,
    liveConfidence: hasCancellations ? 'disrupted' :
                    hasDelays ? 'delays' :
                    railLegs.length > 0 ? 'confirmed' : 'timetable',
    liveMessage: hasCancellations ? 'One or more trains cancelled' :
                 hasDelays ? 'Delays on this route' :
                 railLegs.length > 0 ? 'All trains running on time' : null,
  };
}

/**
 * Enrich multiple itineraries (e.g. the full Transitous response).
 */
export async function enrichAllItineraries(itineraries) {
  if (!itineraries?.length) return [];
  return Promise.all(itineraries.map(it => enrichItinerary(it)));
}

export default {
  enrichRailLeg,
  enrichItinerary,
  enrichAllItineraries,
};
