import { describe, expect, it } from 'vitest';
import { parseImportedMeasurements } from './import';

describe('parseImportedMeasurements', () => {
  it('parses supported polygon and line features', () => {
    const json = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'area-1',
          properties: { name: 'Lot A' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-80, 35],
                [-80.001, 35],
                [-80.001, 35.001],
                [-80, 35.001],
                [-80, 35]
              ]
            ]
          }
        },
        {
          type: 'Feature',
          id: 'line-1',
          properties: { name: 'Fence edge' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [-80, 35],
              [-80.001, 35]
            ]
          }
        }
      ]
    });

    const collection = parseImportedMeasurements(json);
    expect(collection.features).toHaveLength(2);
    expect(collection.features[0].properties.name).toBe('Lot A');
    expect(collection.features[1].properties.measurementType).toBe('line');
  });

  it('throws for invalid GeoJSON envelopes', () => {
    expect(() => parseImportedMeasurements(JSON.stringify({ type: 'Feature', features: [] }))).toThrow(
      'Invalid GeoJSON: expected a FeatureCollection.'
    );
  });

  it('throws when no supported geometry types are present', () => {
    const json = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [-80, 35]
          },
          properties: {}
        }
      ]
    });

    expect(() => parseImportedMeasurements(json)).toThrow('No supported Polygon or LineString features were found.');
  });
});
