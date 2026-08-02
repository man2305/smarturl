import { UAParser } from 'ua-parser-js';

export interface DeviceResult {
  browser: string;
  browserVersion: string;
  os: string;
  device: string;
  deviceName: string;
}

/**
 * Parse a User-Agent string into structured dimensions used by the
 * analytics dashboard (browser / OS / device class).
 */
export function parseUserAgent(userAgent: string | undefined): DeviceResult {
  if (!userAgent) {
    return { browser: 'Unknown', browserVersion: '', os: 'Unknown', device: 'desktop', deviceName: '' };
  }

  const parser = new UAParser(userAgent);
  const browser = parser.getBrowser();
  const os = parser.getOS();
  const device = parser.getDevice();

  return {
    browser: browser.name || 'Unknown',
    browserVersion: browser.version || '',
    os: os.name || 'Unknown',
    device: device.type || 'desktop',
    deviceName: device.model || '',
  };
}
