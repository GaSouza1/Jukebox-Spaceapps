import type { EnvironmentalDataPoint, Region, RegionSeries } from "../../types/data";

export const regions: Region[] = [
  { id: "sorocaba", name: "Sorocaba", country: "Brasil", latitude: -23.5015, longitude: -47.4526 },
  { id: "manaus", name: "Manaus", country: "Brasil", latitude: -3.119, longitude: -60.0217 },
  {
    id: "sao-paulo",
    name: "São Paulo",
    country: "Brasil",
    latitude: -23.5505,
    longitude: -46.6333,
  },
  {
    id: "new-york",
    name: "New York",
    country: "United States",
    latitude: 40.7128,
    longitude: -74.006,
  },
  {
    id: "london",
    name: "London",
    country: "United Kingdom",
    latitude: 51.5072,
    longitude: -0.1276,
  },
];

export const indicators = {
  T2M: {
    id: "T2M",
    label: "Mean temperature",
    shortLabel: "Temperature",
    unit: "°C",
    description: "Monthly mean air temperature at 2 meters above the surface.",
  },
  PRECTOTCORR: {
    id: "PRECTOTCORR",
    label: "Precipitation",
    shortLabel: "Precipitation",
    unit: "mm/month",
    description: "Monthly accumulated bias-corrected precipitation.",
  },
} as const;

export type IndicatorId = keyof typeof indicators;

const regionOffsets: Record<string, number> = {
  sorocaba: 1.2,
  manaus: 7.6,
  "sao-paulo": 0.4,
  "new-york": -4.8,
  london: -7.2,
};

export function createDemoSeries(
  region: Region,
  indicator: IndicatorId,
  startYear: number,
  endYear: number,
): RegionSeries {
  const data: EnvironmentalDataPoint[] = [];
  const isTemperature = indicator === "T2M";
  const offset = regionOffsets[region.id] ?? 0;

  for (let year = startYear; year <= endYear; year += 1) {
    for (let month = 0; month < 12; month += 1) {
      const season = Math.sin(((month - 1) / 12) * Math.PI * 2);
      const longTerm = (year - 2005) * (isTemperature ? 0.035 : 0.45);
      const texture = Math.sin((year * 7 + month * 13 + region.latitude) * 0.43);
      const value = isTemperature
        ? 18.4 + offset + season * (region.latitude > 0 ? -8 : 4.2) + longTerm + texture * 0.65
        : 106 + offset * 4 + season * 58 + longTerm + texture * 18;

      data.push({
        date: `${year}-${String(month + 1).padStart(2, "0")}`,
        value: Number(Math.max(0, value).toFixed(1)),
      });
    }
  }

  return { region, indicator, unit: indicators[indicator].unit, data };
}

export function formatMonth(date: string) {
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}-01T00:00:00Z`),
  );
}
