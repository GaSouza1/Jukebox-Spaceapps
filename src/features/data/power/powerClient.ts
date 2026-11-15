/**
 * NASA POWER client: one request per region and session, for the whole
 * monthly history of every catalogued parameter. The period, the indicator
 * and the comparison are then derived on the client, so changing them never
 * goes back to the network.
 *
 * POWER answers browser requests directly (`access-control-allow-origin: *`),
 * needs no key, and returns ~44 KB for 46 years of 5 parameters (measured
 * 15/11/2026). No backend is involved.
 */
import type { Region } from "../../../types/data";
import { POWER_PARAMETERS } from "../indicators";
import { parseErrorMessages, parseMonthlyResponse, type RegionDataset } from "./powerParse";

export const POWER_MONTHLY_URL = "https://power.larc.nasa.gov/api/temporal/monthly/point";
/** The API rejects earlier start years (HTTP 422, "The data starts at 1981/01/01"). */
export const POWER_FIRST_YEAR = 1981;
export const REQUEST_TIMEOUT_MS = 20_000;

export type DataError =
  | { kind: "network"; message: string }
  | { kind: "timeout"; message: string }
  | { kind: "http"; status: number; message: string }
  | { kind: "parse"; message: string };

export class PowerRequestError extends Error {
  readonly detail: DataError;
  constructor(detail: DataError) {
    super(detail.message);
    this.detail = detail;
  }
}

export function monthlyUrl(region: Region, endYear: number, parameters = POWER_PARAMETERS) {
  const params = new URLSearchParams({
    parameters: parameters.join(","),
    community: "AG",
    // Three decimals (~100 m) is what POWER echoes back; finer adds nothing.
    latitude: region.latitude.toFixed(3),
    longitude: region.longitude.toFixed(3),
    start: String(POWER_FIRST_YEAR),
    end: String(endYear),
    format: "JSON",
  });
  return `${POWER_MONTHLY_URL}?${params}`;
}

export interface RequestOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: () => Date;
}

/** One request, no cache. Rejects with PowerRequestError only. */
export async function requestMonthly(
  region: Region,
  endYear: number,
  {
    fetchImpl = fetch,
    timeoutMs = REQUEST_TIMEOUT_MS,
    now = () => new Date(),
  }: RequestOptions = {},
): Promise<RegionDataset> {
  const url = monthlyUrl(region, endYear);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(url, { signal: controller.signal });
  } catch {
    clearTimeout(timer);
    throw new PowerRequestError(
      controller.signal.aborted
        ? {
            kind: "timeout",
            message: `NASA POWER did not answer within ${Math.round(timeoutMs / 1000)} seconds.`,
          }
        : {
            kind: "network",
            message: "NASA POWER could not be reached. Check the connection and try again.",
          },
    );
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    const messages = parseErrorMessages(body);
    throw new PowerRequestError({
      kind: "http",
      status: response.status,
      message: `NASA POWER answered with an error (HTTP ${response.status})${messages.length ? `: ${messages.join(" ")}` : "."}`,
    });
  }
  try {
    return parseMonthlyResponse(body, region, url, now().toISOString());
  } catch (error) {
    throw new PowerRequestError({
      kind: "parse",
      message: `The NASA POWER response could not be read (${(error as Error).message}).`,
    });
  }
}

/* ---- Session cache: one promise per region, shared by every consumer ---- */

const cache = new Map<string, Promise<RegionDataset>>();
const settled = new Map<string, RegionDataset>();

export function cacheKey(region: Region, endYear: number) {
  return `${region.latitude.toFixed(3)},${region.longitude.toFixed(3)}|${POWER_PARAMETERS.join(",")}|${POWER_FIRST_YEAR}-${endYear}`;
}

/**
 * The dataset of a region, requested at most once per session. Concurrent
 * callers (the Explore page and the guide) share the same request. A failed
 * request is forgotten, so the next call (Try again) requests it anew.
 */
export function loadRegionDataset(
  region: Region,
  endYear = new Date().getFullYear(),
  options?: RequestOptions,
): Promise<RegionDataset> {
  const key = cacheKey(region, endYear);
  let promise = cache.get(key);
  if (!promise) {
    promise = requestMonthly(region, endYear, options).then(
      (dataset) => {
        settled.set(key, dataset);
        return dataset;
      },
      (error) => {
        cache.delete(key);
        throw error;
      },
    );
    cache.set(key, promise);
  }
  return promise;
}

/** The dataset if it has already arrived, so a cached region renders without a loading flash. */
export function peekRegionDataset(
  region: Region,
  endYear = new Date().getFullYear(),
): RegionDataset | null {
  return settled.get(cacheKey(region, endYear)) ?? null;
}

export function clearPowerCache() {
  cache.clear();
  settled.clear();
}
