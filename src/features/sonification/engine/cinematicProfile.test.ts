import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cinematicProfile, PROFILE_THRESHOLDS } from "./cinematicProfile";
import type { VisualStep } from "./imageAnalyzer";

/** An image whose 96 slices have the given luma (a function of position) and contrast. */
function image(luma: (i: number) => number, contrast = 0.05) {
  const steps = Array.from({ length: 96 }, (_, i) => ({ luma: luma(i), contrast }) as VisualStep);
  return { steps };
}
const flat = (luma: number, contrast?: number) => image(() => luma, contrast);

describe("cinematicProfile", () => {
  it("dark images are contemplative, bright images energetic", () => {
    assert.equal(cinematicProfile(flat(0.1)).energy, 0);
    assert.equal(cinematicProfile(flat(0.1)).label, "contemplative");
    assert.equal(cinematicProfile(flat(0.9)).energy, 1);
    assert.equal(cinematicProfile(flat(0.9)).label, "energetic");
  });

  it("intermediate images blend the two", () => {
    const mid = cinematicProfile(flat(0.45));
    assert.ok(mid.energy > 0.15 && mid.energy < 0.85, String(mid.energy));
    assert.equal(mid.label, "blended");
  });

  it("is monotonic and continuous in brightness: no abrupt switch", () => {
    let previous = -1;
    let blended = 0;
    for (let i = 0; i <= 100; i++) {
      const profile = cinematicProfile(flat(i / 100));
      assert.ok(profile.energy >= previous - 1e-12, `not monotonic at ${i / 100}`);
      if (previous >= 0) assert.ok(profile.energy - previous < 0.08, `jump at ${i / 100}`);
      if (profile.label === "blended") blended++;
      previous = profile.energy;
    }
    // The blend spans a real range of brightness, not a switch.
    assert.ok(blended >= 15, `blended over only ${blended} % of the range`);
  });

  it("uses the luminosity distribution, not only the mean", () => {
    // Same mean (0.45): half black / half white vs. evenly grey.
    const split = cinematicProfile(image((i) => (i < 48 ? 0 : 0.9)));
    const even = cinematicProfile(flat(0.45));
    assert.ok(Math.abs(split.inputs.meanLuma - even.inputs.meanLuma) < 1e-9);
    assert.ok(split.inputs.brightShare > even.inputs.brightShare);
    assert.ok(split.energy > even.energy);
  });

  it("contrast nudges towards energetic, with a small weight", () => {
    const calm = cinematicProfile(flat(0.45, 0));
    const lively = cinematicProfile(flat(0.45, 0.25));
    assert.ok(lively.energy > calm.energy);
    assert.ok(lively.score - calm.score <= 0.15 + 1e-9);
  });

  it("thresholds are configurable", () => {
    const strict = { contemplative: 0.5, energetic: 0.9 };
    assert.ok(cinematicProfile(flat(0.6), strict).energy < cinematicProfile(flat(0.6)).energy);
    assert.deepEqual(PROFILE_THRESHOLDS, { contemplative: 0.1, energetic: 0.8 });
  });

  it("is deterministic", () => {
    assert.deepEqual(cinematicProfile(flat(0.37, 0.1)), cinematicProfile(flat(0.37, 0.1)));
  });
});
