/**
 * Basemap configuration.
 *
 * OpenFreeMap serves MapLibre vector tiles with no API key and no billing
 * account, so the app works out of the box. Override via EXPO_PUBLIC_MAP_STYLE_URL
 * to point at MapTiler, Protomaps, a self-hosted style, or anything else.
 */
export const MAP_STYLE_URL =
  process.env['EXPO_PUBLIC_MAP_STYLE_URL'] ??
  'https://tiles.openfreemap.org/styles/liberty';

export const MAP_STYLE_URL_DARK =
  process.env['EXPO_PUBLIC_MAP_STYLE_URL_DARK'] ??
  'https://tiles.openfreemap.org/styles/dark';

/** Zoom level used when framing the user's own position. */
export const USER_ZOOM = 15.5;

/** Confirmations must be within this many metres of the pothole. */
export const CONFIRM_RADIUS_M = 50;
