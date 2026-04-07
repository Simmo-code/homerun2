/**
 * CRS Station Code Lookup
 * Maps station names to 3-letter CRS codes used by National Rail Darwin API.
 * Covers: Hampshire, West Sussex, Kent, Surrey, South London, and key London termini.
 * 
 * To add more stations: https://www.nationalrail.co.uk/stations_destinations/48702.aspx
 * Full dataset: ~2,600 stations, but we only need the ones in our flying areas.
 */

const CRS_STATIONS = {
  // === London Termini ===
  "london victoria": "VIC",
  "victoria": "VIC",
  "london bridge": "LBG",
  "london waterloo": "WAT",
  "waterloo": "WAT",
  "london charing cross": "CHX",
  "charing cross": "CHX",
  "london paddington": "PAD",
  "paddington": "PAD",
  "london euston": "EUS",
  "euston": "EUS",
  "london kings cross": "KGX",
  "kings cross": "KGX",
  "london st pancras": "STP",
  "st pancras": "STP",
  "st pancras international": "STP",
  "london cannon street": "CST",
  "cannon street": "CST",
  "london blackfriars": "BFR",
  "blackfriars": "BFR",
  "london liverpool street": "LST",
  "liverpool street": "LST",
  "london fenchurch street": "FST",
  "fenchurch street": "FST",
  "london marylebone": "MYB",
  "marylebone": "MYB",
  "clapham junction": "CLJ",
  "east croydon": "ECR",
  "gatwick airport": "GTW",

  // === Hampshire ===
  "winchester": "WIN",
  "southampton central": "SOU",
  "southampton": "SOU",
  "southampton airport parkway": "SOA",
  "southampton airport": "SOA",
  "eastleigh": "ESL",
  "basingstoke": "BSK",
  "andover": "ADV",
  "petersfield": "PTR",
  "liss": "LIS",
  "havant": "HAV",
  "fareham": "FRM",
  "gosport": "GPS",
  "portsmouth harbour": "PMH",
  "portsmouth": "PMH",
  "portsmouth and southsea": "PMS",
  "cosham": "CSA",
  "fratton": "FTN",
  "hilsea": "HLS",
  "portchester": "PTC",
  "hedge end": "HDE",
  "botley": "BOT",
  "romsey": "ROM",
  "chandlers ford": "CFR",
  "shawford": "SHW",
  "micheldever": "MIC",
  "alresford": "ALR",
  "alton": "ANO",
  "bentley": "BNT",
  "farnham": "FNH",
  "fleet": "FLE",
  "hook": "HOK",
  "winchfield": "WNF",
  "liphook": "LIP",
  "rowlands castle": "RLC",
  "emsworth": "EMS",
  "bedhampton": "BDH",
  "woolston": "WLS",
  "sholing": "SHO",
  "bitterne": "BIT",
  "swaythling": "SWY",
  "st denys": "SDN",
  "millbrook": "MBK",
  "redbridge": "RDB",
  "totton": "TTN",
  "ashurst new forest": "ANF",
  "beaulieu road": "BEU",
  "brockenhurst": "BCU",
  "lymington town": "LYT",
  "lymington pier": "LYP",
  "new milton": "NWM",
  "christchurch": "CHR",
  "bournemouth": "BMH",
  "poole": "POO",

  // === West Sussex ===
  "chichester": "CCH",
  "bognor regis": "BOG",
  "littlehampton": "LIT",
  "worthing": "WRH",
  "shoreham-by-sea": "SSE",
  "shoreham": "SSE",
  "hove": "HOV",
  "brighton": "BTN",
  "hassocks": "HSK",
  "burgess hill": "BUG",
  "haywards heath": "HHE",
  "crawley": "CRW",
  "three bridges": "TBD",
  "horsham": "HRH",
  "arundel": "ARU",
  "amberley": "AMB",
  "pulborough": "PUL",
  "billingshurst": "BIG",
  "christs hospital": "CHH",
  "barnham": "BAA",
  "ford": "FOD",
  "angmering": "ANG",
  "east grinstead": "EGR",
  "balcombe": "BAB",
  "wivelsfield": "WVF",
  "plumpton": "PMP",
  "lewes": "LWS",
  "southease": "SEE",
  "newhaven town": "NVN",
  "newhaven harbour": "NVH",
  "seaford": "SEF",
  "lancing": "LAC",
  "durrington-on-sea": "DUR",
  "west worthing": "WWO",
  "east worthing": "EWR",
  "fishersgate": "FSG",
  "portslade": "PLD",
  "aldrington": "AGT",
  "preston park": "PRP",
  "falmer": "FMR",
  "glynde": "GLY",

  // === Kent ===
  "ashford international": "AFK",
  "ashford": "AFK",
  "canterbury west": "CBW",
  "canterbury east": "CBE",
  "canterbury": "CBW",
  "dover priory": "DVP",
  "dover": "DVP",
  "folkestone central": "FKC",
  "folkestone west": "FKW",
  "folkestone": "FKC",
  "maidstone east": "MDE",
  "maidstone west": "MDW",
  "maidstone": "MDE",
  "tunbridge wells": "TBW",
  "tonbridge": "TON",
  "sevenoaks": "SEV",
  "orpington": "ORP",
  "bromley south": "BMS",
  "chatham": "CTM",
  "rochester": "RTR",
  "gillingham": "GLM",
  "gravesend": "GRV",
  "dartford": "DFD",
  "ebbsfleet international": "EBD",
  "ebbsfleet": "EBD",
  "ramsgate": "RAM",
  "margate": "MAR",
  "broadstairs": "BSR",
  "deal": "DEA",
  "sandwich": "SDW",
  "whitstable": "WHI",
  "herne bay": "HNB",
  "faversham": "FAV",
  "sittingbourne": "SIT",
  "rainham": "RAI",
  "strood": "SOO",
  "higham": "HGM",
  "paddock wood": "PDW",
  "headcorn": "HCN",
  "staplehurst": "SPU",
  "marden": "MRN",
  "wye": "WYE",
  "chilham": "CIL",
  "chartham": "CRT",
  "selling": "SEG",
  "bekesbourne": "BKS",
  "snowdown": "SWO",
  "aylesham": "AYH",
  "adisham": "ADM",
  "kemsing": "KMS",
  "otford": "OTF",
  "bat and ball": "BBL",
  "dunton green": "DNG",
  "hildenborough": "HLB",
  "leigh": "LIH",
  "penshurst": "PHR",
  "hever": "HEV",
  "edenbridge town": "EBT",
  "edenbridge": "EBR",
  "oxted": "OXT",

  // === Surrey ===
  "guildford": "GLD",
  "woking": "WOK",
  "dorking": "DKG",
  "redhill": "RDH",
  "reigate": "REI",
  "epsom": "EPS",
  "leatherhead": "LHD",
  "surbiton": "SUR",
  "esher": "ESH",
  "weybridge": "WYB",
  "staines": "SNE",
  "virginia water": "VIR",
  "egham": "EGH",
  "frimley": "FML",
  "camberley": "CAM",
  "haslemere": "HSL",
  "godalming": "GOD",
  "farncombe": "FNC",
  "milford": "MLF",
  "witley": "WTY",
  "cranleigh": "CRN",
  "shalford": "SFR",
  "gomshall": "GOM",
  "chilworth": "CHL",
  "ash": "ASH",
  "ash vale": "AHV",
  "brookwood": "BKO",
  "worplesdon": "WPL",
};

/**
 * Normalize a station name for lookup.
 * Strips common suffixes that differ between Transitous GTFS and NR naming.
 */
export function normalizeStationName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/\s*rail(way)?\s*station\s*/gi, '')
    .replace(/\s*train\s*station\s*/gi, '')
    .replace(/\s*station\s*$/gi, '')
    .replace(/\s*\(.*?\)\s*/g, '') // Remove parenthetical like "(kent)"
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Look up a CRS code from a station name.
 * Tries exact match first, then fuzzy partial match.
 * @param {string} stationName - e.g. "Hassocks Rail Station", "Brighton", "London Victoria"
 * @returns {string|null} CRS code like "HSK", or null if not found
 */
export function getCrsCode(stationName) {
  const normalized = normalizeStationName(stationName);
  if (!normalized) return null;

  // Exact match
  if (CRS_STATIONS[normalized]) {
    return CRS_STATIONS[normalized];
  }

  // Try matching the end of the name (handles "London Victoria" vs "Victoria")
  for (const [key, code] of Object.entries(CRS_STATIONS)) {
    if (normalized.endsWith(key) || key.endsWith(normalized)) {
      return code;
    }
  }

  // Fuzzy: check if our normalized name contains any station key
  for (const [key, code] of Object.entries(CRS_STATIONS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return code;
    }
  }

  return null;
}

/**
 * Reverse lookup: get station name from CRS code.
 * Returns the first (most specific) match.
 */
export function getStationName(crsCode) {
  if (!crsCode) return null;
  const upper = crsCode.toUpperCase();
  for (const [name, code] of Object.entries(CRS_STATIONS)) {
    if (code === upper) return name;
  }
  return null;
}

export default CRS_STATIONS;
