import * as turf from '@turf/turf';
import type { Feature, FeatureCollection, Point } from 'geojson';
import type { MeasurementCollection, MeasurementFeature } from '../types';
import { formatArea, formatDistance } from './measurements';

export type MeasurementLabelProperties = {
  id: string;
  title: string;
  subtitle: string;
};

export type MeasurementLabelFeature = Feature<Point, MeasurementLabelProperties>;
export type MeasurementLabelCollection = FeatureCollection<Point, MeasurementLabelProperties>;

export function createMeasurementLabelCollection(collection: MeasurementCollection): MeasurementLabelCollection {
  return {
    type: 'FeatureCollection',
    features: collection.features
      .map(createMeasurementLabel)
      .filter((feature): feature is MeasurementLabelFeature => Boolean(feature))
  };
}

function createMeasurementLabel(feature: MeasurementFeature): MeasurementLabelFeature | null {
  const coordinates = getLabelCoordinate(feature);
  if (!coordinates) {
    return null;
  }

  const isPolygon = feature.properties.measurementType === 'polygon';
  return {
    type: 'Feature',
    id: feature.properties.id,
    geometry: {
      type: 'Point',
      coordinates
    },
    properties: {
      id: feature.properties.id,
      title: feature.properties.name,
      subtitle: isPolygon ? formatArea(feature.properties.areaSqM) : formatDistance(feature.properties.lengthM)
    }
  };
}

function getLabelCoordinate(feature: MeasurementFeature): [number, number] | null {
  try {
    if (feature.geometry.type === 'Polygon') {
      const center = turf.centerOfMass(feature).geometry.coordinates;
      return [center[0], center[1]];
    }

    const line = turf.lineString(feature.geometry.coordinates);
    const length = turf.length(line, { units: 'meters' });
    const midpoint = turf.along(line, length / 2, { units: 'meters' }).geometry.coordinates;
    return [midpoint[0], midpoint[1]];
  } catch {
    return null;
  }
}
