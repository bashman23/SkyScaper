import { describe, expect, it } from 'vitest';
import type { DraftFeature, MeasurementFeature } from '../types';
import {
  calculateMeasurements,
  createMeasuredCollection,
  formatArea,
  formatDistance,
  metersToFeet,
  squareMetersToAcres,
  squareMetersToSquareFeet
} from './measurements';

const squarePolygon: DraftFeature = {
  type: 'Feature',
  id: 'area-1',
  properties: {},
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
};

const lineFeature: DraftFeature = {
  type: 'Feature',
  id: 'line-1',
  properties: {},
  geometry: {
    type: 'LineString',
    coordinates: [
      [0, 0],
      [0.001, 0]
    ]
  }
};

describe('measurement conversions and formatting', () => {
  it('converts metric values to imperial planning units', () => {
    expect(squareMetersToSquareFeet(100)).toBeCloseTo(1076.391, 3);
    expect(squareMetersToAcres(4046.8564224)).toBeCloseTo(1, 4);
    expect(metersToFeet(10)).toBeCloseTo(32.808, 3);
  });

  it('formats zero and non-zero values for compact display', () => {
    expect(formatArea(0)).toBe('0 sq ft');
    expect(formatDistance(0)).toBe('0 ft');
    expect(formatArea(100)).toBe('1,076 sq ft');
    expect(formatDistance(100)).toBe('328.1 ft');
  });
});

describe('calculateMeasurements', () => {
  it('calculates polygon area and perimeter without line length', () => {
    const result = calculateMeasurements(squarePolygon.geometry);
    expect(result.areaSqM).toBeGreaterThan(12000);
    expect(result.perimeterM).toBeGreaterThan(400);
    expect(result.lengthM).toBe(0);
  });

  it('calculates line length without area or perimeter', () => {
    const result = calculateMeasurements(lineFeature.geometry);
    expect(result.lengthM).toBeGreaterThan(100);
    expect(result.areaSqM).toBe(0);
    expect(result.perimeterM).toBe(0);
  });
});

describe('createMeasuredCollection', () => {
  it('adds stable properties to draft draw features', () => {
    const collection = createMeasuredCollection([squarePolygon, lineFeature]);
    expect(collection.features).toHaveLength(2);
    expect(collection.features[0].properties).toMatchObject({
      id: 'area-1',
      name: 'Area 1',
      measurementType: 'polygon'
    });
    expect(collection.features[1].properties).toMatchObject({
      id: 'line-1',
      name: 'Line 1',
      measurementType: 'line'
    });
  });

  it('preserves existing names and creation timestamps after edits', () => {
    const existing = createMeasuredCollection([squarePolygon]).features[0] as MeasurementFeature;
    const renamed: MeasurementFeature = {
      ...existing,
      properties: {
        ...existing.properties,
        name: 'North lot',
        createdAt: '2026-01-01T00:00:00.000Z'
      }
    };

    const collection = createMeasuredCollection([squarePolygon], [renamed]);
    expect(collection.features[0].properties.name).toBe('North lot');
    expect(collection.features[0].properties.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });
});
