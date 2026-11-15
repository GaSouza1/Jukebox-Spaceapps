import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { NarrationLayer, pickVoice } from "./narrationLayer";

type Listener = () => void;

/** Minimal stand-in for window.speechSynthesis: the test decides when a sentence ends. */
class FakeSynth {
  spoken: FakeUtterance[] = [];
  queue: FakeUtterance[] = [];
  voices: SpeechSynthesisVoice[] = [];
  speaking = false;
  pending = false;
  private listeners: Listener[] = [];
  speak(utterance: FakeUtterance) {
    this.spoken.push(utterance);
    this.queue.push(utterance);
  }
  cancel() {
    const queued = this.queue;
    this.queue = [];
    for (const utterance of queued) utterance.onerror?.({ error: "interrupted" });
  }
  getVoices() {
    return this.voices;
  }
  addEventListener(_: string, listener: Listener) {
    this.listeners.push(listener);
  }
  removeEventListener() {}
  /** Finishes the sentence currently being spoken. */
  end() {
    this.queue.shift()?.onend?.();
  }
  fail(error: string) {
    this.queue.shift()?.onerror?.({ error });
  }
}

class FakeUtterance {
  lang = "";
  voice: SpeechSynthesisVoice | null = null;
  volume = 1;
  rate = 1;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  text: string;
  constructor(text: string) {
    this.text = text;
  }
}

const voice = (name: string, lang: string, extra: Partial<SpeechSynthesisVoice> = {}) =>
  ({
    name,
    lang,
    default: false,
    localService: true,
    voiceURI: name,
    ...extra,
  }) as SpeechSynthesisVoice;

let synth: FakeSynth;
const g = globalThis as Record<string, unknown>;

beforeEach(() => {
  synth = new FakeSynth();
  g.window = {
    speechSynthesis: synth,
    SpeechSynthesisUtterance: FakeUtterance,
    setTimeout,
    clearTimeout,
  };
  g.SpeechSynthesisUtterance = FakeUtterance;
});
afterEach(() => {
  delete g.window;
  delete g.SpeechSynthesisUtterance;
});

describe("pickVoice", () => {
  const voices = [
    voice("Luciana", "pt-BR", { default: true }),
    voice("Joana", "pt-PT"),
    voice("Daniel", "en-GB"),
    voice("Samantha", "en-US"),
  ];
  it("matches the exact language and region first", () => {
    assert.equal(pickVoice(voices, "pt-PT")?.name, "Joana");
    assert.equal(pickVoice(voices, "en-GB")?.name, "Daniel");
  });
  it("falls back to the same language in another region, preferring the default voice", () => {
    assert.equal(pickVoice(voices, "pt")?.name, "Luciana");
    assert.equal(pickVoice(voices, "pt-AO")?.name, "Luciana");
  });
  it("prefers US English for plain English", () => {
    assert.equal(pickVoice(voices, "en")?.name, "Samantha");
  });
  it("returns null when no voice speaks the language", () => {
    assert.equal(pickVoice(voices, "ja"), null);
    assert.equal(pickVoice([], "en"), null);
  });
});

describe("NarrationLayer", () => {
  it("speaks the sentences in order, then resolves", async () => {
    const warnings: (string | null)[] = [];
    const layer = new NarrationLayer({ onWarning: (w) => warnings.push(w) });
    const done = layer.speak(["One.", "Two."]);
    assert.equal(synth.spoken.at(-1)?.text, "One.");
    synth.end();
    assert.equal(synth.spoken.at(-1)?.text, "Two.");
    synth.end();
    assert.equal(await done, "ended");
    assert.deepEqual(warnings, []);
    layer.dispose();
  });

  it("re-resolves text and language before every sentence, without restarting", async () => {
    synth.voices = [voice("Samantha", "en-US"), voice("Luciana", "pt-BR")];
    const states: string[] = [];
    const layer = new NarrationLayer({
      onWarning: () => {},
      onVoiceState: (s) => states.push(`${s.lang}/${s.origin}/${s.voice}`),
    });
    let translated = false;
    layer.setResolver((key, index, original) =>
      translated
        ? { text: `[pt] ${original}`, lang: "pt-BR", origin: "page" }
        : { text: original, lang: "en", origin: "original" },
    );
    const done = layer.speak(["One.", "Two.", "Three."], "image-1");
    synth.end();
    translated = true; // the page is translated while sentence two is spoken
    synth.end();
    synth.end();
    assert.equal(await done, "ended");
    assert.deepEqual(
      synth.spoken.map((u) => `${u.text}|${u.lang}|${u.voice?.name}`),
      ["One.|en-US|Samantha", "Two.|en-US|Samantha", "[pt] Three.|pt-BR|Luciana"],
    );
    assert.equal(states.at(-1), "pt-BR/page/Luciana (pt-BR)");
  });

  it("passes the narration key and sentence index to the resolver", async () => {
    const calls: string[] = [];
    const layer = new NarrationLayer({ onWarning: () => {} });
    layer.setResolver((key, index, original) => {
      calls.push(`${key}:${index}:${original}`);
      return { text: original, lang: "en", origin: "original" };
    });
    void layer.speak(["One.", "Two."], "upload-3");
    synth.end();
    assert.deepEqual(calls, ["upload-3:0:One.", "upload-3:1:Two."]);
    layer.dispose();
  });

  it("drops an async resolution that arrives after pause, and resolves again on resume", async () => {
    const layer = new NarrationLayer({ onWarning: () => {} });
    let release: (() => void) | null = null;
    layer.setResolver(
      (_key, _index, original) =>
        new Promise((resolve) => {
          release = () => resolve({ text: original, lang: "en", origin: "original" });
        }),
    );
    void layer.speak(["One."], "a");
    const late = release!;
    layer.pause();
    late();
    await new Promise((r) => setImmediate(r));
    assert.equal(synth.spoken.length, 0);
    layer.resume();
    release!();
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(
      synth.spoken.map((u) => u.text),
      ["One."],
    );
    layer.dispose();
  });

  it("a manual voice overrides the resolved language; automatic follows it again", async () => {
    synth.voices = [voice("Samantha", "en-US"), voice("Luciana", "pt-BR")];
    const states: string[] = [];
    const layer = new NarrationLayer({
      onWarning: () => {},
      onVoiceState: (s) => states.push(s.origin),
    });
    layer.setManualVoice("Luciana");
    void layer.speak(["One.", "Two."]);
    assert.equal(synth.spoken[0].voice?.name, "Luciana");
    assert.equal(synth.spoken[0].lang, "pt-BR");
    layer.setManualVoice(null);
    synth.end();
    assert.equal(synth.spoken[1].voice?.name, "Samantha");
    assert.deepEqual(states, ["manual", "original"]);
    layer.dispose();
  });

  it("without a voice for the language, sets the language and lets the browser choose", async () => {
    synth.voices = [voice("Samantha", "en-US")];
    const layer = new NarrationLayer({ onWarning: () => {} });
    layer.setResolver((_k, _i, original) => ({ text: original, lang: "ja", origin: "detector" }));
    void layer.speak(["One."]);
    assert.equal(synth.spoken[0].voice, null);
    assert.equal(synth.spoken[0].lang, "ja");
    layer.dispose();
  });

  it("applies volume, rate and an English language to each sentence", async () => {
    synth.voices = [voice("Samantha", "en-US")];
    const layer = new NarrationLayer({ onWarning: () => {} });
    layer.setVolume(0.4);
    layer.setRate(1.25);
    void layer.speak(["One."]);
    const utterance = synth.spoken[0];
    assert.equal(utterance.volume, 0.4);
    assert.equal(utterance.rate, 1.25);
    assert.equal(utterance.lang, "en-US");
    assert.equal(utterance.voice?.name, "Samantha");
    layer.dispose();
  });

  it("pause silences the sentence and resume speaks it again from its start", async () => {
    const layer = new NarrationLayer({ onWarning: () => {} });
    const done = layer.speak(["One.", "Two."]);
    synth.end();
    layer.pause();
    assert.equal(synth.queue.length, 0);
    layer.resume();
    assert.deepEqual(
      synth.spoken.map((u) => u.text),
      ["One.", "Two.", "Two."],
    );
    synth.end();
    assert.equal(await done, "ended");
  });

  it("cancel stops at once and resolves as cancelled", async () => {
    const layer = new NarrationLayer({ onWarning: () => {} });
    const done = layer.speak(["One.", "Two."]);
    layer.cancel();
    assert.equal(await done, "cancelled");
    assert.equal(synth.queue.length, 0);
    synth.end(); // nothing left to end; no further sentence is spoken
    assert.equal(synth.spoken.length, 1);
  });

  it("reports a speech error and resolves as failed", async () => {
    const warnings: (string | null)[] = [];
    const layer = new NarrationLayer({ onWarning: (w) => warnings.push(w) });
    const done = layer.speak(["One.", "Two."]);
    synth.fail("synthesis-failed");
    assert.equal(await done, "failed");
    assert.match(String(warnings[0]), /synthesis-failed/);
    assert.equal(synth.spoken.length, 1);
  });

  it("is unavailable, and fails without throwing, when the browser has no speech synthesis", async () => {
    delete g.window;
    const layer = new NarrationLayer({ onWarning: () => {} });
    assert.equal(layer.available, false);
    assert.equal(await layer.speak(["One."]), "failed");
  });
});
