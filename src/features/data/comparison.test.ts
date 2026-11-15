import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DataPoint, MonthlySeries, Provenance, Region } from "../../types/data";
import {
  alignByDate,
  checkCompatibility,
  clampPeriod,
  commonYearRange,
  completeYearRange,
  defaultPeriod,
  describeIssue,
  selectSeries,
  summarizeDifference,
} from "./comparison";
import { fixture } from "./power/fixtures/load";
import { monthRange, parseMonthlyResponse } from "./power/powerParse";
import { regions } from "./regions";
import { describeSide } from "./seriesStats";

const region = (id: string) => regions.find((r) => r.id === id)!;
const provenance = (elevation: number | null = null): Provenance => ({
  provider: "NASA POWER",
  product: "test",
  apiVersion: "v",
  sources: ["MERRA2"],
  timeStandard: "LST",
  fillValue: -999,
  gridCell: { latitudeDegrees: 0.5, longitudeDegrees: 0.625, elevationMeters: elevation },
  requestUrl: "https://example",
  retrievedAt: "2026-11-15T00:00:00.000Z",
});
function series(
  r: Region,
  points: DataPoint[],
  overrides: Partial<MonthlySeries> = {},
): MonthlySeries {
  return {
    region: r,
    indicatorId: "T2M",
    measure: { kind: "absolute" },
    unit: "°C",
    sourceUnit: "C",
    frequency: "monthly",
    points,
    provenance: provenance(),
    ...overrides,
  };
}
const months = (start: string, end: string, value: (i: number) => number | null) =>
  monthRange(start, end).map((date, i) => ({ date, value: value(i) }));
const load = (name: Parameters<typeof fixture>[0], id: string) =>
  parseMonthlyResponse(fixture(name), region(id), "https://example", "2026-11-15T00:00:00.000Z");

describe("alignByDate", () => {
  it("24 months against 20 gives 24 rows, the 4 extra months null on the shorter side", () => {
    const a = series(
      region("manaus"),
      months("2023-01", "2024-12", (i) => 20 + i),
    );
    const b = series(
      region("london"),
      months("2023-01", "2024-08", (i) => 10 + i),
    );
    const data = alignByDate(a, b);
    assert.equal(data.rows.length, 24);
    assert.deepEqual(
      data.rows.slice(-4).map((r) => [r.date, r.b, r.difference]),
      [
        ["2024-09", null, null],
        ["2024-10", null, null],
        ["2024-11", null, null],
        ["2024-12", null, null],
      ],
    );
    assert.deepEqual(data.coverage, { months: 24, presentA: 24, presentB: 20, bothPresent: 20 });
    assert.equal(data.period.start, "2023-01");
    assert.equal(data.period.end, "2024-12");
  });

  it("aligns by date, not position, when the series start in different months", () => {
    const a = series(
      region("manaus"),
      months("2024-01", "2024-03", () => 30),
    );
    const b = series(
      region("london"),
      months("2024-02", "2024-04", () => 10),
    );
    const rows = alignByDate(a, b).rows;
    assert.deepEqual(
      rows.map((r) => [r.date, r.a, r.b, r.difference]),
      [
        ["2024-01", 30, null, null],
        ["2024-02", 30, 10, 20],
        ["2024-03", 30, 10, 20],
        ["2024-04", null, 10, null],
      ],
    );
  });

  it("keeps missing months as null and never fills them", () => {
    const a = series(
      region("manaus"),
      months("2024-01", "2024-04", (i) => (i === 1 ? null : 25)),
    );
    const b = series(
      region("london"),
      months("2024-01", "2024-04", () => 5),
    );
    const data = alignByDate(a, b);
    assert.equal(data.rows[1].a, null);
    assert.equal(data.rows[1].difference, null);
    assert.equal(data.coverage.bothPresent, 3);
  });
});

describe("summarizeDifference", () => {
  it("uses only months where both regions have data", () => {
    const a = series(
      region("manaus"),
      months("2024-01", "2024-04", (i) => [30, null, 20, 10][i]),
    );
    const b = series(
      region("london"),
      months("2024-01", "2024-04", (i) => [10, 50, null, 12][i]),
    );
    const diff = summarizeDifference(alignByDate(a, b));
    assert.equal(diff.monthsUsed, 2);
    assert.equal(diff.meanDifference, (20 + -2) / 2);
    assert.deepEqual(diff.largest, { date: "2024-01", difference: 20 });
    assert.deepEqual(diff.smallest, { date: "2024-04", difference: -2 });
    assert.deepEqual(diff.sign, { aHigher: 1, bHigher: 1, equal: 0 });
  });

  it("reports no difference when no month has both values", () => {
    const diff = summarizeDifference({
      rows: [{ date: "2024-01", a: 1, b: null, difference: null }],
    });
    assert.equal(diff.meanDifference, null);
    assert.equal(diff.monthsUsed, 0);
  });
});

describe("checkCompatibility", () => {
  const points = months("2024-01", "2024-12", (i) => i);

  it("accepts two regions with the same indicator, unit, measure and frequency", () => {
    assert.deepEqual(
      checkCompatibility(series(region("manaus"), points), series(region("london"), points)),
      [],
    );
  });

  it("detects the same region twice", () => {
    const kinds = checkCompatibility(
      series(region("manaus"), points),
      series(region("manaus"), points),
    ).map((i) => i.kind);
    assert.ok(kinds.includes("same_region"));
  });

  it("detects different source units", () => {
    const issues = checkCompatibility(
      series(region("manaus"), points),
      series(region("london"), points, { sourceUnit: "K" }),
    );
    assert.deepEqual(issues, [{ kind: "unit_mismatch", a: "C", b: "K" }]);
  });

  it("detects different indicators, measures and frequencies", () => {
    const b = series(region("london"), points, {
      indicatorId: "OTHER" as never,
      frequency: "daily" as never,
      measure: { kind: "anomaly" } as never,
    });
    const kinds = checkCompatibility(series(region("manaus"), points), b).map((i) => i.kind);
    assert.ok(kinds.includes("indicator_mismatch"));
    assert.ok(kinds.includes("measure_mismatch"));
    assert.ok(kinds.includes("frequency_mismatch"));
  });

  it("detects series without a common month", () => {
    const a = series(
      region("manaus"),
      months("2020-01", "2020-12", () => 1),
    );
    const b = series(
      region("london"),
      months("2021-01", "2021-12", () => 1),
    );
    assert.deepEqual(checkCompatibility(a, b), [{ kind: "no_overlap" }]);
  });

  it("detects two points in the same POWER grid cell (recorded responses, FC-08)", () => {
    const sp = load("sao-paulo-t2m-2023-2024", "sao-paulo");
    const neighbour = load("sao-paulo-neighbour-t2m-2023-2024", "sorocaba");
    const issues = checkCompatibility(
      selectSeries(sp, "T2M", 2023, 2024),
      selectSeries(neighbour, "T2M", 2023, 2024),
    );
    assert.deepEqual(issues, [{ kind: "same_grid_cell" }]);
  });

  it("does not confuse neighbouring cells with the same cell (São Paulo × Sorocaba)", () => {
    const issues = checkCompatibility(
      selectSeries(load("sao-paulo-t2m-2023-2024", "sao-paulo"), "T2M", 2023, 2024),
      selectSeries(load("sorocaba-t2m-2023-2024", "sorocaba"), "T2M", 2023, 2024),
    );
    assert.deepEqual(issues, []);
  });

  it("explains every issue in plain words", () => {
    const data = { regionA: region("manaus"), regionB: region("london") };
    assert.match(describeIssue({ kind: "same_grid_cell" }, data), /same NASA POWER grid cell/);
    assert.match(describeIssue({ kind: "no_overlap" }, data), /no month/);
  });
});

describe("selectSeries and periods (recorded responses)", () => {
  const london = load("london-t2m-1981-2026", "london");
  const manaus = load("manaus-t2m-2024-2026", "manaus");

  it("returns every month of the period, with the catalogue unit", () => {
    const s = selectSeries(london, "T2M", 2005, 2024);
    assert.equal(s.points.length, 240);
    assert.equal(s.points[0].date, "2005-01");
    assert.equal(s.unit, "°C");
    assert.equal(s.sourceUnit, "C");
  });

  it("marks months outside the data as null instead of inventing them", () => {
    const s = selectSeries(manaus, "T2M", 2026, 2026);
    assert.equal(s.points.length, 12);
    assert.equal(s.points[9].value, null); // 2026-10: -999 in the response
    assert.equal(s.points[11].value, null); // 2026-12: not in the response
  });

  it("derives complete years from the data, excluding the unfinished current year", () => {
    assert.deepEqual(completeYearRange(london, "T2M"), { first: 1981, last: 2025 });
    assert.deepEqual(completeYearRange(manaus, "T2M"), { first: 2024, last: 2025 });
    assert.deepEqual(commonYearRange(london, manaus, "T2M"), { first: 2024, last: 2025 });
  });

  it("defaults to the last 20 complete years and clamps periods into the range", () => {
    assert.deepEqual(defaultPeriod({ first: 1981, last: 2025 }), {
      startYear: 2006,
      endYear: 2025,
    });
    assert.deepEqual(defaultPeriod({ first: 2024, last: 2025 }), {
      startYear: 2024,
      endYear: 2025,
    });
    assert.deepEqual(clampPeriod({ startYear: 1970, endYear: 2030 }, { first: 1981, last: 2025 }), {
      startYear: 1981,
      endYear: 2025,
    });
  });

  it("passes a basic climate sanity check: London is warmest in June–August", () => {
    const rows = alignByDate(
      selectSeries(london, "T2M", 2006, 2025),
      selectSeries(london, "T2M", 2006, 2025),
    ).rows;
    const monthly = Array.from({ length: 12 }, (_, m) => {
      const values = rows.filter((r) => Number(r.date.slice(5)) === m + 1).map((r) => r.a!);
      return values.reduce((a, b) => a + b, 0) / values.length;
    });
    const warmest = monthly.indexOf(Math.max(...monthly)) + 1;
    const coldest = monthly.indexOf(Math.min(...monthly)) + 1;
    assert.ok([6, 7, 8].includes(warmest), `warmest month ${warmest}`);
    assert.ok([12, 1, 2].includes(coldest), `coldest month ${coldest}`);
  });
});

describe("describeSide", () => {
  it("leaves missing months out and averages complete years only", () => {
    const rows = monthRange("2023-01", "2024-12").map((date, i) => ({
      date,
      a: i === 14 ? null : i < 12 ? 10 : 20, // 2024 has one missing month
      b: 0,
      difference: null,
    }));
    const stats = describeSide(rows, "a");
    assert.equal(stats.present, 23);
    assert.equal(stats.missing, 1);
    assert.deepEqual(stats.firstYear, { year: "2023", mean: 10 });
    assert.equal(stats.lastYear, null); // 2024 is incomplete, so it is not compared with 2023
    assert.deepEqual(stats.maxPoint, { date: "2024-01", value: 20 });
  });
});
