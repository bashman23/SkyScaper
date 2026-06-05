import { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';

export type MaterialType = 'asphalt' | 'sealcoat' | 'paint' | 'sod' | 'mulch';

interface MaterialRate {
  name: string;
  unit: string;
  pricePerUnit: number;
  description: string;
}

const MATERIAL_RATES: Record<MaterialType, MaterialRate> = {
  asphalt: {
    name: 'Asphalt (2" depth)',
    unit: 'sq ft',
    pricePerUnit: 0.15,
    description: 'Hot mix asphalt paving'
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
  }
};

interface MaterialCalculatorProps {
  areaSqM: number;
  lengthM: number;
}

export function MaterialCalculator({ areaSqM, lengthM }: MaterialCalculatorProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialType>('asphalt');
  const [customRate, setCustomRate] = useState<number | null>(null);

  const sqft = areaSqM * 10.764; // m² to sq ft
  const linearft = lengthM * 3.281; // m to ft
  const cubicyd = areaSqM * 11.96; // m² to cubic yards (assuming 3" depth)

  const material = MATERIAL_RATES[selectedMaterial];
  const rate = customRate ?? material.pricePerUnit;

  const estimate = useMemo(() => {
    let quantity = 0;
    switch (selectedMaterial) {
      case 'paint':
        quantity = linearft;
        break;
      case 'mulch':
        quantity = cubicyd;
        break;
      default:
        quantity = sqft;
    }
    return quantity * rate;
  }, [selectedMaterial, sqft, linearft, cubicyd, rate]);

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
          <div className="calculator-select">
            <label htmlFor="material-select">Material:</label>
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
              <strong>
                {selectedMaterial === 'paint'
                  ? `${linearft.toFixed(0)} linear ft`
                  : selectedMaterial === 'mulch'
                    ? `${cubicyd.toFixed(1)} cu yd`
                    : `${sqft.toFixed(0)} sq ft`}
              </strong>
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
