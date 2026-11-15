/**
 * SynchronizationManager — derives the current step from the Transport clock
 * (so pause/resume and tempo changes can never desynchronise audio and UI) and
 * hands visual updates to Tone.Draw so they fire when the sound is heard.
 */
import * as Tone from "tone";

export class SynchronizationManager {
  private readonly transport = Tone.getTransport();
  /** One data step = one eighth note. */
  readonly stepInterval = "8n";

  get stepTicks() {
    return this.transport.PPQ / 2;
  }

  indexAt(time: number): number {
    return Math.round(this.transport.getTicksAtTime(time) / this.stepTicks);
  }

  stepSecondsAt(time: number): number {
    return 60 / this.transport.bpm.getValueAtTime(time) / 2;
  }

  notify(callback: () => void, time: number) {
    Tone.getDraw().schedule(callback, time);
  }

  cancel() {
    Tone.getDraw().cancel(0);
  }
}
