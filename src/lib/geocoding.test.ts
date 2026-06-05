import { describe, expect, it, vi } from 'vitest';
import { searchPlaces } from './geocoding';

describe('searchPlaces', () => {
  it('returns no results for empty queries or missing tokens', async () => {
    expect(await searchPlaces('', 'token')).toEqual([]);
    expect(await searchPlaces('123 Main St', '')).toEqual([]);
  });

  it('maps Mapbox geocoding results into app search results', async () => {
    let requestedUrl = '';
    const fetcherMock = vi.fn(async (input: URL | RequestInfo) => {
      requestedUrl = String(input);
      return {
        ok: true,
        json: async () => ({
          features: [
            {
              id: 'feature-1',
              properties: {
                mapbox_id: 'mapbox-1',
                name: '123 Main Street',
                full_address: '123 Main Street, Raleigh, North Carolina 27601, United States'
              },
              geometry: {
                coordinates: [-78.6382, 35.7796]
              }
            }
          ]
        })
      };
    });

    const results = await searchPlaces('123 Main St', 'token', fetcherMock as unknown as typeof fetch);

    expect(results).toEqual([
      {
        id: 'mapbox-1',
        name: '123 Main Street',
        fullAddress: '123 Main Street, Raleigh, North Carolina 27601, United States',
        center: [-78.6382, 35.7796]
      }
    ]);
    expect(fetcherMock).toHaveBeenCalledOnce();
    expect(requestedUrl).toContain('https://api.mapbox.com/search/geocode/v6/forward');
  });

  it('throws when Mapbox returns an error response', async () => {
    const fetcher = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({})
    })) as unknown as typeof fetch;

    await expect(searchPlaces('123 Main St', 'bad-token', fetcher)).rejects.toThrow('Search failed with status 401');
  });
});
