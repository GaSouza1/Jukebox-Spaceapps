/**
 * Text about an image and its sonification, computed from the analysis only:
 * the visible text profile and the narration script. The UI, the narration
 * and the tests all render from here.
 *
 * The engine measures brightness and colour; it does not recognise objects or
 * places. Nothing here may name a feature (forest, ocean, city, fire…) unless
 * a person wrote it in the image description, and that text is always
 * attributed to whoever wrote it.
 */
import { lumaToFrequency, TIMBRE_BY_HUE, type ScientificTimbre } from "./engine/dataMapper";
import type { HueFamily, ImageAnalysis, ReadingDirection } from "./engine/imageAnalyzer";

export interface ImageDescription {
  alt: string;
  /** Written and checked by the project team, or null when none exists. */
  humanText: string | null;
  /** Typed by the person who added the image; not verified by the app. */
  userText: string | null;
}

export const HUE_LABEL: Record<HueFamily, string> = {
  warm: "warm",
  cool: "cool",
  neutral: "neutral",
};
export const TIMBRE_LABEL: Record<ScientificTimbre, string> = {
  piano: "sampled piano",
  bell: "soft bell",
  glass: "pure sine tone",
};
export const DIRECTION_SPOKEN: Record<ReadingDirection, string> = {
  vertical: "from the top of the image to the bottom (north to south)",
  horizontal: "from the left edge of the image to the right (west to east)",
};
export const PROFILE_SECTIONS = 6;

const HUE_SPOKEN: Record<HueFamily, string> = {
  warm: "warm hues (red, orange or yellow)",
  cool: "cool hues (green, cyan or blue)",
  neutral: "neutral tones (grey, white or black)",
};
const THIRDS: Record<ReadingDirection, [string, string, string]> = {
  vertical: ["top third", "middle third", "bottom third"],
  horizontal: ["left third", "middle third", "right third"],
};
/** Thirds whose mean brightness differs by less than this are called similar. */
const UNIFORM_LUMA = 0.03;

/** Plain-text profile of the image, computed from the analysis only. */
export function describeProfile(analysis: ImageAnalysis) {
  const size = Math.ceil(analysis.steps.length / PROFILE_SECTIONS);
  const edge = analysis.direction === "vertical" ? ["top", "bottom"] : ["left edge", "right edge"];
  return Array.from({ length: PROFILE_SECTIONS }, (_, s) => {
    const slice = analysis.steps.slice(s * size, (s + 1) * size);
    const luma = slice.reduce((a, step) => a + step.luma, 0) / slice.length;
    const shares = { warm: 0, cool: 0, neutral: 0 };
    for (const step of slice) {
      for (const hue of Object.keys(shares) as HueFamily[]) shares[hue] += step.hueShares[hue];
    }
    const dominant = (Object.keys(shares) as HueFamily[]).reduce((a, b) =>
      shares[b] > shares[a] ? b : a,
    );
    const where = s === 0 ? ` (${edge[0]})` : s === PROFILE_SECTIONS - 1 ? ` (${edge[1]})` : "";
    return `Slices ${s * size + 1}–${s * size + slice.length}${where}: mostly ${HUE_LABEL[dominant]} hues (${Math.round((shares[dominant] / slice.length) * 100)}%, ${TIMBRE_LABEL[TIMBRE_BY_HUE[dominant]]}), mean brightness ${luma.toFixed(2)}, pitch around ${Math.round(lumaToFrequency(luma))} Hz.`;
  });
}

export interface ImageSummary {
  meanLuma: number;
  meanContrast: number;
  /** Share of pixels in each hue family over the whole image, sums to 1. */
  hueShares: Record<HueFamily, number>;
  brightestThird: number;
  darkestThird: number;
  /** True when every third has about the same mean brightness. */
  uniform: boolean;
  mostContrastThird: number;
  /** Luma-weighted horizontal centre of the whole image, 0 (left) .. 1 (right). */
  horizontalCentre: number;
}

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const argMax = (values: number[]) => values.indexOf(Math.max(...values));
const argMin = (values: number[]) => values.indexOf(Math.min(...values));

/** Whole-image figures behind the narration. Every value comes from the analysis. */
export function summarizeAnalysis(analysis: ImageAnalysis): ImageSummary {
  const { steps } = analysis;
  const thirds = [0, 1, 2].map((t) =>
    steps.slice(Math.round((t * steps.length) / 3), Math.round(((t + 1) * steps.length) / 3)),
  );
  const thirdLuma = thirds.map((slice) => mean(slice.map((s) => s.luma)));
  const thirdContrast = thirds.map((slice) => mean(slice.map((s) => s.contrast)));
  const hueShares = { warm: 0, cool: 0, neutral: 0 };
  for (const step of steps) {
    for (const hue of Object.keys(hueShares) as HueFamily[]) {
      hueShares[hue] += step.hueShares[hue] / steps.length;
    }
  }
  // Every slice holds the same number of pixels, so weighting each slice
  // centroid by its mean luma gives the centroid of the whole image.
  const lumaSum = steps.reduce((a, s) => a + s.luma, 0);
  return {
    meanLuma: mean(steps.map((s) => s.luma)),
    meanContrast: mean(steps.map((s) => s.contrast)),
    hueShares,
    brightestThird: argMax(thirdLuma),
    darkestThird: argMin(thirdLuma),
    uniform: Math.max(...thirdLuma) - Math.min(...thirdLuma) < UNIFORM_LUMA,
    mostContrastThird: argMax(thirdContrast),
    horizontalCentre:
      lumaSum > 0 ? steps.reduce((a, s) => a + s.luma * s.horizontalCentroid, 0) / lumaSum : 0.5,
  };
}

function brightnessWord(luma: number) {
  return luma < 0.3 ? "dark" : luma < 0.6 ? "medium-bright" : "bright";
}

function contrastWord(contrast: number) {
  return contrast < 0.08 ? "low" : contrast < 0.18 ? "moderate" : "high";
}

function sentence(text: string) {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** Sentences describing what the analysis measured. No object or place is named. */
export function describeMeasurements(analysis: ImageAnalysis): string[] {
  const summary = summarizeAnalysis(analysis);
  const thirds = THIRDS[analysis.direction];
  const hues = (Object.keys(summary.hueShares) as HueFamily[])
    .filter((hue) => summary.hueShares[hue] >= 0.05)
    .sort((a, b) => summary.hueShares[b] - summary.hueShares[a])
    .map((hue) => `${Math.round(summary.hueShares[hue] * 100)} percent ${HUE_SPOKEN[hue]}`);
  const list =
    hues.length > 1 ? `${hues.slice(0, -1).join(", ")} and ${hues[hues.length - 1]}` : hues[0];
  const centre = summary.horizontalCentre;
  const lean =
    centre < 0.45 ? "left of centre" : centre > 0.55 ? "right of centre" : "near the centre";

  return [
    `Measured visual features: the image is ${brightnessWord(summary.meanLuma)} overall, with a mean brightness of ${summary.meanLuma.toFixed(2)} on a scale from 0 for black to 1 for white.`,
    `Its pixels are ${list}.`,
    summary.uniform
      ? "Brightness is similar across the image."
      : `The brightest part is the ${thirds[summary.brightestThird]}, and the darkest is the ${thirds[summary.darkestThird]}.`,
    `Contrast is ${contrastWord(summary.meanContrast)}, highest in the ${thirds[summary.mostContrastThird]}.`,
    `Bright areas sit mostly ${lean}.`,
  ];
}

export interface NarrationInput {
  position: number;
  count: number;
  name: string;
  description: ImageDescription;
  /** null while the image is analysed, or when it could not be. */
  analysis: ImageAnalysis | null;
  failed: boolean;
  direction: ReadingDirection;
}

/**
 * The text the Narration layer speaks for one image. Description sources, in
 * order: the team-written description, then the uploader's own text, then
 * nothing but the measured features (with an explicit statement that the app
 * cannot identify objects or places).
 */
export function narrationScript(input: NarrationInput): string[] {
  const { description, analysis } = input;
  const lines = [`Image ${input.position} of ${input.count}: ${sentence(input.name)}`];

  if (description.humanText) {
    lines.push(`Description written by the project team: ${sentence(description.humanText)}`);
  } else if (description.userText?.trim()) {
    lines.push(
      "Description provided by the person who added this image. The app has not verified it.",
      sentence(description.userText),
    );
  } else {
    lines.push(
      "This image has no validated description, so it is being analysed through its visual characteristics.",
      "Its brightness, contrast, dominant colour families and horizontal distribution are converted into sound.",
      "The analysis does not automatically identify objects or geographical features.",
    );
  }

  if (input.failed) {
    lines.push("This image could not be analysed, so it has no sound and will be skipped.");
    return lines;
  }
  if (!analysis) return lines;

  lines.push(...describeMeasurements(analysis));
  if (description.humanText || description.userText?.trim()) {
    lines.push("The sound is computed from these measurements, not from the description.");
  }
  lines.push(`The sound reads the image ${DIRECTION_SPOKEN[input.direction]}.`);
  return lines;
}
