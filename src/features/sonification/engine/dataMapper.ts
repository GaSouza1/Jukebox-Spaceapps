/**
 * DataMapper — the single place where visual data becomes sound parameters.
 * Every mapping is linear (or linear-in-octaves for pitch) and unquantised so
 * the proportions and trends of the source values are preserved.
 *
 * See ../SONIFICATION.md for rationale.
 */
import type { HueFamily, ImageAnalysis, VisualStep } from "./imageAnalyzer";

/** Pitch range of the scientific voice: C4 → C6 (two octaves). */
export const PITCH_FLOOR_HZ = 261.63;
export const PITCH_OCTAVES = 2;
export const VELOCITY_MIN = 0.3;
export const VELOCITY_RANGE = 0.6;
/** Maximum stereo deflection (moderate spatialisation). */
export const PAN_WIDTH = 0.6;
/** Steps per cinematic section (one chord per section). */
export const SECTION_LENGTH = 16;

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

export interface CinematicSection {
  index: number;
  startStep: number;
  /** Mean luma of the section, rank-normalised 0..1 within this image. */
  brightnessRank: number;
  /** Mean step-to-step variation of the section, 0..1 relative to the image max. */
  activity: number;
}

/** Hue family → timbre. Encodes the visual colour family only. */
export const TIMBRE_BY_HUE: Record<HueFamily, ScientificTimbre> = {
  warm: "piano",
  cool: "bell",
  neutral: "glass",
};

/** luma 0..1 → frequency, linear in octaves (equal luma steps = equal pitch steps). */
export function lumaToFrequency(luma: number): number {
  return PITCH_FLOOR_HZ * 2 ** (PITCH_OCTAVES * Math.min(1, Math.max(0, luma)));
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

/**
 * Coarse, section-level descriptors for the cinematic layer. They only steer
 * mood (chord colour, texture density) and never carry exact values.
 */
export function planSections(analysis: ImageAnalysis): CinematicSection[] {
  const sections: CinematicSection[] = [];
  for (let start = 0; start < analysis.steps.length; start += SECTION_LENGTH) {
    const slice = analysis.steps.slice(start, start + SECTION_LENGTH);
    const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
    sections.push({
      index: sections.length,
      startStep: start,
      brightnessRank: mean(slice.map((s) => s.luma)),
      activity: mean(slice.map((s) => s.variation)),
    });
  }
  const lumas = sections.map((s) => s.brightnessRank);
  const lo = Math.min(...lumas);
  const span = Math.max(...lumas) - lo;
  const maxActivity = Math.max(...sections.map((s) => s.activity));
  return sections.map((s) => ({
    ...s,
    brightnessRank: span > 0 ? (s.brightnessRank - lo) / span : 0.5,
    activity: maxActivity > 0 ? s.activity / maxActivity : 0,
  }));
}
