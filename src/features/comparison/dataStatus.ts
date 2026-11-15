/**
 * Text of the data-loading states, shared by the status line, the live-region
 * announcements, the player (why Play is unavailable) and the guide. Pure, so
 * the wording and the "one message per change" rule are unit-tested.
 */
import type { Region } from "../../types/data";
import { describeIssue, type ComparisonData } from "../data/comparison";
import type { DataError } from "../data/power/powerClient";
import { formatLongMonth } from "../data/format";

export type DataStatusState =
  | { status: "loading"; loading: Region[] }
  | { status: "error"; error: DataError; failed: Region[] }
  | { status: "ready"; data: ComparisonData };

const names = (list: Region[]) => list.map((r) => r.name).join(" and ");

export function loadingText(loading: Region[]) {
  return `Loading NASA POWER data for ${names(loading)}…`;
}

export function errorText(state: Extract<DataStatusState, { status: "error" }>) {
  return `The data for ${names(state.failed)} could not be loaded. ${state.error.message}`;
}

/** Months without a value, per region, in one sentence. */
export function missingText(data: ComparisonData) {
  const { months, presentA, presentB } = data.coverage;
  const missing = [
    [data.regionA, months - presentA],
    [data.regionB, months - presentB],
  ] as const;
  const parts = missing
    .filter(([, n]) => n > 0)
    .map(([region, n]) => `${region.name} has ${n} ${n === 1 ? "month" : "months"} without data`);
  return parts.length ? `${parts.join("; ")}.` : "No month is missing.";
}

export function readyText(data: ComparisonData) {
  const { start, end } = data.period;
  return `NASA POWER data loaded for ${data.regionA.name} and ${data.regionB.name}: ${data.coverage.months} months, ${formatLongMonth(start)} to ${formatLongMonth(end)}. ${missingText(data)}`;
}

/** Why the comparison cannot be played, or null when it can. */
export function unavailableReason(state: DataStatusState): string | null {
  if (state.status === "loading") return "Play is not available yet: the data is still loading.";
  if (state.status === "error") return "Play is not available: the data could not be loaded.";
  const [issue] = state.data.issues;
  return issue ? `Play is not available. ${describeIssue(issue, state.data)}` : null;
}

/**
 * What the live region says when the state changes: loading once, then the
 * result once (only if a loading was announced). Errors are announced by the
 * alert itself, and a cached region that is ready at once says nothing extra.
 */
export function announcementFor(
  previous: DataStatusState["status"] | null,
  next: DataStatusState,
): string | null {
  if (next.status === "loading") return previous === "loading" ? null : loadingText(next.loading);
  if (next.status === "ready" && previous === "loading") return readyText(next.data);
  return null;
}
