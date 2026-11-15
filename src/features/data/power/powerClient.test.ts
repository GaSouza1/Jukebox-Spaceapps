import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { regions } from "../regions";
import { fixture } from "./fixtures/load";
import {
  clearPowerCache,
  loadRegionDataset,
  monthlyUrl,
  peekRegionDataset,
  PowerRequestError,
  requestMonthly,
} from "./powerClient";

const london = regions.find((r) => r.id === "london")!;
const manaus = regions.find((r) => r.id === "manaus")!;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function fakeFetch(handler: (url: string) => Promise<Response>) {
  const calls: string[] = [];
  const impl = ((input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    return new Promise<Response>((resolve, reject) => {
      init?.signal?.addEventListener("abort", () =>
        reject(new DOMException("aborted", "AbortError")),
      );
      handler(url).then(resolve, reject);
    });
  }) as typeof fetch;
  return { impl, calls };
}

const errorKind = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof PowerRequestError);
    return error.detail;
  }
  assert.fail("expected a rejection");
};

describe("monthlyUrl", () => {
  it("asks for the whole history of the catalogued parameters at the region's point", () => {
    const url = new URL(monthlyUrl(london, 2026));
    assert.equal(
      url.origin + url.pathname,
      "https://power.larc.nasa.gov/api/temporal/monthly/point",
    );
    assert.equal(url.searchParams.get("parameters"), "T2M");
    assert.equal(url.searchParams.get("community"), "AG");
    assert.equal(url.searchParams.get("latitude"), "51.507");
    assert.equal(url.searchParams.get("longitude"), "-0.128");
    assert.equal(url.searchParams.get("start"), "1981");
    assert.equal(url.searchParams.get("end"), "2026");
    assert.equal(url.searchParams.get("format"), "JSON");
  });
});

describe("requestMonthly", () => {
  it("parses a successful response", async () => {
    const { impl } = fakeFetch(async () => jsonResponse(fixture("london-t2m-1981-2026")));
    const dataset = await requestMonthly(london, 2026, { fetchImpl: impl });
    assert.equal(dataset.parameters.T2M.points[0].date, "1981-01");
  });

  it("reports HTTP errors with the API's own message", async () => {
    const { impl } = fakeFetch(async () => jsonResponse(fixture("error-422-bad-parameter"), 422));
    const detail = await errorKind(requestMonthly(london, 2026, { fetchImpl: impl }));
    assert.equal(detail.kind, "http");
    assert.match(detail.message, /HTTP 422/);
    assert.match(detail.message, /parameters is incorrect/);
  });

  it("reports network failures", async () => {
    const { impl } = fakeFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    assert.equal(
      (await errorKind(requestMonthly(london, 2026, { fetchImpl: impl }))).kind,
      "network",
    );
  });

  it("gives up after the timeout", async () => {
    const { impl } = fakeFetch(() => new Promise(() => {}));
    const detail = await errorKind(
      requestMonthly(london, 2026, { fetchImpl: impl, timeoutMs: 10 }),
    );
    assert.equal(detail.kind, "timeout");
  });

  it("reports unreadable bodies as parse errors", async () => {
    const { impl } = fakeFetch(async () => jsonResponse({ unexpected: true }));
    assert.equal(
      (await errorKind(requestMonthly(london, 2026, { fetchImpl: impl }))).kind,
      "parse",
    );
  });
});

describe("loadRegionDataset (session cache)", () => {
  beforeEach(() => clearPowerCache());

  it("shares one request between concurrent callers and serves later calls from memory", async () => {
    const { impl, calls } = fakeFetch(async () => jsonResponse(fixture("london-t2m-1981-2026")));
    assert.equal(peekRegionDataset(london, 2026), null);
    const [a, b] = await Promise.all([
      loadRegionDataset(london, 2026, { fetchImpl: impl }),
      loadRegionDataset(london, 2026, { fetchImpl: impl }),
    ]);
    assert.equal(a, b);
    await loadRegionDataset(london, 2026, { fetchImpl: impl });
    assert.equal(calls.length, 1);
    assert.equal(peekRegionDataset(london, 2026), a);
  });

  it("keeps regions apart", async () => {
    const { impl, calls } = fakeFetch(async (url) =>
      jsonResponse(
        fixture(url.includes("51.507") ? "london-t2m-1981-2026" : "manaus-t2m-2024-2026"),
      ),
    );
    await loadRegionDataset(london, 2026, { fetchImpl: impl });
    await loadRegionDataset(manaus, 2026, { fetchImpl: impl });
    assert.equal(calls.length, 2);
  });

  it("forgets a failed request so Try again requests it anew", async () => {
    let fail = true;
    const { impl, calls } = fakeFetch(async () =>
      fail
        ? Promise.reject(new TypeError("offline"))
        : jsonResponse(fixture("london-t2m-1981-2026")),
    );
    await assert.rejects(loadRegionDataset(london, 2026, { fetchImpl: impl }), PowerRequestError);
    fail = false;
    const dataset = await loadRegionDataset(london, 2026, { fetchImpl: impl });
    assert.ok(dataset.parameters.T2M);
    assert.equal(calls.length, 2);
  });
});
