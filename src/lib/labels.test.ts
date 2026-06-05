import { describe, expect, it } from 'vitest';
import type { MeasurementCollection } from '../types';
import { createMeasurementLabelCollection } from './labels';

const collection: MeasurementCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'area-1',
      properties: {
        id: 'area-1',
        name: 'Main building',
        measurementType: 'polygon',
        areaSqM: 200,
        perimeterM: 60,
        lengthM: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
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
      properties: {
        id: 'line-1',
        name: 'Drive aisle',
        measurementType: 'line',
        areaSqM: 0,
        perimeterM: 0,
        lengthM: 25,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-80, 35],
          [-80.001, 35]
        ]
      }
    }
  ]
};

describe('createMeasurementLabelCollection', () => {
  it('creates point labels for measured polygons and lines', () => {
    const labels = createMeasurementLabelCollection(collection);

    expect(labels.features).toHaveLength(2);
    expect(labels.features[0].properties).toMatchObject({
      id: 'area-1',
      title: 'Main building',
      subtitle: '2,153 sq ft'
    });
    expect(labels.features[1].properties).toMatchObject({
      id: 'line-1',
      title: 'Drive aisle',
      subtitle: '82 ft'
    });
    expect(labels.features[0].geometry.type).toBe('Point');
    expect(labels.features[1].geometry.coordinates).toHaveLength(2);
  });

  it('returns an empty collection when there are no measurements', () => {
    expect(createMeasurementLabelCollection({ type: 'FeatureCollection', features: [] })).toEqual({
      type: 'FeatureCollection',
      features: []
    });
  });
});
