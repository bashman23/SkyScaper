import type { Feature, FeatureCollection, LineString, Polygon, Position } from 'geojson';

export const STORAGE_KEY = 'map-measurement:v1';

export type MeasurementType = 'polygon' | 'line';

export type MeasurementProperties = {
  id: string;
  name: string;
  layerPath?: string;
  color?: string;
  measurementType: MeasurementType;
  areaSqM: number;
  perimeterM: number;
  lengthM: number;
  createdAt: string;
  updatedAt: string;
};

export type MeasurementGeometry = Polygon | LineString;

export type MeasurementFeature = Feature<MeasurementGeometry, MeasurementProperties>;

export type MeasurementCollection = FeatureCollection<MeasurementGeometry, MeasurementProperties>;

export type StoredProject = {
  version: 1;
  savedAt: string;
  features: MeasurementCollection;
  ui: {
    selectedFeatureId: string | null;
  };
};

export type FeatureCenter = {
  lat: number | null;
  lon: number | null;
};

export type DraftFeature = Feature<MeasurementGeometry, Partial<MeasurementProperties>>;

export type DrawFeatureCollection = FeatureCollection<MeasurementGeometry, Partial<MeasurementProperties>>;

export type NamedCoordinate = Position;
