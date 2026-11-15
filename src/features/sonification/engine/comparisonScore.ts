/**
 * Region comparison → SonificationScore.
 *
 * - One step per month, 0.5 s at 1×, constant rhythm.
 * - Pitch = value, on ONE scale shared by both regions: the lowest value of
 *   the comparison is C4 (261.63 Hz), the highest C6 (1046.5 Hz), linear in
 *   octaves, unquantised. Same value, same pitch; equal differences, equal
 *   intervals.
 * - Region A: soft sine ("glass"), left. Region B: triangle, right. A region
 *   played on its own is centred.
 * - A missing month is a silence in that voice. Loudness is constant: it
 *   carries no data. No cinematic background, no third "difference" voice.
 */
import type { ComparisonData, ComparisonRow } from "../../data/comparison";
import {
  normToFrequency,
  PITCH_FLOOR_HZ,
  PITCH_OCTAVES,
  type ScoreNote,
  type SonificationScore,
  type VoiceTimbre,
} from "./score";

export type PlaybackMode = "both" | "a" | "b";

export const COMPARISON_STEP_SECONDS = 0.5;
export const COMPARISON_VELOCITY = 0.7;
export const COMPARISON_PAN = 0.7;
export const REGION_VOICES: Record<"a" | "b", { timbre: VoiceTimbre; pan: number }> = {
  a: { timbre: "glass", pan: -COMPARISON_PAN },
  b: { timbre: "triangle", pan: COMPARISON_PAN },
};
/**
 * Spans smaller than this (in the data unit) are treated as flat: every note
 * plays at the middle of the range instead of stretching noise over two octaves.
 */
export const FLAT_SPAN = 0.05;

export interface PitchScale {
  floorHz: number;
  octaves: number;
  /** Lowest and highest value present in either region, or null when there is none. */
  domain: { min: number; max: number } | null;
  /** True when every value is (almost) the same. */
  flat: boolean;
}

export function comparisonScale(rows: ComparisonRow[]): PitchScale {
  const values = rows.flatMap((r) => [r.a, r.b]).filter((v): v is number => v !== null);
  const domain = values.length ? { min: Math.min(...values), max: Math.max(...values) } : null;
  return {
    floorHz: PITCH_FLOOR_HZ,
    octaves: PITCH_OCTAVES,
    domain,
    flat: !domain || domain.max - domain.min < FLAT_SPAN,
  };
}

export function valueToFrequency(value: number, scale: PitchScale) {
  if (!scale.domain || scale.flat) return normToFrequency(0.5, scale.floorHz, scale.octaves);
  const { min, max } = scale.domain;
  return normToFrequency((value - min) / (max - min), scale.floorHz, scale.octaves);
}

export function comparisonToScore(
  data: Pick<ComparisonData, "rows">,
  mode: PlaybackMode,
): SonificationScore {
  const scale = comparisonScale(data.rows);
  const voice = (side: "a" | "b") => {
    const heard = mode === "both" || mode === side;
    const note = (value: number | null): ScoreNote | null =>
      heard && value !== null
        ? { frequency: valueToFrequency(value, scale), velocity: COMPARISON_VELOCITY }
        : null;
    return {
      id: side,
      timbre: REGION_VOICES[side].timbre,
      // Left/right only when comparing; a region on its own is centred so any speaker works.
      pan: mode === "both" ? REGION_VOICES[side].pan : 0,
      notes: data.rows.map((row) => note(row[side])),
    };
  };
  return {
    stepCount: data.rows.length,
    stepSeconds: COMPARISON_STEP_SECONDS,
    voices: [voice("a"), voice("b")],
    cinematic: null,
  };
}
