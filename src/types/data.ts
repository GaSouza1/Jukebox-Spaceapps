import type { IndicatorId } from "../features/data/indicators";

export interface Region {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  /** Where the coordinates come from; the same coordinates are sent to the data source. */
  coordinateSource: string;
}

/** "YYYY-MM". Validated where the data enters the app (powerParse). */
export type YearMonth = string;

export interface DataPoint {
  date: YearMonth;
  /** null = no value: fill value, out of the plausible range or not yet published. */
  value: number | null;
}

/** The grid cell the source used for a point request (POWER: nearest MERRA-2 cell). */
export interface GridCell {
  latitudeDegrees: number;
  longitudeDegrees: number;
  /** Mean elevation of the cell, metres. */
  elevationMeters: number | null;
}

export interface Provenance {
  provider: "NASA POWER";
  /** header.title, e.g. "NASA/POWER Source Native Resolution Monthly and Annual". */
  product: string;
  /** header.api.version, e.g. "v2.10.0". */
  apiVersion: string | null;
  /** header.sources, e.g. ["MERRA2", "POWER"]. */
  sources: string[];
  timeStandard: string | null;
  fillValue: number | null;
  gridCell: GridCell | null;
  requestUrl: string;
  /** ISO 8601 time the response was received. */
  retrievedAt: string;
}

/**
 * Absolute values only in this version. Anomalies and changes are different
 * measures and must never share a scale with absolute values (see
 * docs/FEATURE_COMPARISON_IMPLEMENTATION_REPORT.md, 6.3).
 */
export type Measure = { kind: "absolute" };

/** One region, one indicator, every month of the selected period (gaps as null). */
export interface MonthlySeries {
  region: Region;
  indicatorId: IndicatorId;
  measure: Measure;
  /** Display unit, from the indicator catalogue (single source; AC-05). */
  unit: string;
  /** Unit as declared by the source, kept to check compatibility. */
  sourceUnit: string;
  frequency: "monthly";
  points: DataPoint[];
  provenance: Provenance;
}

export interface ComparisonSelection {
  regionA: Region | null;
  regionB: Region | null;
  indicator: IndicatorId;
  startYear: number;
  endYear: number;
}

export interface SonificationState {
  isPlaying: boolean;
  currentIndex: number;
  playbackSpeed: number;
  volume: number;
}
