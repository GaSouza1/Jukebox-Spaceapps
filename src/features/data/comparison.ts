/**
 * From two regional datasets to ONE structure, `ComparisonData`, consumed by
 * the chart, the table, the summary, the sonification and every accessible
 * description. Pure functions, so each rule is unit-tested.
 *
 * - Series are aligned by date ("YYYY-MM"), never by array position (AC-06).
 * - Differences use only months where both regions have a value.
 * - Two series are compared only if they share indicator, unit, measure and
 *   frequency; otherwise the reason is reported (`issues`), never hidden.
 */
import type { Measure, MonthlySeries, Provenance, Region, YearMonth } from "../../types/data";
import { indicatorOf, type IndicatorId } from "./indicators";
import { monthRange, yearMonth, type RegionDataset } from "./power/powerParse";

export interface ComparisonRow {
  date: YearMonth;
  a: number | null;
  b: number | null;
  /** a − b, only when both are present. */
  difference: number | null;
}

export interface Coverage {
  months: number;
  presentA: number;
  presentB: number;
  /** Months used by every difference statistic. */
  bothPresent: number;
}

export type CompatibilityIssue =
  | { kind: "same_region" }
  | { kind: "same_grid_cell" }
  | { kind: "indicator_mismatch"; a: IndicatorId; b: IndicatorId }
  | { kind: "unit_mismatch"; a: string; b: string }
  | { kind: "measure_mismatch" }
  | { kind: "frequency_mismatch" }
  | { kind: "no_overlap" };

export interface ComparisonData {
  indicatorId: IndicatorId;
  measure: Measure;
  /** Display unit, e.g. "°C". */
  unit: string;
  /** Spelled-out unit, e.g. "degrees Celsius". */
  spokenUnit: string;
  period: { start: YearMonth; end: YearMonth };
  regionA: Region;
  regionB: Region;
  rows: ComparisonRow[];
  coverage: Coverage;
  provenance: { a: Provenance; b: Provenance };
  /** Empty when the two series can be compared. */
  issues: CompatibilityIssue[];
}

export interface RegionDifference {
  /** Mean of (a − b) over months where both are present. */
  meanDifference: number | null;
  monthsUsed: number;
  /** Month where A is furthest above B. */
  largest: { date: YearMonth; difference: number } | null;
  /** Month where B is furthest above A. */
  smallest: { date: YearMonth; difference: number } | null;
  sign: { aHigher: number; bHigher: number; equal: number };
}

/** Values closer than this (in the display unit) count as equal; POWER reports 2 decimals. */
const EQUAL_EPSILON = 0.005;

/* ---- From a dataset to a series ---- */

/** The indicator's series for one region, for every month of the period (gaps as null). */
export function selectSeries(
  dataset: RegionDataset,
  indicatorId: IndicatorId,
  startYear: number,
  endYear: number,
): MonthlySeries {
  const indicator = indicatorOf(indicatorId);
  const parameter = dataset.parameters[indicator.source.parameter];
  const values = new Map(parameter?.points.map((p) => [p.date, p.value]) ?? []);
  const [low, high] = indicator.plausibleRange;
  const points = monthRange(yearMonth(startYear, 1), yearMonth(endYear, 12)).map((date) => {
    const value = values.get(date) ?? null;
    return { date, value: value !== null && value >= low && value <= high ? value : null };
  });
  return {
    region: dataset.region,
    indicatorId,
    measure: { kind: "absolute" },
    unit: indicator.unit.display,
    sourceUnit: parameter?.unitSource ?? "",
    frequency: "monthly",
    points,
    provenance: dataset.provenance,
  };
}

/** First and last calendar years with all 12 months present, or null. */
export function completeYearRange(
  dataset: RegionDataset,
  indicatorId: IndicatorId,
): { first: number; last: number } | null {
  const points = dataset.parameters[indicatorOf(indicatorId).source.parameter]?.points ?? [];
  const counts = new Map<number, number>();
  for (const p of points) {
    if (p.value === null) continue;
    const year = Number(p.date.slice(0, 4));
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  const complete = [...counts].filter(([, n]) => n === 12).map(([year]) => year);
  return complete.length ? { first: Math.min(...complete), last: Math.max(...complete) } : null;
}

/** Years both regions cover completely; the period controls offer exactly these. */
export function commonYearRange(
  a: RegionDataset,
  b: RegionDataset,
  indicatorId: IndicatorId,
): { first: number; last: number } | null {
  const ra = completeYearRange(a, indicatorId);
  const rb = completeYearRange(b, indicatorId);
  if (!ra || !rb) return null;
  const first = Math.max(ra.first, rb.first);
  const last = Math.min(ra.last, rb.last);
  return first <= last ? { first, last } : null;
}

/** The last `years` complete years of the range (the default period). */
export function defaultPeriod(range: { first: number; last: number }, years = 20) {
  return { startYear: Math.max(range.first, range.last - years + 1), endYear: range.last };
}

/** The period moved inside the range, keeping its length when possible. */
export function clampPeriod(
  period: { startYear: number; endYear: number },
  range: { first: number; last: number },
) {
  const endYear = Math.min(Math.max(period.endYear, range.first), range.last);
  const startYear = Math.min(Math.max(period.startYear, range.first), endYear);
  return { startYear, endYear };
}

/* ---- Compatibility and alignment ---- */

export function checkCompatibility(a: MonthlySeries, b: MonthlySeries): CompatibilityIssue[] {
  const issues: CompatibilityIssue[] = [];
  if (a.region.id === b.region.id) issues.push({ kind: "same_region" });
  if (a.indicatorId !== b.indicatorId) {
    issues.push({ kind: "indicator_mismatch", a: a.indicatorId, b: b.indicatorId });
  }
  const expected = indicatorOf(a.indicatorId).unit.source;
  if (a.unit !== b.unit || a.sourceUnit !== b.sourceUnit || a.sourceUnit !== expected) {
    issues.push({ kind: "unit_mismatch", a: a.sourceUnit || a.unit, b: b.sourceUnit || b.unit });
  }
  if (a.measure.kind !== b.measure.kind) issues.push({ kind: "measure_mismatch" });
  if (a.frequency !== b.frequency) issues.push({ kind: "frequency_mismatch" });

  const valuesB = new Map(b.points.map((p) => [p.date, p.value]));
  const overlap = a.points.flatMap((p) => {
    const vb = valuesB.get(p.date);
    return p.value !== null && vb !== null && vb !== undefined ? [[p.value, vb] as const] : [];
  });
  if (!overlap.length) issues.push({ kind: "no_overlap" });

  // POWER returns the nearest grid cell: two points in one cell get the same
  // elevation and identical values (FC-08). A year of identical months is
  // treated as proof.
  const cellA = a.provenance.gridCell?.elevationMeters;
  const cellB = b.provenance.gridCell?.elevationMeters;
  if (
    a.region.id !== b.region.id &&
    cellA != null &&
    cellA === cellB &&
    overlap.length >= 12 &&
    overlap.every(([va, vb]) => va === vb)
  ) {
    issues.push({ kind: "same_grid_cell" });
  }
  return issues;
}

/** One row per month of either series, in date order; a month missing on one side is null there. */
export function alignByDate(a: MonthlySeries, b: MonthlySeries): ComparisonData {
  const valuesA = new Map(a.points.map((p) => [p.date, p.value]));
  const valuesB = new Map(b.points.map((p) => [p.date, p.value]));
  const dates = [...new Set([...valuesA.keys(), ...valuesB.keys()])].sort();
  const rows: ComparisonRow[] = dates.map((date) => {
    const va = valuesA.get(date) ?? null;
    const vb = valuesB.get(date) ?? null;
    return { date, a: va, b: vb, difference: va !== null && vb !== null ? va - vb : null };
  });
  const indicator = indicatorOf(a.indicatorId);
  return {
    indicatorId: a.indicatorId,
    measure: a.measure,
    unit: a.unit,
    spokenUnit: indicator.unit.spoken,
    period: { start: dates[0] ?? "", end: dates.at(-1) ?? "" },
    regionA: a.region,
    regionB: b.region,
    rows,
    coverage: {
      months: rows.length,
      presentA: rows.filter((r) => r.a !== null).length,
      presentB: rows.filter((r) => r.b !== null).length,
      bothPresent: rows.filter((r) => r.difference !== null).length,
    },
    provenance: { a: a.provenance, b: b.provenance },
    issues: checkCompatibility(a, b),
  };
}

/* ---- Differences ---- */

export function summarizeDifference(data: Pick<ComparisonData, "rows">): RegionDifference {
  const both = data.rows.filter(
    (r): r is ComparisonRow & { difference: number } => r.difference !== null,
  );
  if (!both.length) {
    return {
      meanDifference: null,
      monthsUsed: 0,
      largest: null,
      smallest: null,
      sign: { aHigher: 0, bHigher: 0, equal: 0 },
    };
  }
  const largest = both.reduce((m, r) => (r.difference > m.difference ? r : m));
  const smallest = both.reduce((m, r) => (r.difference < m.difference ? r : m));
  return {
    meanDifference: both.reduce((sum, r) => sum + r.difference, 0) / both.length,
    monthsUsed: both.length,
    largest: { date: largest.date, difference: largest.difference },
    smallest: { date: smallest.date, difference: smallest.difference },
    sign: {
      aHigher: both.filter((r) => r.difference > EQUAL_EPSILON).length,
      bHigher: both.filter((r) => r.difference < -EQUAL_EPSILON).length,
      equal: both.filter((r) => Math.abs(r.difference) <= EQUAL_EPSILON).length,
    },
  };
}

/** Plain-language reason a comparison cannot be made, for the status message and the player. */
export function describeIssue(
  issue: CompatibilityIssue,
  data: Pick<ComparisonData, "regionA" | "regionB">,
) {
  const { regionA: a, regionB: b } = data;
  switch (issue.kind) {
    case "same_region":
      return `Region A and Region B are both ${a.name}. Choose two different regions.`;
    case "same_grid_cell":
      return `${a.name} and ${b.name} fall in the same NASA POWER grid cell, so their values are identical. Choose regions farther apart.`;
    case "indicator_mismatch":
      return "The two series are different variables and cannot be compared.";
    case "unit_mismatch":
      return `The two series are in different units (${issue.a} and ${issue.b}) and cannot be compared.`;
    case "measure_mismatch":
      return "One series holds absolute values and the other does not; they cannot share a scale.";
    case "frequency_mismatch":
      return "The two series have different time steps and cannot be compared.";
    case "no_overlap":
      return `${a.name} and ${b.name} have no month with data in common in this period.`;
  }
}
