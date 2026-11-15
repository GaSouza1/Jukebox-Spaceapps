/**
 * Single source of truth for the region-comparison sonification: the mapping
 * constants the player uses, and the text that describes them. Both the player
 * (screen-reader description) and the guided experience (visible text) render
 * from here, so the two can never diverge.
 */
import { formatMonth, indicators, type IndicatorId } from "../data/demoData";
import { describeSeries, round } from "../data/seriesStats";
import type { RegionSeries } from "../../types/data";
import type { PlaybackMode } from "../../stores/comparisonStore";

export const COMPARISON_MAPPING = {
  /** Both regions share this pitch range, mapped linearly from the lowest to the highest value. */
  lowHz: 130,
  highHz: 620,
  /** One month every 500 ms at 1×. */
  stepMs: 500,
  /** Region A left, region B right when both play together; solo playback is centred. */
  pan: 0.7,
} as const;

export const REGION_SOUND = {
  a: { timbre: "soft sine tone", channel: "left channel", line: "solid blue line" },
  b: { timbre: "brighter triangle tone", channel: "right channel", line: "dashed orange line" },
} as const;

export function formatLongMonth(date: string) {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}-01T00:00:00Z`),
  );
}

export function modeLabel(mode: PlaybackMode, seriesA: RegionSeries, seriesB: RegionSeries) {
  if (mode === "a") return `Region A, ${seriesA.region.name}, on its own`;
  if (mode === "b") return `Region B, ${seriesB.region.name}, on its own`;
  return `both regions together`;
}

export interface SonificationDescription {
  /** Ordered, labelled facts. Rendered as a list in the guide and as prose in the player. */
  facts: { id: string; label: string; text: string }[];
  durationSeconds: number;
}

export function describeComparisonSonification(
  seriesA: RegionSeries,
  seriesB: RegionSeries,
  speed: number,
  mode: PlaybackMode,
): SonificationDescription {
  const indicator = indicators[seriesA.indicator as IndicatorId];
  const unit = indicator.unit;
  const all = [...seriesA.data, ...seriesB.data].map((p) => p.value);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const months = seriesA.data.length;
  const first = seriesA.data[0]?.date;
  const last = seriesA.data.at(-1)?.date;
  const durationSeconds = Math.round((months * COMPARISON_MAPPING.stepMs) / 1000 / speed);
  const statsA = describeSeries(seriesA);
  const statsB = describeSeries(seriesB);
  const gap = statsA.mean - statsB.mean;

  return {
    durationSeconds,
    facts: [
      {
        id: "what",
        label: "What you will hear",
        text: `A sound representation of the line chart “Monthly ${indicator.shortLabel.toLowerCase()} history”, playing ${modeLabel(mode, seriesA, seriesB)}.`,
      },
      {
        id: "variable",
        label: "Variable",
        text: `${indicator.label}, in ${unit}. ${indicator.description}`,
      },
      {
        id: "regions",
        label: "Regions",
        text: `Region A is ${seriesA.region.name}, ${seriesA.region.country}. Region B is ${seriesB.region.name}, ${seriesB.region.country}.`,
      },
      {
        id: "period",
        label: "Period and duration",
        text: `${first ? formatLongMonth(first) : ""} to ${last ? formatLongMonth(last) : ""}: ${months} months, one month every ${Number((COMPARISON_MAPPING.stepMs / 1000 / speed).toFixed(2))} seconds, about ${durationSeconds} seconds in total at ${speed}× speed.`,
      },
      {
        id: "values",
        label: "Values",
        text: `${seriesA.region.name} averages ${round(statsA.mean)} ${unit} (from ${statsA.minPoint.value} to ${statsA.maxPoint.value}). ${seriesB.region.name} averages ${round(statsB.mean)} ${unit} (from ${statsB.minPoint.value} to ${statsB.maxPoint.value}). On average, ${seriesA.region.name} is ${Math.abs(round(gap))} ${unit} ${gap >= 0 ? "higher" : "lower"} than ${seriesB.region.name}.`,
      },
      {
        id: "pitch",
        label: "How values become sound",
        text: `Each month plays one short note per region. Pitch represents the value: the higher the ${indicator.shortLabel.toLowerCase()}, the higher the note. Both regions share one scale, from ${COMPARISON_MAPPING.lowHz} hertz for the lowest value in this comparison (${min} ${unit}) to ${COMPARISON_MAPPING.highHz} hertz for the highest (${max} ${unit}), so equal values sound at equal pitch. Rising and falling melodies follow the month-to-month changes in the data.`,
      },
      {
        id: "identities",
        label: "Timbres and channels",
        text: `${seriesA.region.name} (Region A) is a ${REGION_SOUND.a.timbre}, in the ${REGION_SOUND.a.channel} when both regions play together. ${seriesB.region.name} (Region B) is a ${REGION_SOUND.b.timbre}, in the ${REGION_SOUND.b.channel}. A region played on its own is centred, so it can be heard on any speaker or with one earphone.`,
      },
      {
        id: "data",
        label: "Data source",
        text: "Values are synthetic demonstration data, not NASA measurements.",
      },
    ],
  };
}
