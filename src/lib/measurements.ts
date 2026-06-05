import * as turf from '@turf/turf';
import type { Feature, LineString, Polygon } from 'geojson';
import type {
  DraftFeature,
  FeatureCenter,
  MeasurementCollection,
  MeasurementFeature,
  MeasurementGeometry,
  MeasurementProperties,
  MeasurementType
} from '../types';

const SQ_M_TO_SQ_FT = 10.76391041671;
const SQ_M_TO_ACRES = 0.00024710538146717;
const M_TO_FT = 3.2808398950131;

type ExistingFeatureMap = Map<string, MeasurementFeature>;

export function squareMetersToSquareFeet(value: number): number {
  return value * SQ_M_TO_SQ_FT;
}

export function squareMetersToAcres(value: number): number {
  return value * SQ_M_TO_ACRES;
}

export function metersToFeet(value: number): number {
  return value * M_TO_FT;
}

export function getMeasurementType(geometry: MeasurementGeometry): MeasurementType {
  return geometry.type === 'Polygon' ? 'polygon' : 'line';
}

export function calculateMeasurements(geometry: MeasurementGeometry): Pick<MeasurementProperties, 'areaSqM' | 'perimeterM' | 'lengthM'> {
  if (geometry.type === 'Polygon') {
    return {
      areaSqM: safeNumber(turf.area(geometry)),
      perimeterM: calculatePolygonPerimeter(geometry),
      lengthM: 0
    };
  }

  return {
    areaSqM: 0,
    perimeterM: 0,
    lengthM: safeNumber(turf.length({ type: 'Feature', properties: {}, geometry }, { units: 'meters' }))
  };
}

export function calculatePolygonPerimeter(geometry: Polygon): number {
  return geometry.coordinates.reduce((total, ring) => {
    if (ring.length < 2) {
      return total;
    }

    const line: Feature<LineString> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: ring
      }
    };

    return total + safeNumber(turf.length(line, { units: 'meters' }));
  }, 0);
}

export function createMeasuredCollection(features: DraftFeature[], previous: MeasurementFeature[] = []): MeasurementCollection {
  const previousById: ExistingFeatureMap = new Map(previous.map((feature) => [String(feature.id ?? feature.properties.id), feature]));
  const now = new Date().toISOString();
  let polygonCount = previous.filter((feature) => feature.geometry.type === 'Polygon').length;
  let lineCount = previous.filter((feature) => feature.geometry.type === 'LineString').length;

  return {
    type: 'FeatureCollection',
    features: features
      .filter((feature): feature is DraftFeature => isSupportedGeometry(feature.geometry))
      .map((feature) => {
        const id = String(feature.id ?? feature.properties?.id ?? crypto.randomUUID());
        const existing = previousById.get(id);
        const measurementType = getMeasurementType(feature.geometry);
        const measurements = calculateMeasurements(feature.geometry);
        const defaultName =
          measurementType === 'polygon' ? `Area ${++polygonCount}` : `Line ${++lineCount}`;

        return {
          type: 'Feature',
          id,
          geometry: feature.geometry,
          properties: {
            id,
            name: feature.properties?.name ?? existing?.properties.name ?? defaultName,
            measurementType,
            ...measurements,
            createdAt: feature.properties?.createdAt ?? existing?.properties.createdAt ?? now,
            updatedAt: now
          }
        };
      })
  };
}

export function getFeatureCenter(feature: MeasurementFeature): FeatureCenter {
  if (!feature.geometry.coordinates.length) {
    return { lat: null, lon: null };
  }

  try {
    const center = turf.center(feature).geometry.coordinates;
    return { lon: center[0] ?? null, lat: center[1] ?? null };
  } catch {
    return { lat: null, lon: null };
  }
}

export function formatArea(areaSqM: number): string {
  if (areaSqM <= 0) {
    return '0 sq ft';
  }

  const squareFeet = squareMetersToSquareFeet(areaSqM);
  const acres = squareMetersToAcres(areaSqM);

  if (acres >= 0.1) {
    return `${formatNumber(acres, 2)} acres`;
  }

  return `${formatNumber(squareFeet, 0)} sq ft`;
}

export function formatDistance(meters: number): string {
  if (meters <= 0) {
    return '0 ft';
  }

  const feet = metersToFeet(meters);
  if (feet >= 5280) {
    return `${formatNumber(feet / 5280, 2)} mi`;
  }

  return `${formatNumber(feet, 1)} ft`;
}

export function formatNumber(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits > 0 ? 0 : undefined
  }).format(safeNumber(value));
}

function isSupportedGeometry(geometry: MeasurementGeometry | null): geometry is MeasurementGeometry {
  return geometry?.type === 'Polygon' || geometry?.type === 'LineString';
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
