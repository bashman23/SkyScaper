export type GeocodeResult = {
  id: string;
  name: string;
  fullAddress: string;
  center: [number, number];
};

type MapboxGeocodeResponse = {
  features?: Array<{
    id?: string;
    properties?: {
      mapbox_id?: string;
      name?: string;
      full_address?: string;
      place_formatted?: string;
    };
    geometry?: {
      coordinates?: [number, number];
    };
  }>;
};

export async function searchPlaces(query: string, accessToken: string, fetcher: typeof fetch = fetch): Promise<GeocodeResult[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery || !accessToken) {
    return [];
  }

  const url = new URL('https://api.mapbox.com/search/geocode/v6/forward');
  url.searchParams.set('q', trimmedQuery);
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('limit', '5');
  url.searchParams.set('language', 'en');
  url.searchParams.set('worldview', 'us');

  const response = await fetcher(url);
  if (!response.ok) {
    throw new Error(`Search failed with status ${response.status}`);
  }

  const body = (await response.json()) as MapboxGeocodeResponse;
  return (body.features ?? [])
    .map((feature, index): GeocodeResult | null => {
      const coordinates = feature.geometry?.coordinates;
      if (!coordinates || coordinates.length < 2) {
        return null;
      }

      const name = feature.properties?.name ?? 'Search result';
      const place = feature.properties?.place_formatted;
      const fullAddress = feature.properties?.full_address ?? (place ? `${name}, ${place}` : name);

      return {
        id: feature.properties?.mapbox_id ?? feature.id ?? `result-${index}`,
        name,
        fullAddress,
        center: [coordinates[0], coordinates[1]]
      };
    })
    .filter((result): result is GeocodeResult => Boolean(result));
}
