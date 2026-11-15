/**
 * PlaybackController — plays a SonificationScore on Tone.Transport: play /
 * pause / resume / stop / seek, speed and volume. Used by the image
 * sonification (`play(analysis)`, an adapter over `playScore`) and by the
 * region comparison (`playScore`). Owns the InstrumentManager lifecycle and
 * must be disposed.
 */
import * as Tone from "tone";
import { composeCinematic, continuationOf, type CinematicContinuation } from "./cinematicComposer";
import { cinematicProfile } from "./cinematicProfile";
import type { ImageAnalysis } from "./imageAnalyzer";
import { imageToScore } from "./imageScore";
import { InstrumentManager, type InstrumentOptions, type LayerName } from "./instrumentManager";
import { CinematicLayer, ScientificLayer } from "./layers";
import { bpmFor, clampStep, timbresOf, type SonificationScore } from "./score";
import { SynchronizationManager } from "./synchronization";

/** At 1× one step (eighth note) lasts 0.3 s. */
export const BASE_BPM = 100;

export type PlaybackStatus = "idle" | "loading" | "playing" | "paused";

export interface PlaybackCallbacks {
  onStatus(status: PlaybackStatus): void;
  /** Fired in sync with the audio; -1 means "back to start". */
  onStep(index: number): void;
  onWarning(message: string | null): void;
  /** Natural end of the composition (not fired by stop()). */
  onEnded?(): void;
}

export class PlaybackController {
  private readonly transport = Tone.getTransport();
  private readonly sync = new SynchronizationManager();
  private instruments: InstrumentManager | null = null;
  private loading: Promise<InstrumentManager> | null = null;
  private scientific: ScientificLayer | null = null;
  private cinematic: CinematicLayer | null = null;
  private score: SonificationScore | null = null;
  /** Tempo at 1× of the score being played (100 BPM for images, 60 for the comparison). */
  private baseBpm = BASE_BPM;
  private repeatId: number | null = null;
  private finishTimer: number | null = null;
  /** Incremented on stop/dispose so stale async play() calls bail out. */
  private session = 0;
  private disposed = false;
  private status: PlaybackStatus = "idle";
  private speed = 1;
  private volume = 0.7;
  private layers: Record<LayerName, boolean> = { scientific: true, cinematic: true };
  /** Cinematic identity (key) of the current playback session. */
  private identitySeed = randomSeed();
  /** Images composed in this session; each one gets its own variation. */
  private movement = 0;
  /** End of the previous image's composition: the next one continues from it. */
  private continuation: CinematicContinuation | null = null;

  constructor(
    private readonly callbacks: PlaybackCallbacks,
    private readonly options: InstrumentOptions = {},
  ) {}

  get state(): PlaybackStatus {
    return this.status;
  }

  /**
   * Unlocks the AudioContext and loads the instruments without playing. Call
   * it from the user's click so audio is allowed and samples load early.
   */
  async prepare() {
    await Tone.start();
    await this.ensureInstruments();
  }

  /**
   * Starts a new playback session: the next compositions get a new musical
   * identity. Images played within one session share it and vary around it.
   */
  newSession() {
    this.identitySeed = randomSeed();
    this.movement = 0;
    this.continuation = null;
  }

  /** Image sonification: the analysis becomes a score, then plays as before. */
  async play(analysis: ImageAnalysis) {
    if (this.status === "paused") return this.resume();
    if (this.status !== "idle" || !analysis.steps.length) return;
    // The cinematic layer gets the duration and ONE artistic number (energy,
    // from global brightness and contrast); never the per-slice values.
    return this.playScore(imageToScore(analysis, cinematicProfile(analysis).energy));
  }

  /**
   * Plays a score from `fromIndex` (0 = the start). Resumes instead when
   * paused; does nothing while already playing or loading.
   */
  async playScore(score: SonificationScore, fromIndex = 0) {
    if (this.status === "paused") return this.resume();
    if (this.status !== "idle" || !score.stepCount) return;

    const session = ++this.session;
    // Only a first play has samples to load; later plays start straight away.
    if (!this.instruments) this.setStatus("loading");
    let instruments: InstrumentManager;
    try {
      await Tone.start();
      instruments = await this.ensureInstruments();
    } catch (error) {
      this.loading = null;
      if (session === this.session) this.setStatus("idle");
      throw error;
    }
    if (this.disposed || session !== this.session) return;

    this.score = score;
    for (const voice of score.voices) {
      const fixedPan = voice.notes.every((note) => note?.pan === undefined);
      instruments.prepareChannel(voice.id, voice.pan, timbresOf(voice), fixedPan);
    }
    this.scientific = new ScientificLayer(instruments, score);
    if (score.cinematic) {
      const plan = composeCinematic({
        totalSteps: score.stepCount,
        identitySeed: this.identitySeed,
        movement: this.movement++,
        energy: score.cinematic.energy,
        previous: this.continuation,
      });
      this.continuation = continuationOf(plan);
      this.cinematic = new CinematicLayer(instruments, plan);
    } else {
      this.cinematic = null;
    }

    this.resetTransport();
    this.baseBpm = bpmFor(score.stepSeconds);
    this.transport.bpm.value = this.baseBpm * this.speed;
    this.repeatId = this.transport.scheduleRepeat(
      (time) => this.tick(time),
      this.sync.stepInterval,
      0,
    );
    const start = clampStep(score, fromIndex);
    if (start > 0) this.transport.ticks = start * this.sync.stepTicks;
    this.transport.start("+0.05");
    this.setStatus("playing");
  }

  /**
   * Moves playback to a step. While playing, sound continues from there; while
   * paused, Resume continues from there. The UI is told at once. When idle
   * there is nothing to move: start with playScore(score, index).
   */
  seek(index: number) {
    if (!this.score || (this.status !== "playing" && this.status !== "paused")) return;
    const step = clampStep(this.score, index);
    this.instruments?.releaseAll();
    this.sync.cancel();
    this.transport.ticks = step * this.sync.stepTicks;
    this.cinematic?.resync();
    this.callbacks.onStep(step);
  }

  pause() {
    if (this.status !== "playing") return;
    this.transport.pause();
    this.instruments?.releaseAll();
    this.cinematic?.resync();
    this.setStatus("paused");
  }

  async resume() {
    if (this.status !== "paused") return;
    await Tone.start();
    this.transport.start("+0.05");
    this.setStatus("playing");
  }

  stop() {
    this.session++;
    // Idle: nothing of ours is on the Transport. Leaving it alone matters,
    // because another experience may be using it (see transportOwner.ts).
    if (this.status === "idle") return;
    this.resetTransport();
    this.instruments?.releaseAll();
    this.callbacks.onStep(-1);
    this.setStatus("idle");
  }

  setSpeed(speed: number) {
    this.speed = speed;
    this.transport.bpm.rampTo(this.baseBpm * speed, 0.3);
  }

  setVolume(volume: number) {
    this.volume = volume;
    this.instruments?.setVolume(volume);
  }

  setLayerEnabled(layer: LayerName, enabled: boolean) {
    this.layers[layer] = enabled;
    this.instruments?.setLayerEnabled(layer, enabled);
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.instruments?.dispose();
    this.instruments = null;
  }

  private tick(time: number) {
    const index = this.sync.indexAt(time);
    if (!this.score || index >= this.score.stepCount) {
      this.transport.stop(time);
      // A timer, not Tone.Draw: Draw runs on animation frames, which stop in a
      // background tab, and a sequence must still move on to the next image.
      const session = this.session;
      const delay = Math.max(0, (time - Tone.immediate()) * 1000);
      this.finishTimer = window.setTimeout(() => {
        this.finishTimer = null;
        if (session === this.session) this.finish();
      }, delay);
      return;
    }
    const stepSeconds = this.sync.stepSecondsAt(time);
    this.scientific?.play(index, time, stepSeconds);
    this.cinematic?.play(index, time, stepSeconds);
    this.sync.notify(() => this.callbacks.onStep(index), time);
  }

  /** Natural end: let the cinematic tail ring out, then reset. */
  private finish() {
    if (this.status !== "playing") return;
    this.session++;
    this.resetTransport();
    this.callbacks.onStep(-1);
    this.setStatus("idle");
    this.callbacks.onEnded?.();
  }

  private resetTransport() {
    if (this.finishTimer !== null) window.clearTimeout(this.finishTimer);
    this.finishTimer = null;
    this.transport.stop();
    if (this.repeatId !== null) this.transport.clear(this.repeatId);
    this.repeatId = null;
    this.transport.position = 0;
    this.sync.cancel();
  }

  private ensureInstruments(): Promise<InstrumentManager> {
    if (this.instruments) return Promise.resolve(this.instruments);
    this.loading ??= (async () => {
      const instruments = new InstrumentManager(this.options);
      await instruments.load();
      if (this.disposed) {
        instruments.dispose();
        return instruments;
      }
      instruments.setVolume(this.volume);
      for (const layer of Object.keys(this.layers) as LayerName[]) {
        instruments.setLayerEnabled(layer, this.layers[layer]);
      }
      this.callbacks.onWarning(instruments.sampleWarning);
      this.instruments = instruments;
      return instruments;
    })();
    return this.loading;
  }

  private setStatus(status: PlaybackStatus) {
    this.status = status;
    this.callbacks.onStatus(status);
  }
}

function randomSeed() {
  return Math.floor(Math.random() * 2 ** 32);
}
