import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alignByDate, selectSeries } from "../data/comparison";
import { fixture } from "../data/power/fixtures/load";
import { parseMonthlyResponse } from "../data/power/powerParse";
import { regions } from "../data/regions";
import { describeComparisonSonification } from "./describeSonification";
import { comparisonScale, comparisonToScore, valueToFrequency } from "./engine/comparisonScore";

const load = (name: Parameters<typeof fixture>[0], id: string) =>
  parseMonthlyResponse(
    fixture(name),
    regions.find((r) => r.id === id)!,
    "https://example",
    "2026-11-15T12:00:00.000Z",
  );
const london = load("london-t2m-1981-2026", "london");
const manaus = load("manaus-t2m-2024-2026", "manaus");
// 2026 has unpublished months for Manaus (null) and London's real values.
const data = alignByDate(
  selectSeries(manaus, "T2M", 2024, 2026),
  selectSeries(london, "T2M", 2024, 2026),
);
const text = (id: string, speed = 1) =>
  describeComparisonSonification(data, speed, "both").facts.find((f) => f.id === id)!.text;

describe("describeComparisonSonification (recorded NASA POWER data)", () => {
  it("states the same lowest and highest values and frequencies the score uses", () => {
    const scale = comparisonScale(data.rows);
    const pitch = text("pitch");
    assert.ok(scale.domain);
    assert.match(
      pitch,
      new RegExp(`${Math.round(valueToFrequency(scale.domain!.min, scale))} hertz`),
    );
    assert.match(pitch, new RegExp(`\\(${scale.domain!.min} degrees Celsius\\)`));
    assert.match(
      pitch,
      new RegExp(`${Math.round(valueToFrequency(scale.domain!.max, scale))} hertz`),
    );
    assert.match(pitch, /262 hertz/);
    assert.match(pitch, /1047 hertz/);
    assert.match(pitch, /equal intervals/);
    // The score really plays those frequencies.
    const notes = comparisonToScore(data, "both")
      .voices.flatMap((v) => v.notes)
      .filter(Boolean);
    assert.equal(Math.round(Math.min(...notes.map((n) => n!.frequency))), 262);
    assert.equal(Math.round(Math.max(...notes.map((n) => n!.frequency))), 1047);
  });

  it("explains missing months and the silence convention", () => {
    const missing = text("missing");
    assert.match(missing, /Manaus [1-9]/);
    assert.match(missing, /silent/);
    assert.match(missing, /not a low value/);
  });

  it("says the unit in words and names the real source, never synthetic data", () => {
    const all = describeComparisonSonification(data, 1, "both")
      .facts.map((f) => f.text)
      .join(" ");
    assert.match(all, /degrees Celsius/);
    assert.match(text("data"), /NASA POWER/);
    assert.match(text("data"), /MERRA-2/);
    assert.match(text("data"), /v2\.10\.0/);
    assert.match(text("data"), /15 November 2026/);
    assert.doesNotMatch(all, /synthetic/i);
  });

  it("describes the grid cell, the period and a duration that follows the speed", () => {
    assert.match(text("regions"), /grid cell of about 56 by/);
    assert.match(text("period"), /January 2024 to December 2026: 36 months/);
    assert.match(text("period"), /one month every 0\.5 seconds, about 18 seconds/);
    assert.match(text("period", 2), /one month every 0\.25 seconds, about 9 seconds/);
  });

  it("names the playback mode", () => {
    const facts = describeComparisonSonification(data, 1, "b").facts;
    assert.match(facts[0].text, /Region B, London, on its own/);
  });
});
