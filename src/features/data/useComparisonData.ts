/**
 * The comparison currently selected in the store, as ComparisonData. Used by
 * the Explore page AND the screen-reader guide, so both describe exactly the
 * same numbers (P-15). The network work is shared too: each region is
 * requested once per session (powerClient's cache), whoever asks first.
 */
import { useEffect, useMemo, useState } from "react";
import { useComparisonStore } from "../../stores/comparisonStore";
import type { Region } from "../../types/data";
import type { DataStatusState } from "../comparison/dataStatus";
import { alignByDate, clampPeriod, commonYearRange, selectSeries } from "./comparison";
import {
  cacheKey,
  loadRegionDataset,
  peekRegionDataset,
  PowerRequestError,
  type DataError,
} from "./power/powerClient";
import type { RegionDataset } from "./power/powerParse";

type Loadable =
  | { status: "loading" }
  | { status: "ready"; dataset: RegionDataset }
  | { status: "error"; error: DataError };

const END_YEAR = new Date().getFullYear();

function toDataError(error: unknown): DataError {
  if (error instanceof PowerRequestError) return error.detail;
  return { kind: "network", message: (error as Error)?.message ?? "Unknown error." };
}

/** One region's dataset. A result for a region no longer selected is never shown. */
function useRegionDataset(region: Region | null) {
  const key = region ? cacheKey(region, END_YEAR) : null;
  const [state, setState] = useState<{ key: string | null; value: Loadable }>({
    key: null,
    value: { status: "loading" },
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!region) return;
    const cached = peekRegionDataset(region, END_YEAR);
    if (cached) {
      setState({ key, value: { status: "ready", dataset: cached } });
      return;
    }
    let live = true;
    setState({ key, value: { status: "loading" } });
    loadRegionDataset(region, END_YEAR).then(
      (dataset) => live && setState({ key, value: { status: "ready", dataset } }),
      (error) => live && setState({ key, value: { status: "error", error: toDataError(error) } }),
    );
    return () => {
      live = false;
    };
    // `key` identifies the region; `attempt` re-runs the request after Try again.
  }, [key, attempt]);

  let value: Loadable = state.value;
  if (state.key !== key) {
    // The selection changed and the effect has not run yet: never show the old region.
    const cached = region ? peekRegionDataset(region, END_YEAR) : null;
    value = cached ? { status: "ready", dataset: cached } : { status: "loading" };
  }
  return { value, retry: () => setAttempt((n) => n + 1) };
}

export type ComparisonDataState = DataStatusState & {
  /** Re-requests the regions that failed. */
  retry: () => void;
  /** Complete years both regions cover (the period options), once known. */
  years: { first: number; last: number } | null;
};

export function useComparisonData(): ComparisonDataState | null {
  const regionA = useComparisonStore((s) => s.regionA);
  const regionB = useComparisonStore((s) => s.regionB);
  const indicator = useComparisonStore((s) => s.indicator);
  const startYear = useComparisonStore((s) => s.startYear);
  const endYear = useComparisonStore((s) => s.endYear);
  const setPeriod = useComparisonStore((s) => s.setPeriod);

  const a = useRegionDataset(regionA);
  const b = useRegionDataset(regionB);
  const datasetA = a.value.status === "ready" ? a.value.dataset : null;
  const datasetB = b.value.status === "ready" ? b.value.dataset : null;

  const years = useMemo(
    () => (datasetA && datasetB ? commonYearRange(datasetA, datasetB, indicator) : null),
    [datasetA, datasetB, indicator],
  );
  const period = years ? clampPeriod({ startYear, endYear }, years) : { startYear, endYear };

  // Keep the store inside the years the data covers (e.g. a year not yet complete).
  useEffect(() => {
    if (period.startYear !== startYear || period.endYear !== endYear) {
      setPeriod(period.startYear, period.endYear);
    }
  }, [period.startYear, period.endYear, startYear, endYear, setPeriod]);

  const data = useMemo(
    () =>
      datasetA && datasetB
        ? alignByDate(
            selectSeries(datasetA, indicator, period.startYear, period.endYear),
            selectSeries(datasetB, indicator, period.startYear, period.endYear),
          )
        : null,
    [datasetA, datasetB, indicator, period.startYear, period.endYear],
  );

  if (!regionA || !regionB) return null;
  const retry = () => {
    if (a.value.status === "error") a.retry();
    if (b.value.status === "error") b.retry();
  };
  const failed = [
    ...(a.value.status === "error" ? [{ region: regionA, error: a.value.error }] : []),
    ...(b.value.status === "error" ? [{ region: regionB, error: b.value.error }] : []),
  ];
  if (failed.length) {
    return {
      status: "error",
      error: failed[0].error,
      failed: failed.map((f) => f.region),
      retry,
      years,
    };
  }
  if (!data) {
    const loading = [
      ...(a.value.status === "loading" ? [regionA] : []),
      ...(b.value.status === "loading" ? [regionB] : []),
    ];
    return { status: "loading", loading, retry, years };
  }
  return { status: "ready", data, retry, years };
}
