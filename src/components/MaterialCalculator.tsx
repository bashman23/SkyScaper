import { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';

export type MaterialType =
  | 'asphalt'
  | 'concrete'
  | 'sealcoat'
  | 'paint'
  | 'sod'
  | 'mulch'
  | 'roofing'
  | 'fencing'
  | 'tennis_resurface'
  | 'turf_field'
  | 'polyurethane_track';

interface MaterialRate {
  name: string;
  unit: string;
  pricePerUnit: number;
  description: string;
}

const MATERIAL_RATES: Record<MaterialType, MaterialRate> = {
  asphalt: {
    name: 'Asphalt Paving',
    unit: 'ton',
    pricePerUnit: 110,
    description: 'Hot mix asphalt quantity based on depth and density.'
  },
  concrete: {
    name: 'Concrete Slab',
    unit: 'sq ft',
    pricePerUnit: 8.5,
    description: 'Installed exterior concrete slab estimate.'
  },
  sealcoat: {
    name: 'Sealcoating',
    unit: 'sq ft',
    pricePerUnit: 0.05,
    description: 'Protective seal coat'
  },
  paint: {
    name: 'Line Striping',
    unit: 'linear ft',
    pricePerUnit: 0.25,
    description: 'Parking lot line paint'
  },
  sod: {
    name: 'Sod (grass)',
    unit: 'sq ft',
    pricePerUnit: 0.35,
    description: 'Installed lawn sod'
  },
  mulch: {
    name: 'Mulch (3" depth)',
    unit: 'cu yd',
    pricePerUnit: 45,
    description: 'Wood chip mulch'
  },
  roofing: {
    name: 'Roofing (shingles)',
    unit: 'sq ft',
    pricePerUnit: 1.75,
    description: 'Asphalt shingle roof coverage'
  },
  fencing: {
    name: 'Fencing',
    unit: 'linear ft',
    pricePerUnit: 28,
    description: 'Installed fence per linear foot'
  },
  tennis_resurface: {
    name: 'Tennis Court Resurface',
    unit: 'sq ft',
    pricePerUnit: 1.6,
    description: 'Acrylic resurfacing and striping estimate.'
  },
  turf_field: {
    name: 'Track & Field Turf',
    unit: 'sq ft',
    pricePerUnit: 7.25,
    description: 'Synthetic turf field install estimate.'
  },
  polyurethane_track: {
    name: 'Polyurethane Track',
    unit: 'sq ft',
    pricePerUnit: 10.5,
    description: 'Track surfacing system estimate.'
  }
};

interface MaterialCalculatorProps {
  areaSqM: number;
  lengthM: number;
}

const QUICK_PRESETS: MaterialType[] = ['asphalt', 'roofing', 'fencing', 'concrete'];
const ASPHALT_DENSITY_LB_PER_FT3 = 145;

function isLinearMaterial(type: MaterialType): boolean {
  return type === 'paint' || type === 'fencing';
}

function isVolumeMaterial(type: MaterialType): boolean {
  return type === 'mulch';
}

function isAsphaltMaterial(type: MaterialType): boolean {
  return type === 'asphalt';
}

export function MaterialCalculator({ areaSqM, lengthM }: MaterialCalculatorProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialType>('asphalt');
  const [customRate, setCustomRate] = useState<number | null>(null);
  const [asphaltDepthInches, setAsphaltDepthInches] = useState(2);
  const [millAndPave, setMillAndPave] = useState(false);
  const [millDepthInches, setMillDepthInches] = useState(1);

  const sqft = areaSqM * 10.764; // m² to sq ft
  const linearft = lengthM * 3.281; // m to ft
  const cubicyd = areaSqM * 11.96; // m² to cubic yards (assuming 3" depth)

  const material = MATERIAL_RATES[selectedMaterial];
  const rate = customRate ?? material.pricePerUnit;
  const hasArea = sqft > 0;
  const hasLength = linearft > 0;

  const quantity = useMemo(() => {
    if (isAsphaltMaterial(selectedMaterial)) {
      const effectiveDepth = Math.max(asphaltDepthInches - (millAndPave ? millDepthInches : 0), 0);
      const volumeCubicFeet = sqft * (effectiveDepth / 12);
      return (volumeCubicFeet * ASPHALT_DENSITY_LB_PER_FT3) / 2000;
    }

    if (isLinearMaterial(selectedMaterial)) {
      return linearft;
    }

    if (isVolumeMaterial(selectedMaterial)) {
      return cubicyd;
    }

    return sqft;
  }, [asphaltDepthInches, millAndPave, millDepthInches, selectedMaterial, sqft, linearft, cubicyd]);

  const quantityDisplay = useMemo(() => {
    if (isAsphaltMaterial(selectedMaterial)) {
      return `${quantity.toFixed(2)} tons`;
    }

    if (isLinearMaterial(selectedMaterial)) {
      return `${quantity.toFixed(0)} linear ft`;
    }

    if (isVolumeMaterial(selectedMaterial)) {
      return `${quantity.toFixed(1)} cu yd`;
    }

    return `${quantity.toFixed(0)} sq ft`;
  }, [quantity, selectedMaterial]);

  const quantityHint = useMemo(() => {
    if (isLinearMaterial(selectedMaterial) && !hasLength) {
      return 'Draw a line on the map to estimate this material.';
    }

    if (!isLinearMaterial(selectedMaterial) && !hasArea) {
      return 'Draw an area polygon on the map to estimate this material.';
    }

    return null;
  }, [hasArea, hasLength, selectedMaterial]);

  const estimate = useMemo(() => {
    return quantity * rate;
  }, [quantity, rate]);

  return (
    <section className="calculator-section">
      <button
        className="calculator-header"
        onClick={() => setExpanded(!expanded)}
        type="button"
      >
        <span>Cost Estimator</span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {expanded && (
        <div className="calculator-content">
          <div className="calculator-presets" role="group" aria-label="Quick calculators">
            {QUICK_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={selectedMaterial === preset ? 'preset-chip active' : 'preset-chip'}
                onClick={() => {
                  setSelectedMaterial(preset);
                  setCustomRate(null);
                }}
              >
                {MATERIAL_RATES[preset].name}
              </button>
            ))}
          </div>

          <div className="calculator-select">
            <label htmlFor="material-select">Calculator type:</label>
            <select
              id="material-select"
              value={selectedMaterial}
              onChange={(e) => {
                setSelectedMaterial(e.target.value as MaterialType);
                setCustomRate(null);
              }}
            >
              {Object.entries(MATERIAL_RATES).map(([key, mat]) => (
                <option key={key} value={key}>
                  {mat.name}
                </option>
              ))}
            </select>
          </div>

          <p className="calculator-description">{material.description}</p>
          {isAsphaltMaterial(selectedMaterial) ? (
            <div className="asphalt-controls">
              <label htmlFor="asphalt-depth">Asphalt depth (inches)</label>
              <input
                id="asphalt-depth"
                type="number"
                min="0"
                step="0.25"
                value={asphaltDepthInches}
                onChange={(event) => setAsphaltDepthInches(Number.parseFloat(event.target.value) || 0)}
              />
              <label className="checkbox-row" htmlFor="mill-and-pave">
                <input
                  id="mill-and-pave"
                  type="checkbox"
                  checked={millAndPave}
                  onChange={(event) => setMillAndPave(event.target.checked)}
                />
                Mill and pave
              </label>
              {millAndPave ? (
                <>
                  <label htmlFor="mill-depth">Mill depth (inches)</label>
                  <input
                    id="mill-depth"
                    type="number"
                    min="0"
                    step="0.25"
                    value={millDepthInches}
                    onChange={(event) => setMillDepthInches(Number.parseFloat(event.target.value) || 0)}
                  />
                </>
              ) : null}
              <p className="calculator-helper">
                Effective depth: {Math.max(asphaltDepthInches - (millAndPave ? millDepthInches : 0), 0).toFixed(2)} in
              </p>
            </div>
          ) : null}
          {quantityHint ? <p className="calculator-helper">{quantityHint}</p> : null}

          <div className="calculator-rate">
            <label htmlFor="rate-input">
              Price per {material.unit}:
            </label>
            <input
              id="rate-input"
              type="number"
              value={customRate ?? material.pricePerUnit}
              onChange={(e) => setCustomRate(parseFloat(e.target.value) || 0)}
              step="0.01"
              min="0"
            />
          </div>

          <div className="calculator-result">
            <div className="result-row">
              <span>Quantity:</span>
              <strong>{quantityDisplay}</strong>
            </div>
            <div className="result-row">
              <span>Unit Price:</span>
              <strong>${rate.toFixed(2)}</strong>
            </div>
            <div className="result-total">
              <span>Estimated Cost:</span>
              <strong>${estimate.toFixed(2)}</strong>
            </div>
          </div>

          <p className="calculator-note">
            * Estimates are planning tools only. Get professional quotes for accurate pricing.
          </p>
        </div>
      )}
    </section>
  );
}
