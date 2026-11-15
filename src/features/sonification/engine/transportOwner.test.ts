import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  claimTransport,
  releaseTransport,
  transportOwner,
  type TransportOwner,
} from "./transportOwner";

function owner(name: string, log: string[]): TransportOwner {
  return { name, onTransportLost: () => log.push(`${name} stopped`) };
}

describe("transportOwner", () => {
  const log: string[] = [];
  const image = owner("image", log);
  const comparison = owner("comparison", log);
  afterEach(() => {
    releaseTransport(image);
    releaseTransport(comparison);
    log.length = 0;
  });

  it("stops the image when the comparison starts, and the other way round", () => {
    claimTransport(image);
    claimTransport(comparison);
    assert.deepEqual(log, ["image stopped"]);
    assert.equal(transportOwner(), comparison);
    claimTransport(image);
    assert.deepEqual(log, ["image stopped", "comparison stopped"]);
    assert.equal(transportOwner(), image);
  });

  it("does not stop an owner that claims again (resume)", () => {
    claimTransport(comparison);
    claimTransport(comparison);
    assert.deepEqual(log, []);
  });

  it("only the owner can release the Transport", () => {
    claimTransport(comparison);
    releaseTransport(image);
    assert.equal(transportOwner(), comparison);
    releaseTransport(comparison);
    assert.equal(transportOwner(), null);
    claimTransport(image);
    assert.deepEqual(log, []);
  });

  it("keeps the new owner even if the old one releases while stopping", () => {
    const polite: TransportOwner = {
      name: "polite",
      onTransportLost: () => releaseTransport(polite),
    };
    claimTransport(polite);
    claimTransport(comparison);
    assert.equal(transportOwner(), comparison);
  });
});
