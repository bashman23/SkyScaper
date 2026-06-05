import { beforeEach, describe, expect, it } from 'vitest';
import type { MeasurementCollection } from '../types';
import { STORAGE_KEY } from '../types';
import { createStoredProject, loadProject, saveProject } from './storage';

const collection: MeasurementCollection = {
  type: 'FeatureCollection',
  features: []
};

describe('storage helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and loads a versioned project', () => {
    saveProject(collection, 'feature-1');
    const loaded = loadProject();
    expect(loaded.version).toBe(1);
    expect(loaded.ui.selectedFeatureId).toBe('feature-1');
  });

  it('falls back to an empty project for invalid data', () => {
    localStorage.setItem(STORAGE_KEY, '{broken');
    expect(loadProject().features.features).toHaveLength(0);
  });

  it('creates the expected storage envelope', () => {
    const project = createStoredProject(collection, null);
    expect(project).toMatchObject({
      version: 1,
      features: collection,
      ui: { selectedFeatureId: null }
    });
  });

  it('does not throw when storage.setItem fails', () => {
    const brokenStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0
    } as unknown as Storage;

    expect(() => saveProject(collection, null, brokenStorage)).not.toThrow();
  });

  it('falls back to empty project when storage.getItem throws', () => {
    const brokenStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => undefined,
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0
    } as unknown as Storage;

    const loaded = loadProject(brokenStorage);
    expect(loaded.version).toBe(1);
    expect(loaded.features.features).toHaveLength(0);
    expect(loaded.ui.selectedFeatureId).toBeNull();
  });
});
