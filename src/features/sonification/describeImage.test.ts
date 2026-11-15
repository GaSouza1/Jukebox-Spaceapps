import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeMeasurements, narrationScript, summarizeAnalysis } from "./describeImage";
import type { HueFamily, ImageAnalysis, VisualStep } from "./engine/imageAnalyzer";

/** 96 slices, bright and warm at the top, dark and cool at the bottom. */
function gradientAnalysis(): ImageAnalysis {
  const steps: VisualStep[] = Array.from({ length: 96 }, (_, index) => {
    const luma = 0.9 - (0.8 * index) / 95;
    const hueFamily: HueFamily = index < 48 ? "warm" : "cool";
    return {
      index,
      position: (index + 0.5) / 96,
      luma,
      saturation: 0.5,
      contrast: index < 32 ? 0.05 : index < 64 ? 0.25 : 0.1,
      horizontalCentroid: 0.3,
      hueFamily,
      hueShares: {
        warm: hueFamily === "warm" ? 1 : 0,
        cool: hueFamily === "cool" ? 1 : 0,
        neutral: 0,
      },
      variation: index ? 0.8 / 95 : 0,
    };
  });
  return {
    direction: "vertical",
    steps,
    grid: { width: 96, height: 96 },
    stats: { minLuma: 0.1, maxLuma: 0.9, maxContrast: 0.25, maxVariation: 0.8 / 95 },
  };
}

const base = {
  position: 2,
  count: 3,
  name: "upload.png",
  analysis: gradientAnalysis(),
  failed: false,
  direction: "vertical" as const,
};
const noDescription = { alt: "", humanText: null, userText: null };
/** Words the app must never say on its own: it does not recognise content. */
const SEMANTIC =
  /\b(forest|city|cities|river|ocean|sea|fire|ice|cloud|land|desert|vegetation)s?\b/i;

describe("summarizeAnalysis", () => {
  it("measures the whole image from the slices", () => {
    const summary = summarizeAnalysis(gradientAnalysis());
    assert.ok(Math.abs(summary.meanLuma - 0.5) < 1e-9);
    assert.equal(summary.brightestThird, 0);
    assert.equal(summary.darkestThird, 2);
    assert.equal(summary.mostContrastThird, 1);
    assert.equal(summary.uniform, false);
    assert.ok(Math.abs(summary.horizontalCentre - 0.3) < 1e-9);
    assert.ok(Math.abs(summary.hueShares.warm - 0.5) < 1e-9);
  });
});

describe("narrationScript", () => {
  it("identifies the image and its position", () => {
    assert.equal(
      narrationScript({ ...base, description: noDescription })[0],
      "Image 2 of 3: upload.png.",
    );
  });

  it("without a description, says what is measured and that nothing is recognised", () => {
    const text = narrationScript({ ...base, description: noDescription }).join(" ");
    assert.match(text, /no validated description/);
    assert.match(text, /does not automatically identify objects or geographical features/);
    assert.match(text, /mean brightness of 0\.50/);
    assert.match(text, /50 percent warm hues/);
    assert.match(text, /brightest part is the top third, and the darkest is the bottom third/);
    assert.match(text, /left of centre/);
    assert.doesNotMatch(text, SEMANTIC);
  });

  it("uses the team description first and attributes it", () => {
    const text = narrationScript({
      ...base,
      description: { alt: "", humanText: "Sea ice along the bottom", userText: "ignored" },
    }).join(" ");
    assert.match(text, /Description written by the project team: Sea ice along the bottom\./);
    assert.doesNotMatch(text, /ignored/);
    assert.match(text, /not from the description/);
  });

  it("marks the uploader's description as unverified", () => {
    const text = narrationScript({
      ...base,
      description: { alt: "", humanText: null, userText: "My garden at noon" },
    }).join(" ");
    assert.match(
      text,
      /provided by the person who added this image\. The app has not verified it\./,
    );
    assert.match(text, /My garden at noon\./);
    assert.doesNotMatch(text, /no validated description/);
  });

  it("treats a blank uploader description as no description", () => {
    const text = narrationScript({
      ...base,
      description: { alt: "", humanText: null, userText: "   " },
    }).join(" ");
    assert.match(text, /no validated description/);
  });

  it("says when an image could not be analysed", () => {
    const lines = narrationScript({
      ...base,
      analysis: null,
      failed: true,
      description: noDescription,
    });
    assert.match(lines.at(-1)!, /could not be analysed/);
  });

  it("follows the reading direction in its wording", () => {
    const analysis = { ...gradientAnalysis(), direction: "horizontal" as const };
    assert.match(describeMeasurements(analysis).join(" "), /left third/);
  });
});
