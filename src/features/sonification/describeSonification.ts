/**
 * Single source of truth for the region-comparison sonification: the mapping
 * constants and the text that describes them. The player (screen-reader
 * description before Play) and the guided experience (visible text) render
 * from here, and the numbers come from the same functions the score uses
 * (comparisonScale, valueToFrequency), so text and sound can never diverge.
 */
import type { ComparisonData } from "../data/comparison";
import { formatDay, formatLongMonth } from "../data/format";
import { indicatorOf } from "../data/indicators";
import { cellSizeKm } from "../data/regions";
import { describeSide, round } from "../data/seriesStats";
import { summarizeDifference } from "../data/comparison";
import {
  COMPARISON_PAN,
  COMPARISON_STEP_SECONDS,
  comparisonScale,
  valueToFrequency,
  type PlaybackMode,
} from "./engine/comparisonScore";
import { PITCH_FLOOR_HZ, PITCH_OCTAVES } from "./engine/score";

export { formatLongMonth };

export const COMPARISON_MAPPING = {
  /** Both regions share this pitch range, linear in octaves from the lowest to the highest value. */
  floorHz: PITCH_FLOOR_HZ,
  octaves: PITCH_OCTAVES,
  topHz: PITCH_FLOOR_HZ * 2 ** PITCH_OCTAVES,
  /** One month every 500 ms at 1×. */
  stepMs: COMPARISON_STEP_SECONDS * 1000,
  /** Region A left, region B right when both play together; solo playback is centred. */
  pan: COMPARISON_PAN,
} as const;

export const REGION_SOUND = {
  a: { timbre: "soft sine tone", channel: "left channel", line: "solid blue line" },
  b: { timbre: "brighter triangle tone", channel: "right channel", line: "dashed orange line" },
} as const;

export function modeLabel(mode: PlaybackMode, data: Pick<ComparisonData, "regionA" | "regionB">) {
  if (mode === "a") return `Region A, ${data.regionA.name}, on its own`;
  if (mode === "b") return `Region B, ${data.regionB.name}, on its own`;
  return `both regions together`;
}

export interface SonificationDescription {
  /** Ordered, labelled facts. Rendered as a list in the guide and as prose in the player. */
  facts: { id: string; label: string; text: string }[];
  durationSeconds: number;
}

const hz = (value: number) => Math.round(value);

export function describeComparisonSonification(
  data: ComparisonData,
  speed: number,
  mode: PlaybackMode,
): SonificationDescription {
  const indicator = indicatorOf(data.indicatorId);
  const { regionA: a, regionB: b, spokenUnit: u } = data;
  const months = data.rows.length;
  const stepSeconds = COMPARISON_STEP_SECONDS / speed;
  const durationSeconds = Math.round(months * stepSeconds);
  const statsA = describeSide(data.rows, "a");
  const statsB = describeSide(data.rows, "b");
  const diff = summarizeDifference(data);
  const scale = comparisonScale(data.rows);
  const cellA = cellSizeKm(a.latitude);
  const cellB = cellSizeKm(b.latitude);
  const source = data.provenance.a;

  const mean = (name: string, s: typeof statsA) =>
    s.mean === null
      ? `${name} has no data in this period.`
      : `${name} averages ${round(s.mean)} ${u} (from ${s.minPoint!.value} to ${s.maxPoint!.value}).`;
  const gap =
    diff.meanDifference === null
      ? "No month has data for both regions."
      : `In the ${diff.monthsUsed} months with data for both, ${a.name} is on average ${Math.abs(round(diff.meanDifference))} ${u} ${diff.meanDifference >= 0 ? "higher" : "lower"} than ${b.name}.`;

  const pitch = !scale.domain
    ? "There are no values to play."
    : scale.flat
      ? `Every value in this comparison is about ${round(scale.domain.min)} ${u}, so every note plays at the same pitch, ${hz(valueToFrequency(scale.domain.min, scale))} hertz.`
      : `Each month plays one short note per region. Pitch represents the value: the higher the ${indicator.shortLabel.toLowerCase()}, the higher the note. Both regions share one scale, from ${hz(valueToFrequency(scale.domain.min, scale))} hertz for the lowest value in this comparison (${scale.domain.min} ${u}) to ${hz(valueToFrequency(scale.domain.max, scale))} hertz for the highest (${scale.domain.max} ${u}), so equal values sound at equal pitch. The scale is even in musical steps: equal differences in ${indicator.shortLabel.toLowerCase()} sound as equal intervals, anywhere in the range. Loudness does not change with the data.`;

  const missingA = statsA.missing;
  const missingB = statsB.missing;
  const missing =
    missingA || missingB
      ? `Months without data: ${a.name} ${missingA}, ${b.name} ${missingB}. During a month without data that region is silent; the silence is a gap in the data, not a low value.`
      : "Every month has data for both regions.";

  return {
    durationSeconds,
    facts: [
      {
        id: "what",
        label: "What you will hear",
        text: `A sound representation of the line chart “Monthly ${indicator.shortLabel.toLowerCase()} history”, playing ${modeLabel(mode, data)}.`,
      },
      {
        id: "variable",
        label: "Variable",
        text: `${indicator.label}, in ${u}. ${indicator.description}`,
      },
      {
        id: "regions",
        label: "Regions",
        text: `Region A is ${a.name}, ${a.country}. Region B is ${b.name}, ${b.country}. Each value describes a grid cell of about ${cellA.northSouth} by ${cellA.eastWest} km around ${a.name} and ${cellB.northSouth} by ${cellB.eastWest} km around ${b.name}, not the cities alone.`,
      },
      {
        id: "period",
        label: "Period and duration",
        text: `${formatLongMonth(data.period.start)} to ${formatLongMonth(data.period.end)}: ${months} months, one month every ${Number(stepSeconds.toFixed(2))} seconds, about ${durationSeconds} seconds in total at ${speed}× speed.`,
      },
      { id: "missing", label: "Missing months", text: missing },
      {
        id: "values",
        label: "Values",
        text: `${mean(a.name, statsA)} ${mean(b.name, statsB)} ${gap}`,
      },
      { id: "pitch", label: "How values become sound", text: pitch },
      {
        id: "identities",
        label: "Timbres and channels",
        text: `${a.name} (Region A) is a ${REGION_SOUND.a.timbre}, in the ${REGION_SOUND.a.channel} when both regions play together. ${b.name} (Region B) is a ${REGION_SOUND.b.timbre}, in the ${REGION_SOUND.b.channel}. A region played on its own is centred, so it can be heard on any speaker or with one earphone.`,
      },
      {
        id: "data",
        label: "Data source",
        text: `NASA POWER (${source.product}${source.apiVersion ? `, API ${source.apiVersion}` : ""}), from the MERRA-2 reanalysis, retrieved ${formatDay(source.retrievedAt)}. A reanalysis combines observations with a weather model; it is not a single weather station.`,
      },
    ],
  };
}
