/**
 * NASA POWER monthly point response → RegionDataset. Pure, so every rule is
 * unit-tested against recorded responses (fixtures/):
 *
 * - keys YYYY01..YYYY12 are months; YYYY13 (the annual value) is dropped;
 * - header.fill_value (-999) becomes null;
 * - months missing between the first and last key are added as null, so a
 *   series never has holes in its dates;
 * - the current year has no YYYY13 key and -999 for months not yet
 *   published (FC-07): both cases are handled by the rules above.
 */
import type { DataPoint, GridCell, Provenance, Region, YearMonth } from "../../../types/data";
import { MERRA2_CELL } from "../regions";

export interface ParameterSeries {
  /** Unit as declared in the response's `parameters` block. */
  unitSource: string;
  longName: string;
  /** Every month from the first to the last month returned, in order. */
  points: DataPoint[];
}

export interface RegionDataset {
  region: Region;
  provenance: Provenance;
  parameters: Record<string, ParameterSeries>;
}

export class PowerParseError extends Error {}

const MONTH_KEY = /^(\d{4})(\d{2})$/;

type JsonObject = Record<string, unknown>;
const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function yearMonth(year: number, month: number): YearMonth {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Every month from start to end inclusive ("YYYY-MM"). */
export function monthRange(start: YearMonth, end: YearMonth): YearMonth[] {
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  const months: YearMonth[] = [];
  for (let y = sy, m = sm; y < ey || (y === ey && m <= em); m === 12 ? (y++, (m = 1)) : m++) {
    months.push(yearMonth(y, m));
  }
  return months;
}

function parsePoints(values: JsonObject, fillValue: number | null): DataPoint[] {
  const byMonth = new Map<YearMonth, number | null>();
  for (const [key, raw] of Object.entries(values)) {
    const match = MONTH_KEY.exec(key);
    if (!match) continue;
    const month = Number(match[2]);
    if (month < 1 || month > 12) continue; // YYYY13: annual value, not a month
    const value = typeof raw === "number" && Number.isFinite(raw) && raw !== fillValue ? raw : null;
    byMonth.set(yearMonth(Number(match[1]), month), value);
  }
  const dates = [...byMonth.keys()].sort();
  if (!dates.length) return [];
  return monthRange(dates[0], dates[dates.length - 1]).map((date) => ({
    date,
    value: byMonth.get(date) ?? null,
  }));
}

export function parseMonthlyResponse(
  json: unknown,
  region: Region,
  requestUrl: string,
  retrievedAt: string,
): RegionDataset {
  if (!isObject(json)) throw new PowerParseError("the response is not a JSON object");
  const header = json.header;
  const properties = json.properties;
  if (!isObject(header) || !isObject(properties) || !isObject(properties.parameter)) {
    throw new PowerParseError("the response has no header or parameter values");
  }
  const fillValue = typeof header.fill_value === "number" ? header.fill_value : null;
  const metadata = isObject(json.parameters) ? json.parameters : {};

  const parameters: Record<string, ParameterSeries> = {};
  for (const [name, values] of Object.entries(properties.parameter)) {
    if (!isObject(values)) throw new PowerParseError(`parameter ${name} has no monthly values`);
    const meta = isObject(metadata[name]) ? metadata[name] : {};
    parameters[name] = {
      unitSource: typeof meta.units === "string" ? meta.units : "",
      longName: typeof meta.longname === "string" ? meta.longname : name,
      points: parsePoints(values, fillValue),
    };
  }

  const sources = Array.isArray(header.sources)
    ? header.sources.filter((s): s is string => typeof s === "string")
    : [];
  const coordinates =
    isObject(json.geometry) && Array.isArray(json.geometry.coordinates)
      ? json.geometry.coordinates
      : [];
  const elevation = typeof coordinates[2] === "number" ? coordinates[2] : null;
  const gridCell: GridCell | null = sources.includes("MERRA2")
    ? { ...MERRA2_CELL, elevationMeters: elevation }
    : null;
  const api = isObject(header.api) ? header.api : {};

  return {
    region,
    parameters,
    provenance: {
      provider: "NASA POWER",
      product: typeof header.title === "string" ? header.title : "NASA POWER",
      apiVersion: typeof api.version === "string" ? api.version : null,
      sources,
      timeStandard: typeof header.time_standard === "string" ? header.time_standard : null,
      fillValue,
      gridCell,
      requestUrl,
      retrievedAt,
    },
  };
}

/**
 * Error messages from a failed POWER request. The API answers 422 in two
 * shapes: `{ messages: [...] }` and FastAPI's `{ detail: [{ msg }] }`.
 */
export function parseErrorMessages(json: unknown): string[] {
  if (!isObject(json)) return [];
  if (Array.isArray(json.messages)) {
    return json.messages.filter((m): m is string => typeof m === "string");
  }
  if (Array.isArray(json.detail)) {
    return json.detail.flatMap((d) => {
      if (!isObject(d) || typeof d.msg !== "string") return [];
      const where = Array.isArray(d.loc) ? ` (${d.loc.join(".")})` : "";
      return [`${d.msg}${where}`];
    });
  }
  return typeof json.header === "string" ? [json.header] : [];
}
