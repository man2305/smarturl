import { describe, it, expect } from 'vitest';
import { lookupCountry } from '../src/utils/geo';

describe('lookupCountry', () => {
  it('resolves a public IP to a country name and ISO code', () => {
    expect(lookupCountry('8.8.8.8')).toEqual({ country: 'United States', countryCode: 'US' });
  });

  it('strips the IPv4-mapped IPv6 prefix', () => {
    expect(lookupCountry('::ffff:8.8.8.8')).toEqual({
      country: 'United States',
      countryCode: 'US',
    });
  });

  it('labels loopback as Localhost', () => {
    expect(lookupCountry('127.0.0.1')).toEqual({ country: 'Localhost', countryCode: 'LOCAL' });
    expect(lookupCountry('::1')).toEqual({ country: 'Localhost', countryCode: 'LOCAL' });
  });

  it('returns Unknown for unroutable and private ranges', () => {
    expect(lookupCountry('203.0.113.1')).toEqual({ country: 'Unknown', countryCode: '' });
    expect(lookupCountry('192.168.1.1')).toEqual({ country: 'Unknown', countryCode: '' });
  });
});
