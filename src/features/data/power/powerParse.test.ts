import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { regions } from "../regions";
import { fixture } from "./fixtures/load";
import {
  monthRange,
  parseErrorMessages,
  parseMonthlyResponse,
  PowerParseError,
} from "./powerParse";

const london = regions.find((r) => r.id === "london")!;
const manaus = regions.find((r) => r.id === "manaus")!;
const parse = (json: unknown, region = london) =>
  parseMonthlyResponse(json, region, "https://example/power", "2026-11-15T12:00:00.000Z");

describe("parseMonthlyResponse (recorded responses)", () => {
  it("reads every month of a full history, without the annual YYYY13 keys", () => {
    const { points } = parse(fixture("london-t2m-1981-2026")).parameters.T2M;
    assert.equal(points[0].date, "1981-01");
    assert.ok(points.every((p) => /^\d{4}-(0[1-9]|1[0-2])$/.test(p.date)));
    // 1981-01 .. 2026-11 inclusive, one entry per month, no "13".
    assert.equal(points.length, 45 * 12 + 11);
    assert.equal(points.at(-1)!.date, "2026-11");
  });

  it("turns the fill value -999 into null (months not yet published)", () => {
    const { points } = parse(fixture("manaus-t2m-2024-2026"), manaus).parameters.T2M;
    const byDate = Object.fromEntries(points.map((p) => [p.date, p.value]));
    assert.equal(byDate["2026-09"], 32.77);
    assert.equal(byDate["2026-10"], null);
    assert.equal(byDate["2026-11"], null);
    assert.ok(points.every((p) => p.value !== -999));
  });

  it("accepts a current year without the annual key (FC-07)", () => {
    const json = fixture("manaus-t2m-2024-2026") as { properties: { parameter: { T2M: object } } };
    assert.ok(!("202613" in json.properties.parameter.T2M));
    const { points } = parse(json, manaus).parameters.T2M;
    assert.equal(points.filter((p) => p.date.startsWith("2026")).length, 11);
  });

  it("keeps the declared unit and long name for checking, and the provenance", () => {
    const dataset = parse(fixture("london-t2m-1981-2026"));
    assert.equal(dataset.parameters.T2M.unitSource, "C");
    assert.equal(dataset.parameters.T2M.longName, "Temperature at 2 Meters");
    const p = dataset.provenance;
    assert.equal(p.provider, "NASA POWER");
    assert.equal(p.apiVersion, "v2.10.0");
    assert.deepEqual(p.sources.includes("MERRA2"), true);
    assert.equal(p.fillValue, -999);
    assert.equal(p.timeStandard, "LST");
    assert.equal(p.gridCell?.latitudeDegrees, 0.5);
    assert.equal(p.gridCell?.longitudeDegrees, 0.625);
    assert.equal(typeof p.gridCell?.elevationMeters, "number");
    assert.equal(p.retrievedAt, "2026-11-15T12:00:00.000Z");
  });
});

describe("parseMonthlyResponse (edge cases)", () => {
  const response = (values: Record<string, number>) => ({
    geometry: { coordinates: [0, 0, 10] },
    header: { fill_value: -999, sources: ["MERRA2"], api: { version: "v" } },
    parameters: { T2M: { units: "C", longname: "Temperature at 2 Meters" } },
    properties: { parameter: { T2M: values } },
  });

  it("fills months missing from the response with null, so dates have no holes", () => {
    const { points } = parse(response({ "202001": 1, "202004": 4, "202013": 9 })).parameters.T2M;
    assert.deepEqual(points, [
      { date: "2020-01", value: 1 },
      { date: "2020-02", value: null },
      { date: "2020-03", value: null },
      { date: "2020-04", value: 4 },
    ]);
  });

  it("rejects responses without values", () => {
    assert.throws(() => parse(null), PowerParseError);
    assert.throws(() => parse({ header: {} }), PowerParseError);
    assert.throws(
      () => parse({ header: {}, properties: { parameter: { T2M: 3 } } }),
      PowerParseError,
    );
  });
});

describe("parseErrorMessages (recorded 422 responses)", () => {
  it("reads the `messages` shape", () => {
    assert.deepEqual(parseErrorMessages(fixture("error-422-bad-parameter")), [
      "One of your parameters is incorrect: FOO.",
    ]);
  });
  it("reads the `detail` shape", () => {
    const [message] = parseErrorMessages(fixture("error-422-missing-community"));
    assert.match(message, /Field required/);
    assert.match(message, /community/);
  });
});

describe("monthRange", () => {
  it("crosses year boundaries", () => {
    assert.deepEqual(monthRange("2023-11", "2024-02"), [
      "2023-11",
      "2023-12",
      "2024-01",
      "2024-02",
    ]);
  });
});
