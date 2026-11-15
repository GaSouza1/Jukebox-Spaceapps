/**
 * DataMapper — the single place where visual data becomes sound parameters.
 * Every mapping is linear (or linear-in-octaves for pitch) and unquantised so
 * the proportions and trends of the source values are preserved.
 *
 * See ../SONIFICATION.md for rationale.
 */
import type { HueFamily, ImageAnalysis, VisualStep } from "./imageAnalyzer";
import { normToFrequency } from "./score";

/** Pitch range of the scientific voice: C4 → C6 (two octaves), shared with the comparison. */
export { PITCH_FLOOR_HZ, PITCH_OCTAVES } from "./score";
export const VELOCITY_MIN = 0.3;
export const VELOCITY_RANGE = 0.6;
/** Maximum stereo deflection (moderate spatialisation). */
export const PAN_WIDTH = 0.6;

export type ScientificTimbre = "piano" | "bell" | "glass";

export interface ScientificEvent {
  /** Untouched source values, kept for display and auditing. */
  source: VisualStep;
  /** Continuous frequency, NOT snapped to any scale. */
  frequency: number;
  velocity: number;
  pan: number;
  timbre: ScientificTimbre;
}

/** Hue family → timbre. Encodes the visual colour family only. */
export const TIMBRE_BY_HUE: Record<HueFamily, ScientificTimbre> = {
  warm: "piano",
  cool: "bell",
  neutral: "glass",
};

/** luma 0..1 → frequency, linear in octaves (equal luma steps = equal pitch steps). */
export function lumaToFrequency(luma: number): number {
  return normToFrequency(luma);
}

export function mapScientific(step: VisualStep, stats: ImageAnalysis["stats"]): ScientificEvent {
  const contrastNorm = stats.maxContrast > 0 ? step.contrast / stats.maxContrast : 0;
  return {
    source: step,
    frequency: lumaToFrequency(step.luma),
    velocity: VELOCITY_MIN + VELOCITY_RANGE * contrastNorm,
    pan: (step.horizontalCentroid - 0.5) * 2 * PAN_WIDTH,
    timbre: TIMBRE_BY_HUE[step.hueFamily],
  };
}

export function mapAnalysis(analysis: ImageAnalysis): ScientificEvent[] {
  return analysis.steps.map((step) => mapScientific(step, analysis.stats));
}
