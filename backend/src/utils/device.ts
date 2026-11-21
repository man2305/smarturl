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

  // Normalise to the dashboard's fixed classes: ua-parser-js returns raw
  // values (wearable, console, smarttv, ...) that would splinter the
  // breakdown, and no device type means a desktop-class client.
  const deviceClass =
    device.type === 'mobile' || device.type === 'tablet'
      ? device.type
      : device.type === undefined
        ? 'desktop'
        : 'other';

  return {
    browser: browser.name || 'Unknown',
    browserVersion: browser.version || '',
    os: os.name || 'Unknown',
    device: deviceClass,
    deviceName: device.model || '',
  };
}
