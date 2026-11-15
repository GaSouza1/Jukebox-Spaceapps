import { useId } from "react";
import { regions } from "../../data/demoData";
import type { Region } from "../../../types/data";
import { StableText } from "../../../components/StableText";

interface Props {
  label: string;
  tone: "blue" | "orange";
  value: Region;
  onChange: (region: Region) => void;
  /** How this region appears in the chart and in the sonification. */
  identity: string;
}

export function formatCoordinates(region: Region) {
  const lat = `${Math.abs(region.latitude).toFixed(2)}° ${region.latitude >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(region.longitude).toFixed(2)}° ${region.longitude >= 0 ? "E" : "W"}`;
  return `${lat}, ${lon}`;
}

export function RegionSelector({ label, tone, value, onChange, identity }: Props) {
  const id = useId();
  return (
    <div className={`region-selector ${tone}`}>
      <div className="selector-heading">
        <label className="region-key" htmlFor={`${id}-select`}>
          {label}
        </label>
        <span className="coordinate" id={`${id}-coords`}>
          <span className="sr-only">Coordinates: </span>
          <StableText>{formatCoordinates(value)}</StableText>
        </span>
      </div>
      <select
        id={`${id}-select`}
        value={value.id}
        aria-describedby={`${id}-coords ${id}-identity`}
        onChange={(event) => onChange(regions.find((r) => r.id === event.target.value)!)}
      >
        {regions.map((region) => (
          <option key={region.id} value={region.id}>
            {region.name}, {region.country}
          </option>
        ))}
      </select>
      <p id={`${id}-identity`}>
        <StableText>{identity}</StableText>
      </p>
    </div>
  );
}
