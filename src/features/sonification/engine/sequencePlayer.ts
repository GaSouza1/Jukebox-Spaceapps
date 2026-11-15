/**
 * SequencePlayer — plays an ordered collection of images. For each image it
 * runs the Narration layer first (spoken description), then the existing
 * composition (Scientific + Cinematic, through PlaybackController), then moves
 * on to the next image, wrapping to the first one when loop is on.
 *
 * Every run of an image carries a token. Stop, next, previous and removal
 * bump it, so a late callback from an earlier run (a narration that ends, a
 * composition that finishes, a timer) can never start or advance an image
 * that is no longer current, or one that was removed.
 */
import type { ImageAnalysis } from "./imageAnalyzer";
import type { LayerName } from "./instrumentManager";
import type { NarrationResult } from "./narrationLayer";
import type { PlaybackStatus } from "./playbackController";

export type SoundLayer = LayerName | "narration";
export type SequencePhase = "narration" | "composition";

export interface SequenceItem {
  id: string;
  /** null while the image is still being analysed, or when it could not be. */
  analysis: ImageAnalysis | null;
  /** Narration sentences, spoken in order. */
  narration: string[];
}

/** The part of PlaybackController the sequence drives. */
export interface CompositionEngine {
  prepare(): Promise<void>;
  play(analysis: ImageAnalysis): Promise<void>;
  pause(): void;
  resume(): Promise<void>;
  stop(): void;
}

/** The part of NarrationLayer the sequence drives. */
export interface Narrator {
  readonly available: boolean;
  /** `key` is the image id, so the narrator can read that image's rendered script. */
  speak(sentences: string[], key: string): Promise<NarrationResult>;
  pause(): void;
  resume(): void;
  cancel(): void;
}

export interface SequenceCallbacks {
  onStatus(status: PlaybackStatus): void;
  /** The image being played (null when idle) and the layer group being heard. */
  onCurrent(id: string | null, phase: SequencePhase | null): void;
  onWarning(message: string | null): void;
  onError(message: string): void;
}

/** Silence between two images, so the cinematic tail fades before the next narration. */
export const ITEM_GAP_MS = 1200;

/**
 * Id of the image `delta` places away from `currentId`, wrapping around when
 * `loop` is on; null at either end without loop. Pure, so the UI can use it
 * to enable or disable Previous and Next.
 */
export function neighbourId(
  ids: string[],
  currentId: string | null,
  delta: 1 | -1,
  loop: boolean,
): string | null {
  const index = currentId === null ? -1 : ids.indexOf(currentId);
  if (index < 0) return null;
  const target = index + delta;
  if (target >= 0 && target < ids.length) return ids[target];
  return loop ? ids[(target + ids.length) % ids.length] : null;
}

export class SequencePlayer {
  private readonly composition: CompositionEngine;
  private readonly narrator: Narrator;
  private readonly callbacks: SequenceCallbacks;
  private queue: SequenceItem[] = [];
  private status: PlaybackStatus = "idle";
  private currentId: string | null = null;
  private phase: SequencePhase | null = null;
  private token = 0;
  private loop = false;
  private layers: Record<SoundLayer, boolean> = {
    scientific: true,
    cinematic: true,
    narration: true,
  };
  /** Set while a run waits for Resume before starting its next phase. */
  private resumeGate: (() => void) | null = null;
  private compositionDone: (() => void) | null = null;
  private gapTimer: ReturnType<typeof setTimeout> | null = null;
  /** Images in a row that produced no sound; ends a loop over unplayable images. */
  private silentRun = 0;

  constructor(
    deps: { composition: CompositionEngine; narrator: Narrator },
    callbacks: SequenceCallbacks,
  ) {
    this.composition = deps.composition;
    this.narrator = deps.narrator;
    this.callbacks = callbacks;
  }

  get state() {
    return { status: this.status, currentId: this.currentId, phase: this.phase };
  }

  setQueue(items: SequenceItem[]) {
    this.queue = items;
  }

  setLoop(loop: boolean) {
    this.loop = loop;
  }

  /** Muting narration skips the sentence being spoken; the composition is unaffected. */
  setLayers(layers: Record<SoundLayer, boolean>) {
    const narrationOff = this.layers.narration && !layers.narration;
    this.layers = { ...layers };
    if (narrationOff && this.phase === "narration") this.narrator.cancel();
  }

  /** From idle, starts at `startId` and plays the queue in order. From paused, resumes. */
  play(startId: string) {
    if (this.status === "paused") return this.resume();
    if (this.status !== "idle" || !this.queue.some((item) => item.id === startId)) return;
    if (!Object.values(this.layers).some(Boolean)) return;
    // Still inside the Play click: unlock audio now and load the instruments
    // while the first narration is spoken. play() reports a lasting failure.
    this.composition.prepare().catch(() => {});
    this.silentRun = 0;
    this.callbacks.onWarning(null);
    this.setStatus("playing");
    this.start(startId, false);
  }

  pause() {
    if (this.status !== "playing") return;
    if (this.phase === "narration") this.narrator.pause();
    else if (this.phase === "composition") this.composition.pause();
    this.setStatus("paused");
  }

  async resume() {
    if (this.status !== "paused") return;
    this.setStatus("playing");
    const gate = this.resumeGate;
    if (gate) {
      this.resumeGate = null;
      gate();
    } else if (this.phase === "narration") this.narrator.resume();
    else if (this.phase === "composition") await this.composition.resume();
  }

  /** Stops every layer at once and forgets the position. */
  stop() {
    if (this.status === "idle") return;
    this.interrupt();
    this.finish();
  }

  next() {
    this.skip(1);
  }

  previous() {
    this.skip(-1);
  }

  /**
   * Call before an image leaves the collection. If it is the image being
   * played, playback moves on to the image that takes its place (keeping a
   * pause), or ends when it was the last one and loop is off.
   */
  remove(id: string) {
    if (this.status === "idle" || id !== this.currentId) return;
    const index = this.queue.findIndex((item) => item.id === id);
    this.queue = this.queue.filter((item) => item.id !== id);
    const target = this.queue[index] ?? (this.loop ? this.queue[0] : undefined);
    if (target) this.jump(target.id);
    else this.stop();
  }

  dispose() {
    this.stop();
  }

  /** Forwarded from PlaybackController.onStatus. */
  compositionStatus(status: PlaybackStatus) {
    if (this.phase !== "composition") return;
    // Paused between the start request and the transport starting: hold it.
    if (this.status === "paused" && status === "playing") this.composition.pause();
    else if (this.status !== "paused" && (status === "loading" || status === "playing")) {
      this.setStatus(status);
    }
  }

  /** Forwarded from PlaybackController.onEnded. */
  compositionEnded() {
    const done = this.compositionDone;
    this.compositionDone = null;
    done?.();
  }

  private skip(delta: 1 | -1) {
    if (this.status === "idle") return;
    const ids = this.queue.map((item) => item.id);
    const target = neighbourId(ids, this.currentId, delta, this.loop);
    if (target) this.jump(target);
  }

  /** Moves to another image, keeping the play / pause state. */
  private jump(id: string) {
    this.interrupt();
    this.silentRun = 0;
    if (this.status !== "paused") this.setStatus("playing");
    this.start(id, false);
  }

  /** Silences the current image at once and invalidates its run. */
  private interrupt() {
    this.token++;
    this.resumeGate = null;
    if (this.gapTimer !== null) clearTimeout(this.gapTimer);
    this.gapTimer = null;
    this.narrator.cancel();
    this.composition.stop();
    this.compositionEnded();
    this.phase = null;
  }

  private start(id: string, afterPrevious: boolean) {
    const token = ++this.token;
    this.currentId = id;
    this.phase = null;
    this.callbacks.onCurrent(id, null);
    void this.run(id, token, afterPrevious);
  }

  private async run(id: string, token: number, afterPrevious: boolean) {
    const live = () => token === this.token;
    if (afterPrevious) {
      await this.wait(ITEM_GAP_MS);
      if (!live()) return;
    }
    await this.gate();
    if (!live()) return;
    let audible = false;

    // 1. Narration: the description comes before the sound of the image.
    const narration = this.item(id)?.narration ?? [];
    if (this.layers.narration && this.narrator.available && narration.length) {
      this.setPhase("narration");
      const result = await this.narrator.speak(narration, id);
      if (!live()) return;
      audible = result === "ended";
      this.setPhase(null);
      await this.gate();
      if (!live()) return;
    }

    // 2. Composition: Scientific + Cinematic, through the existing engine.
    // Read the item again: the analysis may have arrived during the narration.
    const analysis = this.item(id)?.analysis ?? null;
    if ((this.layers.scientific || this.layers.cinematic) && analysis) {
      this.setPhase("composition");
      const done = new Promise<void>((resolve) => (this.compositionDone = resolve));
      try {
        await this.composition.play(analysis);
      } catch (error) {
        if (!live()) return;
        this.callbacks.onError(`Could not start audio: ${(error as Error).message}`);
        this.stop();
        return;
      }
      if (!live()) return;
      await done;
      if (!live()) return;
      audible = true;
    }

    this.silentRun = audible ? 0 : this.silentRun + 1;
    this.advance();
  }

  private advance() {
    if (this.silentRun >= Math.max(1, this.queue.length)) {
      this.callbacks.onWarning(
        "Playback ended: no image in the collection could be played with the current layers.",
      );
      this.finish();
      return;
    }
    const ids = this.queue.map((item) => item.id);
    const next = neighbourId(ids, this.currentId, 1, this.loop);
    if (next) this.start(next, true);
    else this.finish();
  }

  private finish() {
    this.token++;
    this.resumeGate = null;
    this.currentId = null;
    this.phase = null;
    this.callbacks.onCurrent(null, null);
    this.setStatus("idle");
  }

  private gate(): Promise<void> {
    if (this.status !== "paused") return Promise.resolve();
    return new Promise((resolve) => (this.resumeGate = resolve));
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.gapTimer = setTimeout(() => {
        this.gapTimer = null;
        resolve();
      }, ms);
    });
  }

  private item(id: string) {
    return this.queue.find((item) => item.id === id);
  }

  private setPhase(phase: SequencePhase | null) {
    this.phase = phase;
    this.callbacks.onCurrent(this.currentId, phase);
  }

  private setStatus(status: PlaybackStatus) {
    if (status === this.status) return;
    this.status = status;
    this.callbacks.onStatus(status);
  }
}
