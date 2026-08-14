/**
 * Basemap + geocoding configuration.
 *
 * Everything here points at free, keyless services by default:
 *  - Tiles:     OpenFreeMap (https://openfreemap.org) — no API key, no billing.
 *  - Geocoding: Nominatim (OpenStreetMap) — no API key.
 *
 * Both are overridable via env so you can swap in MapTiler, Protomaps, a
 * self-hosted style, or Google without touching component code.
 */

const DEFAULT_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const DEFAULT_DARK_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
const DEFAULT_NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

export const MAP_STYLE_URL: string =
  import.meta.env['VITE_MAP_STYLE_URL'] || DEFAULT_STYLE_URL;

export const MAP_STYLE_URL_DARK: string =
  import.meta.env['VITE_MAP_STYLE_URL_DARK'] || DEFAULT_DARK_STYLE_URL;

export const NOMINATIM_URL: string =
  import.meta.env['VITE_NOMINATIM_URL'] || DEFAULT_NOMINATIM_URL;

/** Zoom level used when framing the user's own position. */
export const USER_ZOOM = 15.5;

/** Nominatim asks that every caller identify itself. */
export const GEOCODER_USER_AGENT = 'PatchWork/1.0 (civic pothole reporting)';
