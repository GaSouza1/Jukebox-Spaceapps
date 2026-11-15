import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lumaToFrequency } from "./dataMapper";
import type { ImageAnalysis, VisualStep } from "./imageAnalyzer";
import { mapAnalysis } from "./dataMapper";
import { IMAGE_STEP_SECONDS, IMAGE_VOICE, imageToScore } from "./imageScore";
import { bpmFor, clampStep, normToFrequency, PITCH_FLOOR_HZ, timbresOf } from "./score";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

describe("normToFrequency", () => {
  it("maps 0 to C4 and 1 to C6, two octaves", () => {
    close(normToFrequency(0), 261.63);
    close(normToFrequency(1), 261.63 * 4);
    close(normToFrequency(0.5), 261.63 * 2);
  });
  it("is linear in octaves: equal steps give equal frequency ratios", () => {
    const ratio = (x: number) => normToFrequency(x + 0.1) / normToFrequency(x);
    close(ratio(0.1), ratio(0.6), 1e-12);
  });
  it("clamps outside 0..1", () => {
    close(normToFrequency(-1), PITCH_FLOOR_HZ);
    close(normToFrequency(2), PITCH_FLOOR_HZ * 4);
  });
  it("is what the image mapping uses", () => {
    for (const luma of [0, 0.25, 0.73, 1]) close(lumaToFrequency(luma), normToFrequency(luma));
  });
});

describe("bpmFor and clampStep", () => {
  it("keeps the image tempo (0.3 s per step = 100 BPM) and gives 60 BPM for 0.5 s", () => {
    close(bpmFor(IMAGE_STEP_SECONDS), 100);
    close(bpmFor(0.5), 60);
    close(bpmFor(0.5, 2), 120);
  });
  it("keeps a requested step inside the score", () => {
    assert.equal(clampStep({ stepCount: 10 }, -3), 0);
    assert.equal(clampStep({ stepCount: 10 }, 4.4), 4);
    assert.equal(clampStep({ stepCount: 10 }, 99), 9);
  });
});

function step(index: number, overrides: Partial<VisualStep>): VisualStep {
  return {
    index,
    position: (index + 0.5) / 4,
    luma: 0.5,
    saturation: 0.3,
    contrast: 0.1,
    horizontalCentroid: 0.5,
    hueFamily: "neutral",
    hueShares: { warm: 0, cool: 0, neutral: 1 },
    variation: 0,
    ...overrides,
  };
}
const analysis: ImageAnalysis = {
  direction: "vertical",
  grid: { width: 96, height: 96 },
  steps: [
    step(0, { luma: 0.1, contrast: 0.05, horizontalCentroid: 0.2, hueFamily: "warm" }),
    step(1, { luma: 0.4, contrast: 0.2, horizontalCentroid: 0.9, hueFamily: "cool" }),
    step(2, { luma: 0.95, contrast: 0.12, horizontalCentroid: 0.5, hueFamily: "neutral" }),
    step(3, { luma: 0.6, contrast: 0, horizontalCentroid: 0.1, hueFamily: "warm" }),
  ],
  stats: { minLuma: 0.1, maxLuma: 0.95, maxContrast: 0.2, maxVariation: 0.55 },
};

describe("imageToScore (equivalence with the previous image mapping)", () => {
  const score = imageToScore(analysis, 0.42);
  const events = mapAnalysis(analysis);

  it("has one step per slice, the image tempo and the cinematic energy", () => {
    assert.equal(score.stepCount, analysis.steps.length);
    assert.equal(score.stepSeconds, IMAGE_STEP_SECONDS);
    assert.deepEqual(score.cinematic, { energy: 0.42 });
  });

  it("plays every slice on one voice with exactly the frequency, velocity, pan and timbre of mapAnalysis", () => {
    assert.equal(score.voices.length, 1);
    const [voice] = score.voices;
    assert.equal(voice.id, IMAGE_VOICE);
    assert.deepEqual(
      voice.notes,
      events.map((e) => ({
        frequency: e.frequency,
        velocity: e.velocity,
        pan: e.pan,
        timbre: e.timbre,
      })),
    );
  });

  it("lists every timbre the voice needs, so instruments exist before playback", () => {
    assert.deepEqual(timbresOf(score.voices[0]).sort(), ["bell", "glass", "piano"]);
  });
});
