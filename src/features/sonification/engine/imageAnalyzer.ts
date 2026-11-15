/**
 * ImageAnalyzer — extracts visual features from an image, one "step" per slice
 * along the reading axis. Values are kept raw (0..1, no musical shaping) so the
 * DataMapper is the only place where data becomes sound.
 *
 * See ../SONIFICATION.md for the full description of every transformation.
 */

/** Horizontal = columns read west → east. Vertical = rows read north → south. */
export type ReadingDirection = "horizontal" | "vertical";

/** Visual hue family of the pixels (NOT a physical quantity). */
export type HueFamily = "warm" | "cool" | "neutral";

export interface VisualStep {
  index: number;
  /** Centre of the slice along the reading axis, 0..1. */
  position: number;
  /** Mean Rec. 709 luma (Y′) of the slice, 0..1. */
  luma: number;
  /** Mean HSV chroma (max − min of R′G′B′), 0..1. */
  saturation: number;
  /** Standard deviation of luma inside the slice, 0..0.5. */
  contrast: number;
  /** Luma-weighted horizontal centroid of the slice, 0 (left) .. 1 (right). */
  horizontalCentroid: number;
  /** Majority hue family among the slice pixels. */
  hueFamily: HueFamily;
  /** Share of pixels in each hue family, sums to 1. */
  hueShares: Record<HueFamily, number>;
  /** |luma − previous luma|; 0 for the first step. */
  variation: number;
}

export interface ImageAnalysis {
  direction: ReadingDirection;
  steps: VisualStep[];
  /** Pixel grid actually analysed (after downscaling). */
  grid: { width: number; height: number };
  /** Summary statistics used by the mapper for documented normalisations. */
  stats: { minLuma: number; maxLuma: number; maxContrast: number; maxVariation: number };
}

export const STEP_COUNT = 96;
/** Pixels with chroma below this are treated as neutral (grey / white / black). */
export const NEUTRAL_CHROMA = 0.15;
const MAX_ANALYSIS_SIDE = 480;

function hueFamilyOf(r: number, g: number, b: number): HueFamily {
  const max = Math.max(r, g, b);
  const chroma = max - Math.min(r, g, b);
  if (chroma < NEUTRAL_CHROMA) return "neutral";
  let hue: number;
  if (max === r) hue = ((g - b) / chroma) % 6;
  else if (max === g) hue = (b - r) / chroma + 2;
  else hue = (r - g) / chroma + 4;
  hue = (hue * 60 + 360) % 360;
  // Red, orange, yellow and magenta-red read as "warm"; green → violet as "cool".
  return hue < 90 || hue >= 300 ? "warm" : "cool";
}

export function analyzeImage(
  img: HTMLImageElement,
  direction: ReadingDirection,
  stepCount = STEP_COUNT,
): ImageAnalysis {
  const scale = Math.min(1, MAX_ANALYSIS_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(stepCount, Math.round(img.naturalWidth * scale));
  const height = Math.max(stepCount, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D canvas is not available in this browser.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height).data;

  const axisLength = direction === "horizontal" ? width : height;
  const crossLength = direction === "horizontal" ? height : width;
  const steps: VisualStep[] = [];

  for (let s = 0; s < stepCount; s++) {
    const start = Math.floor((s * axisLength) / stepCount);
    const end = Math.max(start + 1, Math.floor(((s + 1) * axisLength) / stepCount));

    let lumaSum = 0;
    let lumaSqSum = 0;
    let chromaSum = 0;
    let weightedX = 0;
    const counts: Record<HueFamily, number> = { warm: 0, cool: 0, neutral: 0 };
    let n = 0;

    for (let a = start; a < end; a++) {
      for (let c = 0; c < crossLength; c++) {
        const x = direction === "horizontal" ? a : c;
        const y = direction === "horizontal" ? c : a;
        const i = (y * width + x) * 4;
        const r = pixels[i] / 255;
        const g = pixels[i + 1] / 255;
        const b = pixels[i + 2] / 255;
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

        lumaSum += luma;
        lumaSqSum += luma * luma;
        chromaSum += Math.max(r, g, b) - Math.min(r, g, b);
        weightedX += luma * (x / Math.max(1, width - 1));
        counts[hueFamilyOf(r, g, b)]++;
        n++;
      }
    }

    const luma = lumaSum / n;
    const contrast = Math.sqrt(Math.max(0, lumaSqSum / n - luma * luma));
    const hueShares = {
      warm: counts.warm / n,
      cool: counts.cool / n,
      neutral: counts.neutral / n,
    };
    const hueFamily = (Object.keys(counts) as HueFamily[]).reduce((best, family) =>
      counts[family] > counts[best] ? family : best,
    );

    steps.push({
      index: s,
      position: (s + 0.5) / stepCount,
      luma,
      saturation: chromaSum / n,
      contrast,
      horizontalCentroid: lumaSum > 0 ? weightedX / lumaSum : 0.5,
      hueFamily,
      hueShares,
      variation: s === 0 ? 0 : Math.abs(luma - steps[s - 1].luma),
    });
  }

  return {
    direction,
    steps,
    grid: { width, height },
    stats: {
      minLuma: Math.min(...steps.map((step) => step.luma)),
      maxLuma: Math.max(...steps.map((step) => step.luma)),
      maxContrast: Math.max(...steps.map((step) => step.contrast)),
      maxVariation: Math.max(...steps.map((step) => step.variation)),
    },
  };
}
