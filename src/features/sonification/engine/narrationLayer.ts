/**
 * NarrationLayer — speaks the description of the current image with the
 * browser's own speech synthesis (Web Speech API). It is independent of
 * Tone.js and of any screen reader, and it is only started by the sequence
 * that the Play button starts, never on page load.
 *
 * Text is spoken one sentence per utterance. Pause cancels the sentence being
 * spoken and resume speaks it again from its start. This avoids
 * speechSynthesis.pause(), which some browsers ignore, and Chrome's habit of
 * cutting off long utterances.
 *
 * Text and language are resolved again right before each sentence (see
 * narrationLanguage.ts), so a page translation, a voice change or a new voice
 * list applies from the next sentence without restarting the narration.
 */
import { SCRIPT_LANG, type LanguageOrigin, type ResolvedSentence } from "./narrationLanguage";

export type NarrationResult = "ended" | "cancelled" | "failed";

export interface VoiceOption {
  id: string;
  name: string;
  lang: string;
}

/** What the narration is using for the sentence being (or last) spoken. */
export interface VoiceState {
  lang: string;
  /** How `lang` was found; "manual" when the person chose a voice. */
  origin: LanguageOrigin | "manual";
  /** Voice name and language, or null when the browser picks the voice. */
  voice: string | null;
}

export interface NarrationCallbacks {
  onWarning(message: string | null): void;
  onVoices?(voices: VoiceOption[]): void;
  onVoiceState?(state: VoiceState): void;
}

/** Returns the text and language of sentence `index` of the narration `key`. */
export type SentenceResolver = (
  key: string,
  index: number,
  original: string,
) => ResolvedSentence | Promise<ResolvedSentence>;

/** Generous per-word allowance before a silent speech engine is given up on. */
const WATCHDOG_MS_PER_WORD = 600;
const WATCHDOG_MARGIN_MS = 8000;

const keepOriginal: SentenceResolver = (_key, _index, original) => ({
  text: original,
  lang: SCRIPT_LANG,
  origin: "original",
});

export function speechSynthesisAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window.speechSynthesis) &&
    typeof window.SpeechSynthesisUtterance === "function"
  );
}

const primary = (lang: string) => lang.toLowerCase().replace("_", "-").split("-")[0];
const normalise = (lang: string) => lang.toLowerCase().replace("_", "-");

/**
 * Best voice for a BCP 47 language: exact match first (pt-BR), then the same
 * language in another region (pt-PT), preferring the browser default, then a
 * local voice. Null when no voice speaks the language.
 */
export function pickVoice(
  voices: SpeechSynthesisVoice[],
  lang: string = SCRIPT_LANG,
): SpeechSynthesisVoice | null {
  const rank = (candidates: SpeechSynthesisVoice[]) =>
    candidates.find((voice) => voice.default) ??
    candidates.find((voice) => voice.localService) ??
    candidates[0];
  const exact = voices.filter((voice) => normalise(voice.lang) === normalise(lang));
  const sameLanguage = voices.filter((voice) => primary(voice.lang) === primary(lang));
  // For English, prefer en-US when the request has no region.
  const usEnglish =
    primary(lang) === "en" ? sameLanguage.filter((v) => /^en[-_]us$/i.test(v.lang)) : [];
  return (
    (exact.length ? rank(exact) : undefined) ??
    sameLanguage.find((voice) => voice.default) ??
    (usEnglish.length ? rank(usEnglish) : undefined) ??
    (sameLanguage.length ? rank(sameLanguage) : undefined) ??
    null
  );
}

export class NarrationLayer {
  private readonly synth: SpeechSynthesis | null;
  private readonly callbacks: NarrationCallbacks;
  private voices: SpeechSynthesisVoice[] = [];
  private manualVoiceId: string | null = null;
  private resolver: SentenceResolver = keepOriginal;
  private key = "";
  private sentences: string[] = [];
  private index = 0;
  private paused = false;
  /** Bumped whenever the current sentence is abandoned; drops late resolutions. */
  private attempt = 0;
  /** The utterance whose events still count; events from older ones are ignored. */
  private current: SpeechSynthesisUtterance | null = null;
  private settle: ((result: NarrationResult) => void) | null = null;
  private watchdog: number | null = null;
  private volume = 0.7;
  private rate = 1;

  constructor(callbacks: NarrationCallbacks) {
    this.callbacks = callbacks;
    this.synth = speechSynthesisAvailable() ? window.speechSynthesis : null;
    // Voices often arrive asynchronously, and the list can change later.
    this.synth?.addEventListener("voiceschanged", this.updateVoices);
    this.updateVoices();
  }

  get available() {
    return this.synth !== null;
  }

  /** Where each sentence's text and language come from (default: the script, in English). */
  setResolver(resolver: SentenceResolver) {
    this.resolver = resolver;
  }

  /** A voice id from onVoices, or null for automatic. Applies from the next sentence. */
  setManualVoice(id: string | null) {
    this.manualVoiceId = id;
  }

  /**
   * Speaks the sentences in order. `key` identifies the script for the
   * resolver. Resolves once, when the sentences end or are cancelled.
   */
  speak(sentences: string[], key = ""): Promise<NarrationResult> {
    this.cancel();
    if (!this.synth) return Promise.resolve("failed");
    if (!sentences.length) return Promise.resolve("ended");
    this.key = key;
    this.sentences = sentences;
    this.index = 0;
    this.paused = false;
    const result = new Promise<NarrationResult>((resolve) => (this.settle = resolve));
    // Clear speech left over from elsewhere; skipped when idle because Safari can
    // drop an utterance spoken right after cancel().
    if (this.synth.speaking || this.synth.pending) this.synth.cancel();
    this.speakCurrent();
    return result;
  }

  pause() {
    if (!this.settle || this.paused) return;
    this.paused = true;
    this.silence();
  }

  resume() {
    if (!this.settle || !this.paused) return;
    this.paused = false;
    this.speakCurrent();
  }

  /** Stops immediately; the pending speak() resolves with "cancelled". */
  cancel() {
    if (!this.settle) return;
    this.silence();
    this.done("cancelled");
  }

  /** 0..1. Applies from the next sentence: an utterance's volume is fixed once spoken. */
  setVolume(volume: number) {
    this.volume = volume;
  }

  /** Speech rate, 1 = the voice's normal speed. Applies from the next sentence. */
  setRate(rate: number) {
    this.rate = rate;
  }

  dispose() {
    this.cancel();
    this.synth?.removeEventListener("voiceschanged", this.updateVoices);
  }

  private readonly updateVoices = () => {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
    this.callbacks.onVoices?.(
      this.voices.map((voice) => ({ id: voice.voiceURI, name: voice.name, lang: voice.lang })),
    );
  };

  private speakCurrent() {
    if (this.index >= this.sentences.length) {
      this.done("ended");
      return;
    }
    const attempt = ++this.attempt;
    const resolved = this.resolver(this.key, this.index, this.sentences[this.index]);
    if (resolved instanceof Promise) {
      resolved.then(
        (sentence) => attempt === this.attempt && this.utter(sentence),
        (error: Error) =>
          attempt === this.attempt && this.fail(`Narration text: ${error.message}.`),
      );
    } else this.utter(resolved);
  }

  private utter(sentence: ResolvedSentence) {
    if (!this.synth) return;
    const manual = this.manualVoiceId
      ? this.voices.find((voice) => voice.voiceURI === this.manualVoiceId)
      : undefined;
    const voice = manual ?? pickVoice(this.voices, sentence.lang);
    const utterance = new SpeechSynthesisUtterance(sentence.text);
    // Without a voice, the language still lets the browser pick a suitable one.
    utterance.lang = voice?.lang ?? sentence.lang;
    if (voice) utterance.voice = voice;
    utterance.volume = this.volume;
    utterance.rate = this.rate;
    utterance.onend = () => {
      if (utterance !== this.current) return;
      this.clearWatchdog();
      this.current = null;
      this.index++;
      this.speakCurrent();
    };
    utterance.onerror = (event) => {
      // Our own cancel() detaches the utterance first, so "interrupted" and
      // "canceled" errors caused by pause, stop or skip never reach this point.
      if (utterance !== this.current) return;
      this.fail(`Narration is unavailable in this browser (${event.error}).`);
    };
    this.current = utterance;
    this.callbacks.onVoiceState?.({
      lang: manual ? manual.lang : sentence.lang,
      origin: manual ? "manual" : sentence.origin,
      voice: voice ? `${voice.name} (${voice.lang})` : null,
    });
    this.armWatchdog(sentence.text);
    this.synth.speak(utterance);
  }

  private fail(reason: string) {
    this.silence();
    this.callbacks.onWarning(`${reason} Playback continues without it.`);
    this.done("failed");
  }

  /** Stops the current utterance (or pending resolution) without resolving speak(). */
  private silence() {
    this.attempt++;
    this.clearWatchdog();
    this.current = null;
    this.synth?.cancel();
  }

  private done(result: NarrationResult) {
    const settle = this.settle;
    this.settle = null;
    this.sentences = [];
    this.index = 0;
    this.paused = false;
    settle?.(result);
  }

  /** Some engines never fire end or error (no voice installed): give up after a while. */
  private armWatchdog(text: string) {
    this.clearWatchdog();
    const words = text.split(/\s+/).length;
    const ms = (words * WATCHDOG_MS_PER_WORD) / this.rate + WATCHDOG_MARGIN_MS;
    this.watchdog = window.setTimeout(
      () => this.fail("The browser's speech engine did not respond."),
      ms,
    );
  }

  private clearWatchdog() {
    if (this.watchdog !== null) window.clearTimeout(this.watchdog);
    this.watchdog = null;
  }
}
