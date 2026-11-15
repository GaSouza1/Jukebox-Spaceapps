import { useId } from "react";
import { describeCell, formatCoordinates, regionById, regions } from "../../data/regions";
import type { Region } from "../../../types/data";
import { StableText } from "../../../components/StableText";

interface Props {
  label: string;
  tone: "blue" | "orange";
  value: Region;
  /** The region chosen on the other side; offered but not selectable here (AC-07). */
  other: Region;
  otherLabel: string;
  onChange: (region: Region) => void;
  /** How this region appears in the chart and in the sonification. */
  identity: string;
}

export function RegionSelector({
  label,
  tone,
  value,
  other,
  otherLabel,
  onChange,
  identity,
}: Props) {
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
        aria-describedby={`${id}-coords ${id}-cell ${id}-identity`}
        onChange={(event) => {
          const region = regionById(event.target.value);
          if (region && region.id !== other.id) onChange(region);
        }}
      >
        {regions.map((region) => (
          <option key={region.id} value={region.id} disabled={region.id === other.id}>
            {region.id === other.id
              ? `${region.name}, ${region.country} (selected as ${otherLabel})`
              : `${region.name}, ${region.country}`}
          </option>
        ))}
      </select>
      <p id={`${id}-cell`} className="cell-note">
        <StableText>{describeCell(value.latitude)}</StableText>
      </p>
      <p id={`${id}-identity`}>
        <StableText>{identity}</StableText>
      </p>
    </div>
  );
}
