import type { YearMonth } from "../../types/data";
import type { ComparisonRow } from "./comparison";

export const round = (value: number) => Math.round(value * 10) / 10;
export const signed = (value: number) => (value > 0 ? `+${round(value)}` : `${round(value)}`);

export interface SideStats {
  /** Months with a value. */
  present: number;
  /** Months without a value. */
  missing: number;
  mean: number | null;
  minPoint: { date: YearMonth; value: number } | null;
  maxPoint: { date: YearMonth; value: number } | null;
  /** Mean of the first and last COMPLETE calendar years (all 12 months present). */
  firstYear: { year: string; mean: number } | null;
  lastYear: { year: string; mean: number } | null;
}

/**
 * Facts about one region of the comparison, computed from the aligned rows
 * only, so descriptions never go beyond the data. Missing months are left out
 * of every statistic and counted.
 */
export function describeSide(rows: ComparisonRow[], side: "a" | "b"): SideStats {
  const points = rows.flatMap((row) => {
    const value = row[side];
    return value === null ? [] : [{ date: row.date, value }];
  });
  const byYear = new Map<string, number[]>();
  for (const p of points) {
    const year = p.date.slice(0, 4);
    byYear.set(year, [...(byYear.get(year) ?? []), p.value]);
  }
  const complete = [...byYear]
    .filter(([, values]) => values.length === 12)
    .map(([year, values]) => ({ year, mean: values.reduce((a, b) => a + b, 0) / 12 }))
    .sort((x, y) => x.year.localeCompare(y.year));

  return {
    present: points.length,
    missing: rows.length - points.length,
    mean: points.length ? points.reduce((sum, p) => sum + p.value, 0) / points.length : null,
    minPoint: points.length ? points.reduce((m, p) => (p.value < m.value ? p : m)) : null,
    maxPoint: points.length ? points.reduce((m, p) => (p.value > m.value ? p : m)) : null,
    firstYear: complete[0] ?? null,
    lastYear: complete.length > 1 ? complete[complete.length - 1] : null,
  };
}
