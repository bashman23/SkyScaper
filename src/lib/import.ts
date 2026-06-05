import type { FeatureCollection, Geometry } from 'geojson';
import type { DrawFeatureCollection, MeasurementCollection } from '../types';
import { createMeasuredCollection } from './measurements';

export function parseImportedMeasurements(rawText: string): MeasurementCollection {
  const parsed = JSON.parse(rawText) as FeatureCollection<Geometry>;

  if (parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
    throw new Error('Invalid GeoJSON: expected a FeatureCollection.');
  }

  const supportedFeatures = parsed.features.filter(
    (feature): feature is DrawFeatureCollection['features'][number] =>
      feature?.type === 'Feature' &&
      Boolean(feature.geometry) &&
      (feature.geometry.type === 'Polygon' || feature.geometry.type === 'LineString')
  );

  if (supportedFeatures.length === 0) {
    throw new Error('No supported Polygon or LineString features were found.');
  }

  return createMeasuredCollection(supportedFeatures, []);
}
