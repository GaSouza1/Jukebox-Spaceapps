import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import type { ImageAnalysis } from "./imageAnalyzer";
import type { NarrationResult } from "./narrationLayer";
import type { PlaybackStatus } from "./playbackController";
import {
  ITEM_GAP_MS,
  neighbourId,
  SequencePlayer,
  type SequenceItem,
  type SequencePhase,
} from "./sequencePlayer";

const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
};

/** Fake analysis carrying only a tag, so the log shows which image was composed. */
const analysisOf = (tag: string) => ({ tag }) as unknown as ImageAnalysis;
const item = (id: string): SequenceItem => ({ id, analysis: analysisOf(id), narration: [id] });

function setup(ids = ["a", "b", "c"]) {
  const log: string[] = [];
  const statuses: PlaybackStatus[] = [];
  const warnings: (string | null)[] = [];
  let current: { id: string | null; phase: SequencePhase | null } = { id: null, phase: null };
  let pendingSpeech: ((result: NarrationResult) => void) | null = null;

  const narrator = {
    available: true,
    speak(sentences: string[]) {
      log.push(`speak:${sentences[0]}`);
      return new Promise<NarrationResult>((resolve) => (pendingSpeech = resolve));
    },
    pause: () => log.push("narration:pause"),
    resume: () => log.push("narration:resume"),
    cancel() {
      const resolve = pendingSpeech;
      pendingSpeech = null;
      resolve?.("cancelled");
    },
  };
  const composition = {
    prepare: async () => {},
    async play(analysis: ImageAnalysis) {
      log.push(`compose:${(analysis as unknown as { tag: string }).tag}`);
    },
    pause: () => log.push("compose:pause"),
    resume: async () => void log.push("compose:resume"),
    stop: () => {},
  };
  const player = new SequencePlayer(
    { composition, narrator },
    {
      onStatus: (status) => statuses.push(status),
      onCurrent: (id, phase) => (current = { id, phase }),
      onWarning: (message) => warnings.push(message),
      onError: (message) => log.push(`error:${message}`),
    },
  );
  player.setQueue(ids.map(item));

  return {
    player,
    narrator,
    log,
    statuses,
    warnings,
    current: () => current,
    async endNarration() {
      const resolve = pendingSpeech;
      pendingSpeech = null;
      resolve?.("ended");
      await flush();
    },
    async endComposition() {
      player.compositionEnded();
      await flush();
    },
    /** Lets the gap between two images elapse. */
    async gap() {
      mock.timers.tick(ITEM_GAP_MS);
      await flush();
    },
    /** Narration + composition of the current image, then the gap. */
    async playThrough() {
      await this.endNarration();
      await this.endComposition();
      await this.gap();
    },
  };
}

describe("neighbourId", () => {
  const ids = ["a", "b", "c"];
  it("moves within the list", () => {
    assert.equal(neighbourId(ids, "b", 1, false), "c");
    assert.equal(neighbourId(ids, "b", -1, false), "a");
  });
  it("stops at both ends without loop", () => {
    assert.equal(neighbourId(ids, "c", 1, false), null);
    assert.equal(neighbourId(ids, "a", -1, false), null);
  });
  it("wraps with loop, including a single image", () => {
    assert.equal(neighbourId(ids, "c", 1, true), "a");
    assert.equal(neighbourId(ids, "a", -1, true), "c");
    assert.equal(neighbourId(["a"], "a", 1, true), "a");
  });
  it("returns null for an unknown or missing current image", () => {
    assert.equal(neighbourId(ids, "x", 1, true), null);
    assert.equal(neighbourId(ids, null, 1, true), null);
  });
});

describe("SequencePlayer", () => {
  beforeEach(() => mock.timers.enable({ apis: ["setTimeout"] }));
  afterEach(() => mock.timers.reset());

  it("plays every image in order: narration first, then the composition", async () => {
    const t = setup();
    t.player.play("a");
    await flush();
    assert.deepEqual(t.current(), { id: "a", phase: "narration" });
    await t.endNarration();
    assert.deepEqual(t.current(), { id: "a", phase: "composition" });
    await t.endComposition();
    await t.gap();
    await t.playThrough(); // b
    await t.endNarration(); // c
    await t.endComposition();
    assert.deepEqual(t.log, [
      "speak:a",
      "compose:a",
      "speak:b",
      "compose:b",
      "speak:c",
      "compose:c",
    ]);
    assert.equal(t.player.state.status, "idle");
    assert.equal(t.current().id, null);
  });

  it("starts at the requested image and ends after the last one without loop", async () => {
    const t = setup();
    t.player.play("b");
    await flush();
    await t.playThrough();
    await t.endNarration();
    await t.endComposition();
    assert.deepEqual(t.log, ["speak:b", "compose:b", "speak:c", "compose:c"]);
    assert.equal(t.player.state.status, "idle");
  });

  it("returns to the first image after the last one when loop is on", async () => {
    const t = setup(["a", "b"]);
    t.player.setLoop(true);
    t.player.play("a");
    await flush();
    await t.playThrough();
    await t.playThrough();
    await flush();
    assert.deepEqual(t.log, ["speak:a", "compose:a", "speak:b", "compose:b", "speak:a"]);
    assert.equal(t.player.state.status, "playing");
  });

  it("repeats a single image when loop is on", async () => {
    const t = setup(["a"]);
    t.player.setLoop(true);
    t.player.play("a");
    await flush();
    await t.playThrough();
    await t.playThrough();
    assert.deepEqual(t.log.slice(0, 5), [
      "speak:a",
      "compose:a",
      "speak:a",
      "compose:a",
      "speak:a",
    ]);
  });

  it("stop interrupts a loop at once, and late callbacks do not restart it", async () => {
    const t = setup(["a", "b"]);
    t.player.setLoop(true);
    t.player.play("a");
    await flush();
    await t.endNarration();
    t.player.stop();
    assert.equal(t.player.state.status, "idle");
    // A composition end arriving after stop (e.g. a timer already queued) is ignored.
    await t.endComposition();
    await t.gap();
    assert.deepEqual(t.log, ["speak:a", "compose:a"]);
    assert.equal(t.current().id, null);
  });

  it("turning loop off while playing ends after the last image", async () => {
    const t = setup(["a", "b"]);
    t.player.setLoop(true);
    t.player.play("a");
    await flush();
    t.player.setLoop(false);
    await t.playThrough();
    await t.endNarration();
    await t.endComposition();
    assert.equal(t.player.state.status, "idle");
  });

  it("pauses and resumes the narration and the composition", async () => {
    const t = setup(["a"]);
    t.player.play("a");
    await flush();
    t.player.pause();
    assert.equal(t.player.state.status, "paused");
    await t.player.resume();
    await t.endNarration();
    t.player.pause();
    await t.player.resume();
    assert.deepEqual(t.log, [
      "speak:a",
      "narration:pause",
      "narration:resume",
      "compose:a",
      "compose:pause",
      "compose:resume",
    ]);
    assert.equal(t.player.state.status, "playing");
  });

  it("holds a pause taken between two images until resume", async () => {
    const t = setup(["a", "b"]);
    t.player.play("a");
    await flush();
    await t.endNarration();
    await t.endComposition();
    t.player.pause();
    await t.gap();
    assert.deepEqual(t.log, ["speak:a", "compose:a"]);
    await t.player.resume();
    await flush();
    assert.deepEqual(t.log, ["speak:a", "compose:a", "speak:b"]);
  });

  it("next and previous jump between images without waiting for the end", async () => {
    const t = setup();
    t.player.play("a");
    await flush();
    t.player.next();
    await flush();
    assert.deepEqual(t.current(), { id: "b", phase: "narration" });
    t.player.previous();
    await flush();
    assert.deepEqual(t.log, ["speak:a", "speak:b", "speak:a"]);
  });

  it("next while paused moves to the next image and stays paused", async () => {
    const t = setup();
    t.player.play("a");
    await flush();
    t.player.pause();
    t.player.next();
    await flush();
    assert.equal(t.player.state.status, "paused");
    assert.equal(t.current().id, "b");
    assert.deepEqual(t.log, ["speak:a", "narration:pause"]);
    await t.player.resume();
    await flush();
    assert.deepEqual(t.log, ["speak:a", "narration:pause", "speak:b"]);
  });

  it("removing the playing image moves on to the image that takes its place", async () => {
    const t = setup();
    t.player.play("a");
    await flush();
    await t.endNarration();
    t.player.remove("a");
    await flush();
    assert.equal(t.current().id, "b");
    // The removed image's composition ending late must not advance anything.
    await t.endComposition();
    assert.deepEqual(t.log, ["speak:a", "compose:a", "speak:b"]);
  });

  it("removing the playing last image ends playback without loop", async () => {
    const t = setup(["a", "b"]);
    t.player.play("b");
    await flush();
    t.player.remove("b");
    assert.equal(t.player.state.status, "idle");
  });

  it("removing another image only drops it from the queue", async () => {
    const t = setup();
    t.player.play("a");
    await flush();
    t.player.remove("b");
    t.player.setQueue(["a", "c"].map(item));
    await t.playThrough();
    assert.deepEqual(t.log, ["speak:a", "compose:a", "speak:c"]);
  });

  it("follows a new order set during playback", async () => {
    const t = setup();
    t.player.play("a");
    await flush();
    t.player.setQueue(["a", "c", "b"].map(item));
    await t.playThrough();
    assert.deepEqual(t.log, ["speak:a", "compose:a", "speak:c"]);
  });

  it("turning narration off mid-sentence skips to the composition of the same image", async () => {
    const t = setup(["a"]);
    t.player.play("a");
    await flush();
    t.player.setLayers({ scientific: true, cinematic: true, narration: false });
    await flush();
    assert.deepEqual(t.log, ["speak:a", "compose:a"]);
  });

  it("plays narration only when both music layers are off", async () => {
    const t = setup(["a", "b"]);
    t.player.setLayers({ scientific: false, cinematic: false, narration: true });
    t.player.play("a");
    await flush();
    await t.endNarration();
    await t.gap();
    assert.deepEqual(t.log, ["speak:a", "speak:b"]);
  });

  it("plays the composition only when narration is off", async () => {
    const t = setup(["a"]);
    t.player.setLayers({ scientific: true, cinematic: false, narration: false });
    t.player.play("a");
    await flush();
    assert.deepEqual(t.log, ["compose:a"]);
  });

  it("does not start when every layer is off", async () => {
    const t = setup(["a"]);
    t.player.setLayers({ scientific: false, cinematic: false, narration: false });
    t.player.play("a");
    await flush();
    assert.equal(t.player.state.status, "idle");
    assert.deepEqual(t.log, []);
  });

  it("skips an image that could not be analysed", async () => {
    const t = setup(["a", "b"]);
    t.player.setQueue([{ id: "a", analysis: null, narration: ["a"] }, item("b")]);
    t.player.play("a");
    await flush();
    await t.endNarration();
    await t.gap();
    assert.deepEqual(t.log, ["speak:a", "speak:b"]);
  });

  it("ends a loop in which no image can make a sound", async () => {
    const t = setup(["a", "b"]);
    t.player.setLoop(true);
    t.player.setLayers({ scientific: true, cinematic: true, narration: false });
    t.player.setQueue([
      { id: "a", analysis: null, narration: [] },
      { id: "b", analysis: null, narration: [] },
    ]);
    t.player.play("a");
    await flush();
    await t.gap();
    await t.gap();
    assert.equal(t.player.state.status, "idle");
    assert.match(String(t.warnings.at(-1)), /no image/);
  });

  it("continues with the composition when the narration fails", async () => {
    const t = setup(["a"]);
    t.narrator.speak = (sentences: string[]) => {
      t.log.push(`speak:${sentences[0]}`);
      return Promise.resolve("failed");
    };
    t.player.play("a");
    await flush();
    assert.deepEqual(t.log, ["speak:a", "compose:a"]);
  });

  it("skips the narration when speech synthesis is unavailable", async () => {
    const t = setup(["a"]);
    (t.narrator as { available: boolean }).available = false;
    t.player.play("a");
    await flush();
    assert.deepEqual(t.log, ["compose:a"]);
  });
});
