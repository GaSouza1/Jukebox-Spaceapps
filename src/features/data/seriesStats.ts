import type { RegionSeries } from "../../types/data";

export const round = (value: number) => Math.round(value * 10) / 10;
export const signed = (value: number) => (value > 0 ? `+${round(value)}` : `${round(value)}`);

/** Facts computed from the series only, so descriptions never go beyond the data. */
export function describeSeries(series: RegionSeries) {
  const values = series.data.map((p) => p.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const minPoint = series.data.reduce((a, b) => (b.value < a.value ? b : a));
  const maxPoint = series.data.reduce((a, b) => (b.value > a.value ? b : a));
  const yearMean = (points: typeof series.data) =>
    points.reduce((a, p) => a + p.value, 0) / Math.max(points.length, 1);
  const firstYear = series.data.slice(0, 12);
  const lastYear = series.data.slice(-12);
  return {
    mean,
    minPoint,
    maxPoint,
    firstYearMean: yearMean(firstYear),
    lastYearMean: yearMean(lastYear),
    firstYearLabel: firstYear[0]?.date.slice(0, 4),
    lastYearLabel: lastYear[0]?.date.slice(0, 4),
  };
}

export type SeriesStats = ReturnType<typeof describeSeries>;
