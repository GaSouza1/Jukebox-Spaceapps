import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { regions } from "../features/data/regions";
import { useComparisonStore } from "./comparisonStore";

const store = () => useComparisonStore.getState();

describe("comparisonStore playback commands", () => {
  beforeEach(() => store().resetPlayback());

  it("defaults to T2M and the last 20 complete years", () => {
    const lastYear = new Date().getFullYear() - 1;
    assert.equal(store().indicator, "T2M");
    assert.equal(store().endYear, lastYear);
    assert.equal(store().startYear, lastYear - 19);
  });

  it("emits one action per transition, for the player and the engine", () => {
    store().play();
    assert.equal(store().lastAction?.type, "play");
    store().setCurrentIndex(12); // written by the engine's onStep
    store().pause();
    assert.equal(store().lastAction?.type, "pause");
    assert.equal(store().currentIndex, 12);
    store().resume();
    assert.equal(store().lastAction?.type, "resume");
    store().stop();
    assert.deepEqual(
      [store().lastAction?.type, store().currentIndex, store().isPlaying],
      ["stop", 0, false],
    );
  });

  it("stops playback when the comparison changes", () => {
    store().play();
    store().setRegion("regionB", regions[4]);
    assert.equal(store().isPlaying, false);
    assert.equal(store().lastAction?.type, "stop");
  });

  it("records an interruption by the image sonification only when something was playing", () => {
    store().play();
    store().interrupt();
    assert.equal(store().lastAction?.type, "interrupt");
    const id = store().lastAction?.id;
    store().interrupt();
    assert.equal(store().lastAction?.id, id);
  });
});
