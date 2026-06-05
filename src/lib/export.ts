import type { MeasurementCollection, MeasurementFeature } from '../types';
import { getFeatureCenter, metersToFeet, squareMetersToAcres, squareMetersToSquareFeet } from './measurements';

const CSV_HEADERS = [
  'name',
  'type',
  'area_sq_ft',
  'area_acres',
  'area_sq_m',
  'perimeter_ft',
  'perimeter_m',
  'length_ft',
  'length_m',
  'center_lat',
  'center_lon'
];

export function toExportableGeoJson(features: MeasurementCollection): string {
  return JSON.stringify(features, null, 2);
}

export function toCsv(features: MeasurementCollection): string {
  const rows = features.features.map(featureToCsvRow);
  return [CSV_HEADERS, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\n');
}

export function downloadTextFile(filename: string, body: string, mimeType: string): void {
  const blob = new Blob([body], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function featureToCsvRow(feature: MeasurementFeature): Array<string | number | null> {
  const { areaSqM, perimeterM, lengthM, name, measurementType } = feature.properties;
  const center = getFeatureCenter(feature);

  return [
    name,
    measurementType,
    round(squareMetersToSquareFeet(areaSqM), 2),
    round(squareMetersToAcres(areaSqM), 4),
    round(areaSqM, 2),
    round(metersToFeet(perimeterM), 2),
    round(perimeterM, 2),
    round(metersToFeet(lengthM), 2),
    round(lengthM, 2),
    center.lat === null ? null : round(center.lat, 6),
    center.lon === null ? null : round(center.lon, 6)
  ];
}

function escapeCsvValue(value: string | number | null): string {
  if (value === null) {
    return '';
  }

  const raw = String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }

  return raw;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
