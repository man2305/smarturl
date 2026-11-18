import geoip from 'geoip-lite';

export interface GeoResult {
  country: string;
  countryCode: string;
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

/**
 * Best-effort IP -> country resolution.
 * Localhost and unresolvable IPs map to safe defaults instead of crashing
 * the redirect path.
 */
export function lookupCountry(ip: string): GeoResult {
  if (!ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('::ffff:127.')) {
    return { country: 'Localhost', countryCode: 'LOCAL' };
  }

  const normalized = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  const lookup = geoip.lookup(normalized);
  if (lookup) {
    // geoip-lite's `country` is the ISO code; the name goes in `country`
    // and the code in `countryCode` (they previously held the same value).
    return { country: regionNames.of(lookup.country) ?? lookup.country, countryCode: lookup.country };
  }
  return { country: 'Unknown', countryCode: '' };
}
