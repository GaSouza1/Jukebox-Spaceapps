import { regions } from "../../data/demoData";
import type { Region } from "../../../types/data";

interface Props {
  label: string;
  tone: "blue" | "orange";
  value: Region;
  onChange: (region: Region) => void;
}

export function RegionSelector({ label, tone, value, onChange }: Props) {
  return (
    <div className={`region-selector ${tone}`}>
      <div className="selector-heading">
        <span className="region-key">{label}</span>
        <span className="coordinate">
          {value.latitude.toFixed(2)}°, {value.longitude.toFixed(2)}°
        </span>
      </div>
      <label>
        <span className="sr-only">Select {label}</span>
        <select
          value={value.id}
          onChange={(event) => onChange(regions.find((r) => r.id === event.target.value)!)}
        >
          {regions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name}, {region.country}
            </option>
          ))}
        </select>
      </label>
      <p>
        <span aria-hidden="true">●</span> {value.country}
      </p>
    </div>
  );
}
