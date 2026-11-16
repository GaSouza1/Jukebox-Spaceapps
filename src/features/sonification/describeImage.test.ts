import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  describeGenerated,
  describeTemperatureRegions,
  describeProfile,
  narrationScript,
  summarizeAnalysis,
  temperatureBand,
  visualHeat,
} from "./describeImage";
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

  it("without a description, says nothing is recognised and names temperature regions", () => {
    const text = narrationScript({ ...base, description: noDescription }).join(" ");
    assert.match(text, /No description is available\. The app does not identify objects or places/);
    assert.match(text, /High temperature: top third\./);
    assert.match(text, /Low temperature: bottom third\./);
    assert.match(text, /Estimated from the image, not measured\./);
    assert.doesNotMatch(text, SEMANTIC);
  });

  it("never names colours, brightness or contrast", () => {
    const text = narrationScript({ ...base, description: noDescription }).join(" ");
    assert.doesNotMatch(
      text,
      /\b(warm|cool|red|orange|yellow|green|blue|cyan|colou?rs?|brightness|contrast)\b/i,
    );
  });

  it("stays short", () => {
    const lines = narrationScript({ ...base, description: noDescription });
    assert.ok(lines.length <= 6);
    assert.ok(lines.join(" ").split(/\s+/).length <= 60);
  });

  it("uses the team description first and attributes it", () => {
    const text = narrationScript({
      ...base,
      description: { alt: "", humanText: "Sea ice along the bottom", userText: "ignored" },
    }).join(" ");
    assert.match(text, /Team description: Sea ice along the bottom\./);
    assert.doesNotMatch(text, /ignored/);
  });

  it("marks the uploader's description as unverified", () => {
    const text = narrationScript({
      ...base,
      description: { alt: "", humanText: null, userText: "My garden at noon" },
    }).join(" ");
    assert.match(text, /Description by the uploader, not verified: My garden at noon\./);
    assert.doesNotMatch(text, /No description is available/);
  });

  it("treats a blank uploader description as no description", () => {
    const text = narrationScript({
      ...base,
      description: { alt: "", humanText: null, userText: "   " },
    }).join(" ");
    assert.match(text, /No description is available/);
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
    assert.match(describeTemperatureRegions(analysis).join(" "), /High temperature: left third\./);
    assert.match(describeTemperatureRegions(analysis).join(" "), /Low temperature: right third\./);
  });
});

describe("visual temperature", () => {
  const warm = { warm: 1, cool: 0, neutral: 0 };
  const cool = { warm: 0, cool: 1, neutral: 0 };
  const neutral = { warm: 0, cool: 0, neutral: 1 };

  it("rates warm colours hotter than cool ones, all else equal", () => {
    assert.ok(visualHeat(warm, 0.5, 0.5) > visualHeat(cool, 0.5, 0.5));
  });

  it("rates strong colours hotter than weak ones, all else equal", () => {
    assert.ok(visualHeat(cool, 0.5, 0.9) > visualHeat(cool, 0.05, 0.2));
    assert.ok(visualHeat(warm, 0.5, 0.9) > visualHeat(warm, 0.05, 0.2));
  });

  it("puts vivid bright warm colours at the top and pale dark cool ones at the bottom", () => {
    assert.equal(temperatureBand(visualHeat(warm, 0.6, 0.9)), "high");
    assert.equal(temperatureBand(visualHeat(cool, 0.05, 0.1)), "low");
  });

  it("treats an image with no coloured pixels as weak, not as warm", () => {
    assert.ok(visualHeat(neutral, 0, 0.1) < 0.4);
  });

  it("stays between 0 and 1", () => {
    for (const shares of [warm, cool, neutral]) {
      for (const [chroma, luma] of [
        [0, 0],
        [1, 1],
        [0.5, 0.5],
      ]) {
        const heat = visualHeat(shares, chroma, luma);
        assert.ok(heat >= 0 && heat <= 1);
      }
    }
  });

  it("names the band from the score", () => {
    assert.equal(temperatureBand(0.1), "low");
    assert.equal(temperatureBand(0.3), "moderately low");
    assert.equal(temperatureBand(0.5), "intermediate");
    assert.equal(temperatureBand(0.7), "moderately high");
    assert.equal(temperatureBand(0.95), "high");
  });

  it("locates the hottest and coolest thirds in the summary", () => {
    const summary = summarizeAnalysis(gradientAnalysis());
    assert.equal(summary.hottestThird, 0);
    assert.equal(summary.coolestThird, 2);
    assert.equal(summary.heatUniform, false);
    assert.ok(summary.heat > 0.5 && summary.heat < 0.8);
  });

  it("names only the high and low regions", () => {
    assert.deepEqual(describeTemperatureRegions(gradientAnalysis()), [
      "High temperature: top third.",
      "Low temperature: bottom third.",
      "Estimated from the image, not measured.",
    ]);
  });

  it("says when no region stands out", () => {
    const mid = gradientAnalysis();
    mid.steps = mid.steps.map((step) => ({
      ...step,
      luma: 0.5,
      saturation: 0.25,
      hueShares: { warm: 0.5, cool: 0.5, neutral: 0 },
    }));
    assert.equal(
      describeTemperatureRegions(mid)[0],
      "No region stands out as high or low temperature.",
    );
  });

  it("says the whole image when every third is high", () => {
    const hot = gradientAnalysis();
    hot.steps = hot.steps.map((step) => ({
      ...step,
      luma: 0.9,
      hueShares: { warm: 1, cool: 0, neutral: 0 },
    }));
    assert.equal(describeTemperatureRegions(hot)[0], "High temperature: the whole image.");
  });

  it("adds a visual temperature to every part of the text profile", () => {
    const lines = describeProfile(gradientAnalysis());
    assert.equal(lines.length, 6);
    for (const line of lines)
      assert.match(line, /visual temperature (low|moderately|intermediate|high)/);
    assert.match(lines[0], /visual temperature high|visual temperature moderately high/);
    assert.match(lines[5], /visual temperature (low|moderately low)/);
  });
});

describe("describeGenerated", () => {
  it("is exactly what the narration speaks after the description", () => {
    const lines = narrationScript({ ...base, description: noDescription });
    const generated = describeGenerated(base.analysis, base.direction);
    assert.deepEqual(lines.slice(-generated.length), generated);
  });
});
