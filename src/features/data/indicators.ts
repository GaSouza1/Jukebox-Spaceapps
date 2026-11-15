/**
 * Catalogue of environmental indicators. Adding an indicator means adding an
 * entry here (and a parse test with a recorded response): controls, chart,
 * table, sound and descriptions read everything from this object.
 *
 * Units: `display` is what the page shows and is the single unit used by
 * every consumer. `source` is what NASA POWER declares; it is only checked,
 * never shown, because it can be wrong (PRECTOTCORR_SUM is declared "mm/day"
 * but is a monthly total; see the implementation report, FC-06).
 */

/** What one monthly value represents. T2M_MAX/T2M_MIN are monthly extremes, not means (FC-05). */
export type MonthlyAggregation =
  | "monthly_mean"
  | "monthly_extreme_max"
  | "monthly_extreme_min"
  | "monthly_mean_daily_rate"
  | "monthly_total";

export interface UnitDefinition {
  /** Exactly as the API declares it. */
  source: string;
  /** As shown on screen. */
  display: string;
  /** Spelled out, for screen readers and spoken descriptions. */
  spoken: string;
}

export interface EicLink {
  title: string;
  url: string;
  /** Why the page is relevant to this indicator. */
  why: string;
}

export interface IndicatorDefinition {
  id: string;
  aggregation: MonthlyAggregation;
  source: { provider: "NASA POWER"; parameter: string; community: "AG" };
  label: string;
  shortLabel: string;
  description: string;
  unit: UnitDefinition;
  /** Values outside this physical range are treated as missing. */
  plausibleRange: readonly [number, number];
  /** GIBS layer showing the SAME quantity from the SAME source, or null (AC-11). */
  gibsLayer: { id: string; title: string; matrixSet: string; maxZoom: number } | null;
  /** Curated Earth Information Center pages (no API or embedding exists; FC-10). */
  eicLinks: readonly EicLink[];
}

export const INDICATORS = {
  T2M: {
    id: "T2M",
    aggregation: "monthly_mean",
    source: { provider: "NASA POWER", parameter: "T2M", community: "AG" },
    label: "Mean air temperature",
    shortLabel: "Temperature",
    description:
      "Monthly mean air temperature at 2 meters above the surface, from the MERRA-2 reanalysis served by NASA POWER.",
    unit: { source: "C", display: "°C", spoken: "degrees Celsius" },
    plausibleRange: [-90, 60],
    gibsLayer: {
      id: "MERRA2_2m_Air_Temperature_Monthly",
      title: "2-meter Air Temperature (Monthly, MERRA-2)",
      matrixSet: "GoogleMapsCompatible_Level6",
      maxZoom: 6,
    },
    eicLinks: [
      {
        title: "Earth Information Center",
        url: "https://earth.gov/",
        why: "The U.S. government portal for Earth science data and stories, including temperature and its effects.",
      },
      {
        title: "Hometown Dashboard (NASA SVS, linked from Earth.gov)",
        url: "https://svs.gsfc.nasa.gov/webapps/hometown-dashboard/",
        why: "Temperature projections for a chosen location, from 1950 to 2100.",
      },
      {
        title: "Earth.gov theme: Agriculture",
        url: "https://earth.gov/themes/agriculture",
        why: "How air temperature affects crops and growing seasons.",
      },
      {
        title: "Earth.gov theme: Energy",
        url: "https://earth.gov/themes/energy",
        why: "How temperature drives heating and cooling demand.",
      },
    ],
  },
} as const satisfies Record<string, IndicatorDefinition>;

export type IndicatorId = keyof typeof INDICATORS;

export const DEFAULT_INDICATOR: IndicatorId = "T2M";

export const indicatorList: IndicatorDefinition[] = Object.values(INDICATORS);

/** POWER parameters requested for every region: one request covers every indicator. */
export const POWER_PARAMETERS: string[] = [
  ...new Set(indicatorList.map((indicator) => indicator.source.parameter)),
].sort();

export function indicatorOf(id: IndicatorId): IndicatorDefinition {
  return INDICATORS[id];
}
