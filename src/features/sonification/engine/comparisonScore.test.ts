import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ComparisonRow } from "../../data/comparison";
import {
  COMPARISON_STEP_SECONDS,
  COMPARISON_VELOCITY,
  comparisonScale,
  comparisonToScore,
  REGION_VOICES,
  valueToFrequency,
} from "./comparisonScore";

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const row = (date: string, a: number | null, b: number | null): ComparisonRow => ({
  date,
  a,
  b,
  difference: a !== null && b !== null ? a - b : null,
});
const rows = [
  row("2024-01", 10, 30),
  row("2024-02", 20, null),
  row("2024-03", null, 25),
  row("2024-04", 30, 10),
];

describe("comparisonScale", () => {
  it("shares one domain between both regions, from present values only", () => {
    const scale = comparisonScale(rows);
    assert.deepEqual(scale.domain, { min: 10, max: 30 });
    assert.equal(scale.flat, false);
  });
  it("keeps the frequency between C4 and C6, lowest value at C4 and highest at C6", () => {
    const scale = comparisonScale(rows);
    close(valueToFrequency(10, scale), 261.63);
    close(valueToFrequency(30, scale), 1046.52);
  });
  it("gives equal intervals for equal differences, wherever they are in the range", () => {
    const scale = comparisonScale(rows);
    close(
      valueToFrequency(15, scale) / valueToFrequency(10, scale),
      valueToFrequency(30, scale) / valueToFrequency(25, scale),
    );
  });
  it("plays a flat comparison at the middle of the range instead of stretching noise", () => {
    const scale = comparisonScale([row("2024-01", 5, 5.01)]);
    assert.equal(scale.flat, true);
    close(valueToFrequency(5, scale), 261.63 * 2);
  });
});

describe("comparisonToScore", () => {
  it("has one step per month at 0.5 s, two voices and no cinematic layer", () => {
    const score = comparisonToScore({ rows }, "both");
    assert.equal(score.stepCount, 4);
    assert.equal(score.stepSeconds, COMPARISON_STEP_SECONDS);
    assert.deepEqual(
      score.voices.map((v) => v.id),
      ["a", "b"],
    );
    assert.equal(score.cinematic, null);
  });

  it("identifies the regions by timbre and stereo place: A sine left, B triangle right", () => {
    const [a, b] = comparisonToScore({ rows }, "both").voices;
    assert.equal(a.timbre, "glass");
    assert.equal(b.timbre, "triangle");
    assert.equal(a.pan, REGION_VOICES.a.pan);
    assert.ok(a.pan < 0 && b.pan > 0);
    assert.ok(a.notes.every((n) => !n || (n.pan === undefined && n.timbre === undefined)));
  });

  it("makes the same value sound at the same pitch in both regions", () => {
    const [a, b] = comparisonToScore({ rows }, "both").voices;
    assert.equal(a.notes[0]!.frequency, b.notes[3]!.frequency); // both 10
    assert.equal(a.notes[3]!.frequency, b.notes[0]!.frequency); // both 30
  });

  it("is silent where a value is missing", () => {
    const [a, b] = comparisonToScore({ rows }, "both").voices;
    assert.equal(a.notes[2], null);
    assert.equal(b.notes[1], null);
  });

  it("keeps loudness constant: it carries no data", () => {
    const notes = comparisonToScore({ rows }, "both")
      .voices.flatMap((v) => v.notes)
      .filter(Boolean);
    assert.ok(notes.every((n) => n!.velocity === COMPARISON_VELOCITY));
  });

  it("plays only Region A, centred, in mode a (and the scale does not change)", () => {
    const both = comparisonToScore({ rows }, "both");
    const [a, b] = comparisonToScore({ rows }, "a").voices;
    assert.equal(a.pan, 0);
    assert.ok(b.notes.every((n) => n === null));
    assert.deepEqual(a.notes, both.voices[0].notes);
  });

  it("plays only Region B, centred, in mode b", () => {
    const [a, b] = comparisonToScore({ rows }, "b").voices;
    assert.equal(b.pan, 0);
    assert.ok(a.notes.every((n) => n === null));
    assert.equal(b.notes.filter(Boolean).length, 3);
  });
});
