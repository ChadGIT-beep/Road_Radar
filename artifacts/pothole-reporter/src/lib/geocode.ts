import { NOMINATIM_URL, GEOCODER_USER_AGENT } from './map-config';

export interface PlaceName {
  streetName: string;
  neighborhood: string;
}

export const UNKNOWN_PLACE: PlaceName = {
  streetName: 'Unknown Street',
  neighborhood: 'Unknown Area',
};

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  footway?: string;
  neighbourhood?: string;
  suburb?: string;
  city_district?: string;
  town?: string;
  city?: string;
  village?: string;
}

/**
 * Turn coordinates into a street + area name.
 *
 * The app's whole output — the Hotspots ranking — aggregates by street, so a
 * report without a real street name is close to useless. Falls back to
 * UNKNOWN_PLACE rather than throwing: a report with a vague address is still
 * worth more than a lost report.
 *
 * Note: the public Nominatim instance allows roughly one request per second and
 * forbids heavy use. That is fine here (one lookup per new report, not per map
 * move), but self-host it before this sees real traffic.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<PlaceName> {
  const url =
    `${NOMINATIM_URL}/reverse?lat=${lat}&lon=${lng}` +
    `&format=jsonv2&zoom=18&addressdetails=1`;

  try {
    const res = await fetch(url, {
      signal,
      headers: { Accept: 'application/json', 'User-Agent': GEOCODER_USER_AGENT },
    });
    if (!res.ok) return UNKNOWN_PLACE;

    const body = (await res.json()) as { address?: NominatimAddress };
    const a = body.address;
    if (!a) return UNKNOWN_PLACE;

    return {
      streetName: a.road ?? a.pedestrian ?? a.footway ?? UNKNOWN_PLACE.streetName,
      neighborhood:
        a.neighbourhood ??
        a.suburb ??
        a.city_district ??
        a.city ??
        a.town ??
        a.village ??
        UNKNOWN_PLACE.neighborhood,
    };
  } catch {
    // Offline, blocked, rate-limited, or aborted — keep the report, lose the name.
    return UNKNOWN_PLACE;
  }
}
