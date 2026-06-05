import { STORAGE_KEY, type MeasurementCollection, type StoredProject } from '../types';

const EMPTY_COLLECTION: MeasurementCollection = {
  type: 'FeatureCollection',
  features: []
};

export function createStoredProject(features: MeasurementCollection, selectedFeatureId: string | null): StoredProject {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    features,
    ui: {
      selectedFeatureId
    }
  };
}

export function saveProject(features: MeasurementCollection, selectedFeatureId: string | null, storage: Storage = localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(createStoredProject(features, selectedFeatureId)));
  } catch {
    // Ignore storage failures so measurement workflows keep running.
  }
}

export function loadProject(storage: Storage = localStorage): StoredProject {
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return createStoredProject(EMPTY_COLLECTION, null);
  }
  if (!raw) {
    return createStoredProject(EMPTY_COLLECTION, null);
  }

  try {
    const parsed = JSON.parse(raw) as StoredProject;
    if (parsed.version !== 1 || parsed.features?.type !== 'FeatureCollection') {
      return createStoredProject(EMPTY_COLLECTION, null);
    }

    return {
      version: 1,
      savedAt: parsed.savedAt,
      features: parsed.features,
      ui: {
        selectedFeatureId: parsed.ui?.selectedFeatureId ?? null
      }
    };
  } catch {
    return createStoredProject(EMPTY_COLLECTION, null);
  }
}
