/**
 * PlaybackController — play / pause / resume / stop, speed and volume on top of
 * Tone.Transport. Owns the InstrumentManager lifecycle and must be disposed.
 */
import * as Tone from "tone";
import { mapAnalysis, planSections, type ScientificEvent } from "./dataMapper";
import type { ImageAnalysis } from "./imageAnalyzer";
import { InstrumentManager, type LayerName } from "./instrumentManager";
import { CinematicLayer, ScientificLayer } from "./layers";
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
  private events: ScientificEvent[] = [];
  private repeatId: number | null = null;
  private finishTimer: number | null = null;
  /** Incremented on stop/dispose so stale async play() calls bail out. */
  private session = 0;
  private disposed = false;
  private status: PlaybackStatus = "idle";
  private speed = 1;
  private volume = 0.7;
  private layers: Record<LayerName, boolean> = { scientific: true, cinematic: true };

  constructor(private readonly callbacks: PlaybackCallbacks) {}

  /**
   * Unlocks the AudioContext and loads the instruments without playing. Call
   * it from the user's click so audio is allowed and samples load early.
   */
  async prepare() {
    await Tone.start();
    await this.ensureInstruments();
  }

  async play(analysis: ImageAnalysis) {
    if (this.status === "paused") return this.resume();
    if (this.status !== "idle" || !analysis.steps.length) return;

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

    this.events = mapAnalysis(analysis);
    this.scientific = new ScientificLayer(instruments);
    this.cinematic = new CinematicLayer(instruments, planSections(analysis));

    this.resetTransport();
    this.transport.bpm.value = BASE_BPM * this.speed;
    this.repeatId = this.transport.scheduleRepeat(
      (time) => this.tick(time),
      this.sync.stepInterval,
      0,
    );
    this.transport.start("+0.05");
    this.setStatus("playing");
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
    this.resetTransport();
    this.instruments?.releaseAll();
    this.callbacks.onStep(-1);
    this.setStatus("idle");
  }

  setSpeed(speed: number) {
    this.speed = speed;
    this.transport.bpm.rampTo(BASE_BPM * speed, 0.3);
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
    if (index >= this.events.length) {
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
    this.scientific?.play(this.events[index], time, stepSeconds);
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
      const instruments = new InstrumentManager();
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
