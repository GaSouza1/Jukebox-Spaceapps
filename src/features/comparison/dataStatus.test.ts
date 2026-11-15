import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alignByDate, selectSeries } from "../data/comparison";
import { fixture } from "../data/power/fixtures/load";
import { parseMonthlyResponse } from "../data/power/powerParse";
import { regions } from "../data/regions";
import {
  announcementFor,
  errorText,
  loadingText,
  missingText,
  readyText,
  unavailableReason,
  type DataStatusState,
} from "./dataStatus";

const region = (id: string) => regions.find((r) => r.id === id)!;
const load = (name: Parameters<typeof fixture>[0], id: string) =>
  parseMonthlyResponse(fixture(name), region(id), "https://example", "2026-11-15T00:00:00.000Z");
const data = alignByDate(
  selectSeries(load("manaus-t2m-2024-2026", "manaus"), "T2M", 2024, 2026),
  selectSeries(load("london-t2m-1981-2026", "london"), "T2M", 2024, 2026),
);
const loading: DataStatusState = {
  status: "loading",
  loading: [region("manaus"), region("london")],
};
const ready: DataStatusState = { status: "ready", data };
const failed: DataStatusState = {
  status: "error",
  error: { kind: "timeout", message: "NASA POWER did not answer within 20 seconds." },
  failed: [region("london")],
};

describe("data status texts", () => {
  it("names the regions while loading", () => {
    assert.equal(loadingText(loading.loading), "Loading NASA POWER data for Manaus and London…");
  });
  it("summarises the result, with the missing months of each region", () => {
    assert.match(readyText(data), /36 months, January 2024 to December 2026/);
    assert.match(
      missingText(data),
      /Manaus has 3 months without data; London has [0-9]+ months? without data\./,
    );
  });
  it("explains errors with the region and the cause", () => {
    assert.equal(
      errorText(failed as Extract<DataStatusState, { status: "error" }>),
      "The data for London could not be loaded. NASA POWER did not answer within 20 seconds.",
    );
  });
  it("explains why Play is unavailable", () => {
    assert.match(unavailableReason(loading)!, /still loading/);
    assert.match(unavailableReason(failed)!, /could not be loaded/);
    assert.equal(unavailableReason(ready), null);
    const sameCell: DataStatusState = {
      status: "ready",
      data: { ...data, issues: [{ kind: "same_grid_cell" }] },
    };
    assert.match(unavailableReason(sameCell)!, /same NASA POWER grid cell/);
  });
});

describe("announcementFor (one message per change)", () => {
  it("announces loading once, then the result once", () => {
    assert.equal(announcementFor(null, loading), loadingText(loading.loading));
    assert.equal(announcementFor("loading", loading), null);
    assert.equal(announcementFor("loading", ready), readyText(data));
  });
  it("says nothing extra for data already in memory, or for errors (the alert speaks)", () => {
    assert.equal(announcementFor("ready", ready), null);
    assert.equal(announcementFor(null, ready), null);
    assert.equal(announcementFor("loading", failed), null);
  });
});
