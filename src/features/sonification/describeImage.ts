/**
 * Text about an image and its sonification, computed from the analysis only:
 * the visible text profile and the narration script. The UI, the narration
 * and the tests all render from here.
 *
 * The engine measures brightness and colour; it does not recognise objects or
 * places. Nothing here may name a feature (forest, ocean, city, fire…) unless
 * a person wrote it in the image description, and that text is always
 * attributed to whoever wrote it.
 *
 * Visual temperature: following the usual convention of thermal maps, warm or
 * strong colours are described as high temperature and cool or weak colours as
 * low temperature. It is an interpretation of colour and brightness, never a
 * measured temperature, and it does not change the sound.
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

const THIRDS: Record<ReadingDirection, [string, string, string]> = {
  vertical: ["top third", "middle third", "bottom third"],
  horizontal: ["left third", "middle third", "right third"],
};
/** Thirds whose mean brightness differs by less than this are called similar. */
const UNIFORM_LUMA = 0.03;

export type TemperatureBand =
  | "low"
  | "moderately low"
  | "intermediate"
  | "moderately high"
  | "high";

/**
 * Visual temperature of a set of pixels, 0 (coldest-looking) .. 1 (hottest-looking).
 * Two readings of equal weight, both pushing the same way:
 * - hue: the share of warm pixels among the coloured ones (warm → hot, cool → cold;
 *   0.5 when the pixels are all neutral);
 * - strength: the mean of colour vividness and brightness (strong → hot, weak → cold).
 * Vividness is the mean chroma, which saturates at VIVID_CHROMA.
 */
export const VIVID_CHROMA = 0.5;
export function visualHeat(shares: Record<HueFamily, number>, chroma: number, luma: number) {
  const coloured = shares.warm + shares.cool;
  const hueHeat = coloured > 0 ? shares.warm / coloured : 0.5;
  const strength = (Math.min(1, chroma / VIVID_CHROMA) + luma) / 2;
  return (hueHeat + strength) / 2;
}

const HEAT_BANDS: [number, TemperatureBand][] = [
  [0.2, "low"],
  [0.4, "moderately low"],
  [0.6, "intermediate"],
  [0.8, "moderately high"],
];
export function temperatureBand(heat: number): TemperatureBand {
  return HEAT_BANDS.find(([limit]) => heat < limit)?.[1] ?? "high";
}
/** Thirds whose mean visual temperature differs by less than this are called similar. */
const UNIFORM_HEAT = 0.08;

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
    const chroma = slice.reduce((a, step) => a + step.saturation, 0) / slice.length;
    const heat = visualHeat(
      {
        warm: shares.warm / slice.length,
        cool: shares.cool / slice.length,
        neutral: shares.neutral / slice.length,
      },
      chroma,
      luma,
    );
    const where = s === 0 ? ` (${edge[0]})` : s === PROFILE_SECTIONS - 1 ? ` (${edge[1]})` : "";
    return `Slices ${s * size + 1}–${s * size + slice.length}${where}: mostly ${HUE_LABEL[dominant]} hues (${Math.round((shares[dominant] / slice.length) * 100)}%, ${TIMBRE_LABEL[TIMBRE_BY_HUE[dominant]]}), mean brightness ${luma.toFixed(2)}, visual temperature ${temperatureBand(heat)} (${heat.toFixed(2)}), pitch around ${Math.round(lumaToFrequency(luma))} Hz.`;
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
  /** Mean visual temperature over the whole image, 0 (coldest-looking) .. 1 (hottest-looking). */
  heat: number;
  /** Mean visual temperature of each third along the reading direction. */
  thirdHeat: number[];
  hottestThird: number;
  coolestThird: number;
  /** True when every third has about the same visual temperature. */
  heatUniform: boolean;
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
  // Every slice holds the same number of pixels, so the image's visual
  // temperature is the mean of its slices'.
  const stepHeat = steps.map((s) => visualHeat(s.hueShares, s.saturation, s.luma));
  const thirdHeat = [0, 1, 2].map((t) =>
    mean(
      stepHeat.slice(Math.round((t * steps.length) / 3), Math.round(((t + 1) * steps.length) / 3)),
    ),
  );
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
    heat: mean(stepHeat),
    thirdHeat,
    hottestThird: argMax(thirdHeat),
    coolestThird: argMin(thirdHeat),
    heatUniform: Math.max(...thirdHeat) - Math.min(...thirdHeat) < UNIFORM_HEAT,
    horizontalCentre:
      lumaSum > 0 ? steps.reduce((a, s) => a + s.luma * s.horizontalCentroid, 0) / lumaSum : 0.5,
  };
}

function sentence(text: string) {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** A third at or above this visual temperature counts as high, below LOW_HEAT as low. */
export const HIGH_HEAT = 0.65;
export const LOW_HEAT = 0.35;

function regionList(names: string[]) {
  return names.length === 3 ? "the whole image" : names.join(" and ");
}

/**
 * Short sentences naming the regions of high and low temperature, by third along
 * the reading direction. Regions in between are not mentioned, and colours are
 * never named. It is an estimate from colour and brightness, not a measurement.
 */
export function describeTemperatureRegions(analysis: ImageAnalysis): string[] {
  const { thirdHeat } = summarizeAnalysis(analysis);
  const names = THIRDS[analysis.direction];
  const high = names.filter((_, i) => thirdHeat[i] >= HIGH_HEAT);
  const low = names.filter((_, i) => thirdHeat[i] < LOW_HEAT);
  const lines: string[] = [];
  if (high.length) lines.push(`High temperature: ${regionList(high)}.`);
  if (low.length) lines.push(`Low temperature: ${regionList(low)}.`);
  if (!lines.length) lines.push("No region stands out as high or low temperature.");
  lines.push("Estimated from the image, not measured.");
  return lines;
}

/**
 * The sentences the app generates for an image, after the description: the
 * temperature regions and the reading direction. The narration speaks them and
 * the image caption shows them, from this one function, so both always match.
 */
export function describeGenerated(analysis: ImageAnalysis, direction: ReadingDirection): string[] {
  return [
    ...describeTemperatureRegions(analysis),
    `The sound reads the image ${DIRECTION_SPOKEN[direction]}.`,
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
 * The text the Narration layer speaks for one image: its position and name, the
 * description a person wrote (attributed), and the regions of high and low
 * temperature. Colours are never named. The app does not identify objects.
 */
export function narrationScript(input: NarrationInput): string[] {
  const { description, analysis } = input;
  const lines = [`Image ${input.position} of ${input.count}: ${sentence(input.name)}`];

  if (description.humanText) {
    lines.push(`Team description: ${sentence(description.humanText)}`);
  } else if (description.userText?.trim()) {
    lines.push(`Description by the uploader, not verified: ${sentence(description.userText)}`);
  } else {
    lines.push("No description is available. The app does not identify objects or places.");
  }

  if (input.failed) {
    lines.push("This image could not be analysed, so it has no sound and will be skipped.");
    return lines;
  }
  if (!analysis) return lines;

  lines.push(...describeGenerated(analysis, input.direction));
  return lines;
}
