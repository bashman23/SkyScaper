import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import {
  Download,
  Eraser,
  Hand,
  LocateFixed,
  MapPinned,
  Menu,
  MousePointer2,
  Pentagon,
  Redo2,
  Ruler,
  Scissors,
  Search,
  Trash2,
  Undo2,
  Upload,
  X
} from 'lucide-react';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';
import type { DrawFeatureCollection, MeasurementCollection, MeasurementFeature } from './types';
import { AdSlot } from './components/AdSlot';
import { getLegalPageKind, LegalPage } from './components/LegalPages';
import { MaterialCalculator } from './components/MaterialCalculator';
import { createMeasuredCollection, formatArea, formatDistance, formatNumber, metersToFeet, squareMetersToAcres, squareMetersToSquareFeet } from './lib/measurements';
import { downloadTextFile, toCsv, toExportableGeoJson } from './lib/export';
import { loadProject, saveProject } from './lib/storage';
import { searchPlaces, type GeocodeResult } from './lib/geocoding';
import { createMeasurementLabelCollection } from './lib/labels';
import { parseImportedMeasurements } from './lib/import';

type DrawMode = 'simple_select' | 'draw_polygon' | 'draw_line_string' | 'freehand' | 'cut';
const LABEL_SOURCE_ID = 'measurement-labels';
const LABEL_HALO_LAYER_ID = 'measurement-label-halos';
const LABEL_LAYER_ID = 'measurement-label-text';
const FREEHAND_PREVIEW_SOURCE_ID = 'freehand-preview';
const FREEHAND_PREVIEW_FILL_LAYER_ID = 'freehand-preview-fill';
const FREEHAND_PREVIEW_LINE_LAYER_ID = 'freehand-preview-line';
const MAX_HISTORY_SIZE = 75;

const EMPTY_COLLECTION: MeasurementCollection = {
  type: 'FeatureCollection',
  features: []
};

export default function App() {
  const legalPageKind = getLegalPageKind(window.location.pathname);
  if (legalPageKind) {
    return <LegalPage kind={legalPageKind} />;
  }

  return <MeasurementApp />;
}

function MeasurementApp() {
  const mapboxToken = getMapboxToken();
  const initialProject = useMemo(() => loadProject(), []);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const freehandPointsRef = useRef<Array<[number, number]>>([]);
  const freehandDrawingRef = useRef(false);
  const activeModeRef = useRef<DrawMode>('simple_select');
  const isApplyingSnapshotRef = useRef(false);
  const featuresRef = useRef<MeasurementCollection>(initialProject.features);
  const historyRef = useRef<MeasurementCollection[]>([cloneCollection(initialProject.features)]);
  const [features, setFeatures] = useState<MeasurementCollection>(initialProject.features);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(initialProject.ui.selectedFeatureId);
  const selectedFeatureIdRef = useRef<string | null>(initialProject.ui.selectedFeatureId);
  const [activeMode, setActiveMode] = useState<DrawMode>('simple_select');
  const [mapReady, setMapReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'error' | 'empty'>('idle');
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState('');
  const [panelOpen, setPanelOpen] = useState(true);
  const [isFreehandDrawing, setIsFreehandDrawing] = useState(false);
  const [rectangleInput, setRectangleInput] = useState('10x20');
  const [rectangleUnits, setRectangleUnits] = useState<'ft' | 'm'>('ft');

  useEffect(() => {
    activeModeRef.current = activeMode;
  }, [activeMode]);

  useEffect(() => {
    selectedFeatureIdRef.current = selectedFeatureId;
  }, [selectedFeatureId]);

  const pushHistorySnapshot = (collection: MeasurementCollection) => {
    const snapshot = cloneCollection(collection);
    const activeSnapshot = historyRef.current[historyIndex];
    if (activeSnapshot && areCollectionsEqual(activeSnapshot, snapshot)) {
      return;
    }

    let nextHistory = historyRef.current.slice(0, historyIndex + 1);
    nextHistory.push(snapshot);
    if (nextHistory.length > MAX_HISTORY_SIZE) {
      nextHistory = nextHistory.slice(nextHistory.length - MAX_HISTORY_SIZE);
    }

    historyRef.current = nextHistory;
    setHistoryIndex(nextHistory.length - 1);
  };

  const applyMeasuredCollection = (collection: MeasurementCollection, recordHistory: boolean, nextSelectedFeatureId: string | null = null) => {
    const draw = drawRef.current;
    if (!draw) {
      return;
    }

    isApplyingSnapshotRef.current = true;
    draw.set(collection as unknown as FeatureCollection);
    writeMeasurementPropertiesToDraw(draw, collection);
    isApplyingSnapshotRef.current = false;

    featuresRef.current = collection;
    setFeatures(collection);
    setSelectedFeatureId(nextSelectedFeatureId);
    updateMeasurementLabels(mapRef.current, collection);

    if (recordHistory) {
      pushHistorySnapshot(collection);
    }
  };

  useEffect(() => {
    featuresRef.current = features;
    saveProject(features, selectedFeatureId);
  }, [features, selectedFeatureId]);

  useEffect(() => {
    if (!mapContainerRef.current || !mapboxToken || mapRef.current) {
      return;
    }

    mapboxgl.accessToken = mapboxToken;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-98.5795, 39.8283],
      zoom: 3.5,
      pitch: 0
    });

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      defaultMode: 'simple_select',
      userProperties: true,
      styles: getDrawStyles()
    });

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-left');
    map.addControl(draw, 'top-left');
    mapRef.current = map;
    drawRef.current = draw;

    const syncMeasurements = () => {
      const raw = draw.getAll() as DrawFeatureCollection;
      const measured = createMeasuredCollection(raw.features, featuresRef.current.features);
      featuresRef.current = measured;
      setFeatures(measured);
      writeMeasurementPropertiesToDraw(draw, measured);
      updateMeasurementLabels(map, measured);
      if (!isApplyingSnapshotRef.current) {
        pushHistorySnapshot(measured);
      }
    };

    const handleSelection = (event: { features?: Array<Feature<Geometry>> }) => {
      const id = event.features?.[0]?.id;
      setSelectedFeatureId(id === undefined ? null : String(id));
    };

    const handleModeChange = (event: { mode?: DrawMode }) => {
      if (activeModeRef.current === 'freehand' || activeModeRef.current === 'cut') {
        return;
      }

      if (event.mode) {
        setActiveMode(event.mode);
      }
    };

    const handleDrawCreate = (event: { features?: Array<Feature<Geometry>> }) => {
      const cutter = event.features?.[0];
      const drawActiveMode = activeModeRef.current;

      if (drawActiveMode === 'cut' && cutter?.geometry?.type === 'Polygon' && drawRef.current) {
        const previousFeatures = featuresRef.current.features;
        const nextDraftFeatures: DrawFeatureCollection['features'] = [];
        let changed = false;

        previousFeatures.forEach((feature) => {
          if (feature.geometry.type !== 'Polygon') {
            nextDraftFeatures.push(feature as DrawFeatureCollection['features'][number]);
            return;
          }

          const intersects = turf.booleanIntersects(feature as unknown as Feature<Polygon | MultiPolygon>, cutter as Feature<Polygon>);
          if (!intersects) {
            nextDraftFeatures.push(feature as DrawFeatureCollection['features'][number]);
            return;
          }

          changed = true;
          const differenceFeature = turf.difference(
            turf.featureCollection([
              feature as unknown as Feature<Polygon | MultiPolygon>,
              cutter as Feature<Polygon>
            ])
          );

          if (!differenceFeature) {
            return;
          }

          const parts = toPolygonGeometries(differenceFeature.geometry);
          parts.forEach((geometry, partIndex) => {
            const nextId = partIndex === 0 ? String(feature.id ?? feature.properties.id) : crypto.randomUUID();
            nextDraftFeatures.push({
              ...feature,
              id: nextId,
              geometry,
              properties: {
                ...feature.properties,
                id: nextId,
                name: partIndex === 0 ? feature.properties.name : `${feature.properties.name} (part ${partIndex + 1})`,
                updatedAt: new Date().toISOString()
              }
            });
          });
        });

        if (changed) {
          const nextMeasuredCollection = createMeasuredCollection(nextDraftFeatures, previousFeatures);
          applyMeasuredCollection(nextMeasuredCollection, true, null);
        } else {
          applyMeasuredCollection(cloneCollection(featuresRef.current), false, selectedFeatureIdRef.current);
        }

        changeDrawMode(drawRef.current, 'draw_polygon');
        setActiveMode('cut');
        return;
      }

      syncMeasurements();
    };

    map.on('load', () => {
      addFreehandPreviewLayers(map);
      addMeasurementLabelLayers(map);
      if (initialProject.features.features.length > 0) {
        draw.set(initialProject.features as unknown as FeatureCollection);
        writeMeasurementPropertiesToDraw(draw, initialProject.features);
      }
      updateMeasurementLabels(map, initialProject.features);
      setMapReady(true);
    });
    map.on('draw.create', handleDrawCreate);
    map.on('draw.update', syncMeasurements);
    map.on('draw.delete', syncMeasurements);
    map.on('draw.selectionchange', handleSelection);
    map.on('draw.modechange', handleModeChange);

    return () => {
      map.off('draw.create', handleDrawCreate);
      map.off('draw.update', syncMeasurements);
      map.off('draw.delete', syncMeasurements);
      map.off('draw.selectionchange', handleSelection);
      map.off('draw.modechange', handleModeChange);
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
  }, [initialProject.features, mapboxToken]);

  const selectedFeature = features.features.find((feature) => String(feature.id) === selectedFeatureId) ?? null;
  const totals = useMemo(() => getTotals(features.features), [features.features]);
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < historyRef.current.length - 1;

  const syncMeasurementsFromDraw = (recordHistory: boolean) => {
    if (!drawRef.current) {
      return;
    }

    const measured = createMeasuredCollection((drawRef.current.getAll() as DrawFeatureCollection).features, featuresRef.current.features);
    featuresRef.current = measured;
    setFeatures(measured);
    writeMeasurementPropertiesToDraw(drawRef.current, measured);
    updateMeasurementLabels(mapRef.current, measured);

    if (recordHistory) {
      pushHistorySnapshot(measured);
    }
  };

  const changeMode = (mode: DrawMode) => {
    if (mode === 'freehand') {
      changeDrawMode(drawRef.current, 'simple_select');
      setActiveMode('freehand');
      return;
    }

    if (mode === 'cut') {
      changeDrawMode(drawRef.current, 'draw_polygon');
      setActiveMode('cut');
      return;
    }

    changeDrawMode(drawRef.current, mode);
    setActiveMode(mode);
  };

  const undo = () => {
    if (!canUndo) {
      return;
    }

    const targetIndex = historyIndex - 1;
    const snapshot = historyRef.current[targetIndex];
    if (!snapshot) {
      return;
    }

    applyMeasuredCollection(cloneCollection(snapshot), false, null);
    setHistoryIndex(targetIndex);
  };

  const redo = () => {
    if (!canRedo) {
      return;
    }

    const targetIndex = historyIndex + 1;
    const snapshot = historyRef.current[targetIndex];
    if (!snapshot) {
      return;
    }

    applyMeasuredCollection(cloneCollection(snapshot), false, null);
    setHistoryIndex(targetIndex);
  };

  useEffect(() => {
    const handleKeyboardShortcuts = (event: KeyboardEvent) => {
      const commandPressed = event.ctrlKey || event.metaKey;
      const lowerKey = event.key.toLowerCase();
      const isUndo = commandPressed && !event.shiftKey && lowerKey === 'z';
      const isRedo = (commandPressed && event.shiftKey && lowerKey === 'z') || (commandPressed && lowerKey === 'y');

      if (isUndo) {
        event.preventDefault();
        undo();
      }

      if (isRedo) {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyboardShortcuts);
    return () => {
      window.removeEventListener('keydown', handleKeyboardShortcuts);
    };
  }, [canRedo, canUndo, historyIndex]);

  const deleteSelectedFeature = () => {
    if (!selectedFeatureId || !drawRef.current) {
      return;
    }

    drawRef.current.delete(selectedFeatureId);
    setSelectedFeatureId(null);
    syncMeasurementsFromDraw(true);
  };

  const clearAllFeatures = () => {
    if (!drawRef.current || features.features.length === 0) {
      return;
    }

    drawRef.current.deleteAll();
    setSelectedFeatureId(null);
    featuresRef.current = EMPTY_COLLECTION;
    setFeatures(EMPTY_COLLECTION);
    updateMeasurementLabels(mapRef.current, EMPTY_COLLECTION);
    pushHistorySnapshot(EMPTY_COLLECTION);
  };

  const clearAllAreas = () => {
    if (!drawRef.current) {
      return;
    }

    const remaining = featuresRef.current.features.filter((feature) => feature.geometry.type !== 'Polygon');
    const nextCollection: MeasurementCollection = {
      type: 'FeatureCollection',
      features: remaining
    };

    setSelectedFeatureId(null);
    applyMeasuredCollection(nextCollection, true, null);
  };

  const renameSelectedFeature = (name: string) => {
    if (!selectedFeatureId) {
      return;
    }

    const trimmedName = name.trimStart();
    const updatedAt = new Date().toISOString();
    drawRef.current?.setFeatureProperty(selectedFeatureId, 'name', trimmedName);
    drawRef.current?.setFeatureProperty(selectedFeatureId, 'updatedAt', updatedAt);

    const nextFeatures: MeasurementCollection = {
      type: 'FeatureCollection',
      features: features.features.map((feature) =>
        String(feature.id) === selectedFeatureId
          ? { ...feature, properties: { ...feature.properties, name: trimmedName, updatedAt } }
          : feature
      )
    };

    featuresRef.current = nextFeatures;
    setFeatures(nextFeatures);
    updateMeasurementLabels(mapRef.current, nextFeatures);
    pushHistorySnapshot(nextFeatures);
  };

  const updateSelectedFeatureLayerPath = (layerPath: string) => {
    if (!selectedFeatureId) {
      return;
    }

    const nextPath = layerPath.trimStart() || 'Base';
    const updatedAt = new Date().toISOString();
    drawRef.current?.setFeatureProperty(selectedFeatureId, 'layerPath', nextPath);
    drawRef.current?.setFeatureProperty(selectedFeatureId, 'updatedAt', updatedAt);

    const nextFeatures: MeasurementCollection = {
      type: 'FeatureCollection',
      features: features.features.map((feature) =>
        String(feature.id) === selectedFeatureId
          ? { ...feature, properties: { ...feature.properties, layerPath: nextPath, updatedAt } }
          : feature
      )
    };

    featuresRef.current = nextFeatures;
    setFeatures(nextFeatures);
    updateMeasurementLabels(mapRef.current, nextFeatures);
    pushHistorySnapshot(nextFeatures);
  };

  const createRectangleFromInput = () => {
    const parsed = parseDimensionInput(rectangleInput);
    const map = mapRef.current;
    const draw = drawRef.current;
    if (!parsed || !map || !draw) {
      return;
    }

    const widthMeters = rectangleUnits === 'ft' ? feetToMeters(parsed.width) : parsed.width;
    const heightMeters = rectangleUnits === 'ft' ? feetToMeters(parsed.height) : parsed.height;
    if (widthMeters <= 0 || heightMeters <= 0) {
      return;
    }

    const center = map.getCenter();
    const latRad = (center.lat * Math.PI) / 180;
    const deltaLat = (heightMeters / 2) / 111320;
    const cosLat = Math.max(Math.cos(latRad), 0.0001);
    const deltaLng = (widthMeters / 2) / (111320 * cosLat);

    const rectangleFeatureId = crypto.randomUUID();
    const corners: Array<[number, number]> = [
      [center.lng - deltaLng, center.lat - deltaLat],
      [center.lng + deltaLng, center.lat - deltaLat],
      [center.lng + deltaLng, center.lat + deltaLat],
      [center.lng - deltaLng, center.lat + deltaLat],
      [center.lng - deltaLng, center.lat - deltaLat]
    ];

    draw.add({
      type: 'Feature',
      id: rectangleFeatureId,
      properties: {
        id: rectangleFeatureId,
        name: `Rectangle ${parsed.width}x${parsed.height} ${rectangleUnits}`,
        layerPath: 'Base'
      },
      geometry: {
        type: 'Polygon',
        coordinates: [corners]
      }
    } as unknown as Feature);

    setSelectedFeatureId(rectangleFeatureId);
    changeDrawMode(draw, 'simple_select', { featureIds: [rectangleFeatureId] });
    setActiveMode('simple_select');
    syncMeasurementsFromDraw(true);
  };

  useEffect(() => {
    const map = mapRef.current;
    const draw = drawRef.current;
    if (!map || !draw || activeMode !== 'freehand') {
      return;
    }

    const canvas = map.getCanvas();
    const previousCursor = canvas.style.cursor;
    canvas.style.cursor = 'crosshair';

    const handleMouseDown = (event: mapboxgl.MapMouseEvent) => {
      freehandDrawingRef.current = true;
      setIsFreehandDrawing(true);
      freehandPointsRef.current = [[event.lngLat.lng, event.lngLat.lat]];
      updateFreehandPreview(map, freehandPointsRef.current);
      map.dragPan.disable();
    };

    const handleMouseMove = (event: mapboxgl.MapMouseEvent) => {
      if (!freehandDrawingRef.current) {
        return;
      }

      freehandPointsRef.current.push([event.lngLat.lng, event.lngLat.lat]);
      updateFreehandPreview(map, freehandPointsRef.current);
    };

    const completeFreehand = () => {
      if (!freehandDrawingRef.current) {
        return;
      }

      freehandDrawingRef.current = false;
      setIsFreehandDrawing(false);
      map.dragPan.enable();
      const points = freehandPointsRef.current;
      freehandPointsRef.current = [];
      clearFreehandPreview(map);

      if (points.length < 3) {
        return;
      }

      const simplifiedRing = simplifyFreehandRing(points, 42);
      if (simplifiedRing.length < 4) {
        return;
      }

      const featureId = crypto.randomUUID();
      draw.add({
        type: 'Feature',
        id: featureId,
        properties: {
          id: featureId,
          name: 'Freehand Area',
          layerPath: 'Base'
        },
        geometry: {
          type: 'Polygon',
          coordinates: [simplifiedRing]
        }
      } as unknown as Feature);

      setSelectedFeatureId(null);
      setActiveMode('simple_select');
      changeDrawMode(draw, 'simple_select');
      syncMeasurementsFromDraw(true);
    };

    map.on('mousedown', handleMouseDown);
    map.on('mousemove', handleMouseMove);
    map.on('mouseup', completeFreehand);
    map.on('mouseout', completeFreehand);

    return () => {
      canvas.style.cursor = previousCursor;
      map.dragPan.enable();
      map.off('mousedown', handleMouseDown);
      map.off('mousemove', handleMouseMove);
      map.off('mouseup', completeFreehand);
      map.off('mouseout', completeFreehand);
      clearFreehandPreview(map);
      freehandDrawingRef.current = false;
      setIsFreehandDrawing(false);
      freehandPointsRef.current = [];
    };
  }, [activeMode]);

  const onImportClick = () => {
    importInputRef.current?.click();
  };

  const onImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const imported = parseImportedMeasurements(text);
      applyMeasuredCollection(imported, true, null);
      setImportStatus('success');
      setImportMessage(`Imported ${imported.features.length} measurement${imported.features.length === 1 ? '' : 's'}.`);
    } catch (error) {
      setImportStatus('error');
      if (error instanceof Error) {
        setImportMessage(error.message);
      } else {
        setImportMessage('Import failed. Provide a valid GeoJSON FeatureCollection.');
      }
    } finally {
      event.target.value = '';
    }
  };

  const exportGeoJson = () => {
    downloadTextFile('map-measurements.geojson', toExportableGeoJson(features), 'application/geo+json');
  };

  const exportCsv = () => {
    downloadTextFile('map-measurements.csv', toCsv(features), 'text/csv;charset=utf-8');
  };

  const submitSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!mapboxToken || !searchQuery.trim()) {
      return;
    }

    setSearchStatus('loading');
    try {
      const results = await searchPlaces(searchQuery, mapboxToken);
      setSearchResults(results);
      setSearchStatus(results.length === 0 ? 'empty' : 'idle');
      if (results[0]) {
        flyToResult(results[0]);
      }
    } catch {
      setSearchResults([]);
      setSearchStatus('error');
    }
  };

  const flyToResult = (result: GeocodeResult) => {
    mapRef.current?.flyTo({
      center: result.center,
      zoom: 18,
      essential: true
    });
  };

  return (
    <main className={mapboxToken ? 'app-shell' : 'app-shell missing-token'}>
      <div ref={mapContainerRef} className="map-canvas" aria-label="Satellite measurement map" />

      {!mapboxToken ? <TokenNotice /> : null}

      <section className="tool-rail" aria-label="Drawing tools">
        <button className={activeMode === 'simple_select' ? 'icon-button active' : 'icon-button'} onClick={() => changeMode('simple_select')} title="Select and edit">
          <MousePointer2 size={20} aria-hidden="true" />
        </button>
        <button className={activeMode === 'draw_polygon' ? 'icon-button active' : 'icon-button'} onClick={() => changeMode('draw_polygon')} title="Draw area">
          <Pentagon size={20} aria-hidden="true" />
        </button>
        <button className={activeMode === 'draw_line_string' ? 'icon-button active' : 'icon-button'} onClick={() => changeMode('draw_line_string')} title="Draw line">
          <Ruler size={20} aria-hidden="true" />
        </button>
        <button className={activeMode === 'freehand' ? 'icon-button active' : 'icon-button'} onClick={() => changeMode('freehand')} title="Freehand pen">
          Pen
        </button>
        <button className={activeMode === 'cut' ? 'icon-button active' : 'icon-button'} onClick={() => changeMode('cut')} title="Cut from selected area">
          <Scissors size={18} aria-hidden="true" />
        </button>
        <button className="icon-button" onClick={deleteSelectedFeature} disabled={!selectedFeatureId} title="Delete selected">
          <Trash2 size={20} aria-hidden="true" />
        </button>
        <button className="icon-button danger" onClick={clearAllFeatures} disabled={features.features.length === 0} title="Clear all">
          <Eraser size={20} aria-hidden="true" />
        </button>
        <button className="icon-button mobile-menu-toggle" onClick={() => setPanelOpen(!panelOpen)} title="Toggle panel">
          {panelOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
      </section>

      <aside className="quick-selection-panel" aria-label="Quick selection list">
        <div className="quick-selection-title">Selections</div>
        <ol>
          {features.features.map((feature) => {
            const id = String(feature.id ?? feature.properties.id);
            const isSelected = id === selectedFeatureId;
            const primary = feature.properties.measurementType === 'polygon' ? formatArea(feature.properties.areaSqM) : formatDistance(feature.properties.lengthM);
            return (
              <li key={id}>
                <button className={isSelected ? 'quick-selection-row selected' : 'quick-selection-row'} onClick={() => {
                  setSelectedFeatureId(id);
                  changeDrawMode(drawRef.current, 'simple_select', { featureIds: [id] });
                }}>
                  <span className="quick-swatch" style={{ backgroundColor: feature.properties.color ?? '#22c55e' }} aria-hidden="true" />
                  <span className="quick-selection-copy">
                    <strong>{feature.properties.name}</strong>
                    <small>{primary}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </aside>

      <aside className={`measurement-panel ${panelOpen ? 'open' : 'closed'}`} aria-label="Measurements">
        <header className="panel-header">
          <div>
            <p className="eyebrow">Free professional tool</p>
            <h1>Map Measurement</h1>
          </div>
          <span className={mapReady ? 'status ready' : 'status'}>{mapReady ? 'Ready' : 'Loading'}</span>
        </header>

        <div className="summary-grid" aria-label="Measurement totals">
          <Metric label="Areas" value={String(totals.polygons)} />
          <Metric label="Lines" value={String(totals.lines)} />
          <Metric label="Total area" value={formatArea(totals.areaSqM)} />
          <Metric label="Total length" value={formatDistance(totals.lengthM)} />
        </div>

        <details className="panel-group" open>
          <summary>Drawing and Search</summary>
          <section className="shape-builder" aria-label="Create a rectangle by dimensions">
            <div className="shape-builder-header">
              <strong>Quick Shape Builder</strong>
              {activeMode === 'freehand' ? <span>{isFreehandDrawing ? 'Drawing...' : 'Pen mode ready'}</span> : null}
              {activeMode === 'cut' ? <span>Select area, then draw cut shape</span> : null}
            </div>
            <div className="shape-builder-row">
              <input
                aria-label="Rectangle dimensions"
                value={rectangleInput}
                onChange={(event) => setRectangleInput(event.target.value)}
                placeholder="10x20"
              />
              <select aria-label="Rectangle units" value={rectangleUnits} onChange={(event) => setRectangleUnits(event.target.value as 'ft' | 'm')}>
                <option value="ft">ft</option>
                <option value="m">m</option>
              </select>
              <button className="action-button" type="button" onClick={createRectangleFromInput}>
                Add
              </button>
            </div>
            <p>Type dimensions like 10x20 to create a movable rectangle at map center.</p>
          </section>

          <section className="search-panel" aria-label="Find a property">
          <form onSubmit={submitSearch}>
            <label htmlFor="property-search">Find property</label>
            <div className="search-input-row">
              <input
                id="property-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Address, city, or place"
                disabled={!mapboxToken}
              />
              <button type="submit" disabled={!mapboxToken || !searchQuery.trim() || searchStatus === 'loading'} title="Search map">
                <Search size={17} aria-hidden="true" />
              </button>
            </div>
          </form>
          {searchStatus === 'loading' ? <p className="search-status">Searching...</p> : null}
          {searchStatus === 'error' ? <p className="search-status error">Search failed. Check the token and try again.</p> : null}
          {searchStatus === 'empty' ? <p className="search-status">No results found.</p> : null}
          {searchResults.length > 0 ? (
            <ol className="search-results">
              {searchResults.map((result) => (
                <li key={result.id}>
                  <button type="button" onClick={() => flyToResult(result)}>
                    <LocateFixed size={15} aria-hidden="true" />
                    <span>
                      <strong>{result.name}</strong>
                      <small>{result.fullAddress}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          ) : null}
          </section>

          <div className="history-row">
            <button className="action-button" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
              <Undo2 size={16} aria-hidden="true" />
              Undo
            </button>
            <button className="action-button" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">
              <Redo2 size={16} aria-hidden="true" />
              Redo
            </button>
          </div>

          <div className="history-row">
            <button className="action-button" onClick={clearAllAreas} disabled={features.features.every((feature) => feature.geometry.type !== 'Polygon')} title="Remove all areas">
              <Trash2 size={16} aria-hidden="true" />
              Remove Areas
            </button>
            <button className="action-button" onClick={clearAllFeatures} disabled={features.features.length === 0} title="Clear all selections">
              <Eraser size={16} aria-hidden="true" />
              Clear All
            </button>
          </div>

          <div className="export-row">
            <input
              ref={importInputRef}
              type="file"
              accept=".json,.geojson,application/geo+json,application/json"
              onChange={onImportFileChange}
              hidden
            />
            <button className="action-button" onClick={onImportClick}>
              <Upload size={16} aria-hidden="true" />
              Import
            </button>
            <button className="action-button" onClick={exportGeoJson} disabled={features.features.length === 0}>
              <Download size={16} aria-hidden="true" />
              GeoJSON
            </button>
            <button className="action-button" onClick={exportCsv} disabled={features.features.length === 0}>
              <Download size={16} aria-hidden="true" />
              CSV
            </button>
          </div>
          {importStatus !== 'idle' ? <p className={importStatus === 'error' ? 'import-status error' : 'import-status'}>{importMessage}</p> : null}
        </details>

        <details className="panel-group" open>
          <summary>Estimator</summary>
          <AdSlot />
          <MaterialCalculator areaSqM={totals.areaSqM} lengthM={totals.lengthM} />
        </details>

        <details className="panel-group" open>
          <summary>Selections</summary>
          <SelectedFeatureEditor feature={selectedFeature} onRename={renameSelectedFeature} onLayerPathChange={updateSelectedFeatureLayerPath} />

          <FeatureList features={features.features} selectedFeatureId={selectedFeatureId} onSelect={(id) => {
            setSelectedFeatureId(id);
            changeDrawMode(drawRef.current, 'simple_select', { featureIds: [id] });
          }} />
        </details>

        <footer className="accuracy-note">
          <MapPinned size={16} aria-hidden="true" />
          <span>Planning estimates only. Imagery resolution, roof perspective, and manual vertex placement affect accuracy.</span>
        </footer>

        <nav className="legal-links" aria-label="Site information">
          <a href="/guide">Guide</a>
          <a href="/about">About</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/contact">Contact</a>
        </nav>
      </aside>
    </main>
  );
}

function cloneCollection(collection: MeasurementCollection): MeasurementCollection {
  return JSON.parse(JSON.stringify(collection)) as MeasurementCollection;
}

function areCollectionsEqual(a: MeasurementCollection, b: MeasurementCollection): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SelectedFeatureEditor({
  feature,
  onRename,
  onLayerPathChange
}: {
  feature: MeasurementFeature | null;
  onRename: (name: string) => void;
  onLayerPathChange: (layerPath: string) => void;
}) {
  if (!feature) {
    return (
      <section className="selected-empty">
        <Hand size={18} aria-hidden="true" />
        <span>Select a shape or draw a new area/line.</span>
      </section>
    );
  }

  return (
    <section className="selected-feature">
      <input
        aria-label="Measurement name"
        value={feature.properties.name}
        onChange={(event) => onRename(event.target.value)}
        onBlur={(event) => onRename(event.target.value.trim() || feature.properties.name)}
      />
      <input
        aria-label="Layer path"
        value={feature.properties.layerPath ?? 'Base'}
        onChange={(event) => onLayerPathChange(event.target.value)}
        onBlur={(event) => onLayerPathChange(event.target.value.trim() || 'Base')}
        placeholder="Layer path (ex: Lot/Inner Island)"
      />
      <div className="detail-grid">
        {feature.properties.measurementType === 'polygon' ? (
          <>
            <Metric label="Area" value={`${formatNumber(squareMetersToSquareFeet(feature.properties.areaSqM), 0)} sq ft`} />
            <Metric label="Acres" value={formatNumber(squareMetersToAcres(feature.properties.areaSqM), 3)} />
            <Metric label="Sq meters" value={formatNumber(feature.properties.areaSqM, 1)} />
            <Metric label="Perimeter" value={`${formatNumber(metersToFeet(feature.properties.perimeterM), 1)} ft`} />
          </>
        ) : (
          <>
            <Metric label="Length" value={`${formatNumber(metersToFeet(feature.properties.lengthM), 1)} ft`} />
            <Metric label="Meters" value={formatNumber(feature.properties.lengthM, 1)} />
          </>
        )}
      </div>
    </section>
  );
}

function FeatureList({
  features,
  selectedFeatureId,
  onSelect
}: {
  features: MeasurementFeature[];
  selectedFeatureId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="feature-list" aria-label="Saved measurements">
      <div className="list-title">
        <span>Measurements</span>
        <span>{features.length}</span>
      </div>
      {features.length === 0 ? (
        <p className="empty-list">Draw a polygon for a building or lot, or draw a line for an edge or span.</p>
      ) : (
        <ol>
          {features.map((feature) => {
            const id = String(feature.id ?? feature.properties.id);
            const isSelected = id === selectedFeatureId;
            const primary =
              feature.properties.measurementType === 'polygon'
                ? formatArea(feature.properties.areaSqM)
                : formatDistance(feature.properties.lengthM);

            return (
              <li key={id}>
                <button className={isSelected ? 'feature-row selected' : 'feature-row'} onClick={() => onSelect(id)}>
                  <span>
                    <strong>{feature.properties.name}</strong>
                    <small>{feature.properties.measurementType} • {feature.properties.layerPath ?? 'Base'}</small>
                  </span>
                  <b>{primary}</b>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function TokenNotice() {
  return (
    <div className="token-notice" role="alert">
      <strong>Mapbox token required</strong>
      <span>Add `VITE_MAPBOX_ACCESS_TOKEN` to a local `.env` file, then restart the dev server.</span>
    </div>
  );
}

function parseDimensionInput(value: string): { width: number; height: number } | null {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)$/);
  if (!match) {
    return null;
  }

  const width = Number.parseFloat(match[1]);
  const height = Number.parseFloat(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }

  return { width, height };
}

function feetToMeters(feet: number): number {
  return feet * 0.3048;
}

function toPolygonGeometries(geometry: Polygon | MultiPolygon): Polygon[] {
  if (geometry.type === 'Polygon') {
    return [geometry];
  }

  if (geometry.coordinates.length === 0) {
    return [];
  }

  return geometry.coordinates
    .map((coordinates) => ({
      coordinates,
      area: turf.area({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates } })
    }))
    .sort((a, b) => b.area - a.area)
    .map((entry) => ({ type: 'Polygon', coordinates: entry.coordinates }));
}

function getTotals(features: MeasurementFeature[]) {
  return features.reduce(
    (totals, feature) => ({
      polygons: totals.polygons + (feature.properties.measurementType === 'polygon' ? 1 : 0),
      lines: totals.lines + (feature.properties.measurementType === 'line' ? 1 : 0),
      areaSqM: totals.areaSqM + feature.properties.areaSqM,
      lengthM: totals.lengthM + feature.properties.lengthM
    }),
    { polygons: 0, lines: 0, areaSqM: 0, lengthM: 0 }
  );
}

function getMapboxToken(): string {
  return (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined)?.trim() ?? '';
}

function writeMeasurementPropertiesToDraw(draw: MapboxDraw, collection: MeasurementCollection): void {
  collection.features.forEach((feature) => {
    const id = String(feature.id ?? feature.properties.id);
    Object.entries(feature.properties).forEach(([key, value]) => {
      draw.setFeatureProperty(id, key, value);
    });
  });
}

function addMeasurementLabelLayers(map: mapboxgl.Map): void {
  if (map.getSource(LABEL_SOURCE_ID)) {
    return;
  }

  map.addSource(LABEL_SOURCE_ID, {
    type: 'geojson',
    data: createMeasurementLabelCollection(EMPTY_COLLECTION)
  });

  map.addLayer({
    id: LABEL_HALO_LAYER_ID,
    type: 'circle',
    source: LABEL_SOURCE_ID,
    paint: {
      'circle-color': '#ffffff',
      'circle-opacity': 0.92,
      'circle-radius': 24,
      'circle-stroke-color': '#0f172a',
      'circle-stroke-opacity': 0.28,
      'circle-stroke-width': 1
    }
  });

  map.addLayer({
    id: LABEL_LAYER_ID,
    type: 'symbol',
    source: LABEL_SOURCE_ID,
    layout: {
      'text-field': ['format', ['get', 'title'], { 'font-scale': 0.86 }, '\n', {}, ['get', 'subtitle'], { 'font-scale': 0.78 }],
      'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
      'text-size': 12,
      'text-anchor': 'center',
      'text-allow-overlap': true,
      'text-ignore-placement': true
    },
    paint: {
      'text-color': '#172033',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.2
    }
  });
}

function addFreehandPreviewLayers(map: mapboxgl.Map): void {
  if (!map.getSource(FREEHAND_PREVIEW_SOURCE_ID)) {
    map.addSource(FREEHAND_PREVIEW_SOURCE_ID, {
      type: 'geojson',
      data: emptyFreehandPreview()
    });
  }

  if (!map.getLayer(FREEHAND_PREVIEW_FILL_LAYER_ID)) {
    map.addLayer({
      id: FREEHAND_PREVIEW_FILL_LAYER_ID,
      type: 'fill',
      source: FREEHAND_PREVIEW_SOURCE_ID,
      filter: ['==', '$type', 'Polygon'],
      paint: {
        'fill-color': '#0ea5e9',
        'fill-opacity': 0.18
      }
    });
  }

  if (!map.getLayer(FREEHAND_PREVIEW_LINE_LAYER_ID)) {
    map.addLayer({
      id: FREEHAND_PREVIEW_LINE_LAYER_ID,
      type: 'line',
      source: FREEHAND_PREVIEW_SOURCE_ID,
      paint: {
        'line-color': '#0ea5e9',
        'line-width': 2.5
      }
    });
  }
}

function updateFreehandPreview(map: mapboxgl.Map, points: Array<[number, number]>): void {
  const source = map.getSource(FREEHAND_PREVIEW_SOURCE_ID);
  if (!source || !('setData' in source)) {
    return;
  }

  if (points.length === 0) {
    source.setData(emptyFreehandPreview());
    return;
  }

  const previewFeatures: Array<Feature<Geometry>> = [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: points
      }
    }
  ];

  if (points.length >= 3) {
    const ring = closeRing(points);
    previewFeatures.push({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [ring]
      }
    });
  }

  source.setData({
    type: 'FeatureCollection',
    features: previewFeatures
  } as FeatureCollection<Geometry>);
}

function clearFreehandPreview(map: mapboxgl.Map): void {
  const source = map.getSource(FREEHAND_PREVIEW_SOURCE_ID);
  if (!source || !('setData' in source)) {
    return;
  }

  source.setData(emptyFreehandPreview());
}

function emptyFreehandPreview(): FeatureCollection<Geometry> {
  return {
    type: 'FeatureCollection',
    features: []
  };
}

function updateMeasurementLabels(map: mapboxgl.Map | null, collection: MeasurementCollection): void {
  const source = map?.getSource(LABEL_SOURCE_ID);
  if (!source || !('setData' in source)) {
    return;
  }

  source.setData(createMeasurementLabelCollection(collection));
}

function changeDrawMode(draw: MapboxDraw | null, mode: DrawMode, options?: unknown): void {
  if (!draw) {
    return;
  }

  (draw.changeMode as (modeName: string, modeOptions?: unknown) => void)(mode, options);
}

function simplifyFreehandRing(points: Array<[number, number]>, maxVertices: number): Array<[number, number]> {
  const ring = closeRing(points);
  if (ring.length <= maxVertices) {
    return ring;
  }

  const first = ring[0];
  const last = ring[ring.length - 1];
  const inner = ring.slice(1, -1);
  const sampleCount = Math.max(maxVertices - 2, 2);
  const stride = inner.length / sampleCount;
  const sampled: Array<[number, number]> = [];

  for (let index = 0; index < sampleCount; index += 1) {
    const sourceIndex = Math.min(Math.floor(index * stride), inner.length - 1);
    sampled.push(inner[sourceIndex]);
  }

  return [first, ...sampled, last];
}

function closeRing(points: Array<[number, number]>): Array<[number, number]> {
  if (points.length === 0) {
    return [];
  }

  const first = points[0];
  const last = points[points.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    return [...points];
  }

  return [...points, [first[0], first[1]]];
}

function getDrawStyles() {
  return [
    {
      id: 'gl-draw-polygon-fill',
      type: 'fill',
      filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
      paint: {
        'fill-color': ['coalesce', ['get', 'color'], '#22c55e'],
        'fill-outline-color': '#f8fafc',
        'fill-opacity': 0.24
      }
    },
    {
      id: 'gl-draw-polygon-stroke',
      type: 'line',
      filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
      paint: {
        'line-color': '#f8fafc',
        'line-width': 2.5
      }
    },
    {
      id: 'gl-draw-line',
      type: 'line',
      filter: ['all', ['==', '$type', 'LineString'], ['!=', 'mode', 'static']],
      paint: {
        'line-color': ['coalesce', ['get', 'color'], '#38bdf8'],
        'line-width': 3
      }
    },
    {
      id: 'gl-draw-points',
      type: 'circle',
      filter: ['all', ['==', '$type', 'Point'], ['!=', 'meta', 'midpoint']],
      paint: {
        'circle-radius': 5,
        'circle-color': '#f8fafc',
        'circle-stroke-color': '#0f172a',
        'circle-stroke-width': 2
      }
    },
    {
      id: 'gl-draw-midpoints',
      type: 'circle',
      filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']],
      paint: {
        'circle-radius': 4,
        'circle-color': '#facc15'
      }
    }
  ];
}
