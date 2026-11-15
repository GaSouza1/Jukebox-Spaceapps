/**
 * CinematicProfile — picks the mood of the Cinematic layer for one image:
 * energetic (faster, higher, brighter) or contemplative (slower, lower,
 * darker), with a continuous blend in between.
 *
 * This is an ARTISTIC choice of atmosphere, not a reading of the data: a
 * bright image is not "warmer", "drier" or anything physical. Only one number
 * leaves this module (`energy`, 0..1); the cinematic composer never sees the
 * analysis itself, and the Scientific layer is not affected at all.
 *
 * Inputs (global features only, never colour alone):
 * - mean brightness (luma) of the image;
 * - luminosity distribution: soft share of bright slices (each slice counts
 *   gradually between 0.35 and 0.65 luma, so no hard cut makes the score jump);
 * - global contrast: mean in-slice contrast, normalised.
 */
import type { ImageAnalysis } from "./imageAnalyzer";

export interface ProfileThresholds {
  /** Score at or below which the profile is fully contemplative. */
  contemplative: number;
  /** Score at or above which the profile is fully energetic. */
  energetic: number;
}

/** Configurable: scores between the two thresholds blend the profiles smoothly. */
export const PROFILE_THRESHOLDS: ProfileThresholds = { contemplative: 0.1, energetic: 0.8 };

/** Weights of the global features in the score; they sum to 1. */
export const PROFILE_WEIGHTS = { meanLuma: 0.55, brightShare: 0.3, contrast: 0.15 } as const;
/** In-slice contrast (std. dev. of luma) that counts as fully contrasted. */
const FULL_CONTRAST = 0.25;
/** A slice counts as bright gradually between these two lumas. */
const BRIGHT_FROM = 0.35;
const BRIGHT_TO = 0.65;

export interface CinematicProfile {
  /** 0 = contemplative, 1 = energetic, blended in between. */
  energy: number;
  /** Weighted score before the thresholds, 0..1. */
  score: number;
  label: "energetic" | "contemplative" | "blended";
  inputs: { meanLuma: number; brightShare: number; contrast: number };
}

const smoothstep = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function cinematicProfile(
  analysis: Pick<ImageAnalysis, "steps">,
  thresholds: ProfileThresholds = PROFILE_THRESHOLDS,
): CinematicProfile {
  const { steps } = analysis;
  const n = Math.max(1, steps.length);
  const meanLuma = steps.reduce((a, s) => a + s.luma, 0) / n;
  const brightShare =
    steps.reduce(
      (a, s) => a + smoothstep(clamp01((s.luma - BRIGHT_FROM) / (BRIGHT_TO - BRIGHT_FROM))),
      0,
    ) / n;
  const contrast = Math.min(1, steps.reduce((a, s) => a + s.contrast, 0) / n / FULL_CONTRAST);
  const score =
    PROFILE_WEIGHTS.meanLuma * meanLuma +
    PROFILE_WEIGHTS.brightShare * brightShare +
    PROFILE_WEIGHTS.contrast * contrast;
  const span = Math.max(1e-6, thresholds.energetic - thresholds.contemplative);
  const energy = smoothstep(clamp01((score - thresholds.contemplative) / span));
  return {
    energy,
    score,
    label: energy >= 0.85 ? "energetic" : energy <= 0.15 ? "contemplative" : "blended",
    inputs: { meanLuma, brightShare, contrast },
  };
}
