import { describe, expect, it } from 'vitest';
import type { MeasurementCollection } from '../types';
import { toCsv, toExportableGeoJson } from './export';

const collection: MeasurementCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'area-1',
      properties: {
        id: 'area-1',
        name: 'Building, A',
        measurementType: 'polygon',
        areaSqM: 100,
        perimeterM: 40,
        lengthM: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [0.001, 0],
            [0.001, 0.001],
            [0, 0.001],
            [0, 0]
          ]
        ]
      }
    }
  ]
};

describe('export helpers', () => {
  it('exports pretty GeoJSON with measurement properties intact', () => {
    const geojson = JSON.parse(toExportableGeoJson(collection)) as MeasurementCollection;
    expect(geojson.features[0].properties.name).toBe('Building, A');
    expect(geojson.features[0].properties.areaSqM).toBe(100);
  });

  it('exports CSV using the required headers and escaped values', () => {
    const csv = toCsv(collection);
    expect(csv.split('\n')[0]).toBe(
      'name,type,area_sq_ft,area_acres,area_sq_m,perimeter_ft,perimeter_m,length_ft,length_m,center_lat,center_lon'
    );
    expect(csv).toContain('"Building, A",polygon');
    expect(csv).toContain('1076.39');
  });
});
