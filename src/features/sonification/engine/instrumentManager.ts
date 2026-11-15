/**
 * InstrumentManager — owns every Tone.js node used by the sonification:
 * instruments, the two layer buses, shared reverb and the master chain.
 *
 *   scientific voices → Panner → Filter(5 kHz) → sciBus ─┬─────────────→ master
 *                                                       └→ send 0.15 → Reverb ┘
 *   cinematic voices  → Filter(1.8 kHz) → cinBus ───────┬─────────────→ master
 *                                                       └→ send 0.55 → Reverb ┘
 *   master = Volume → Limiter(−1 dB) → Destination
 */
import * as Tone from "tone";
import type { ScientificTimbre } from "./dataMapper";

/** Minimal shared surface of Sampler and PolySynth. */
export interface Voice {
  triggerAttackRelease(note: number, duration: number, time?: number, velocity?: number): unknown;
  releaseAll(time?: number): unknown;
}

/** Salamander Grand Piano (CC-BY 3.0, Alexander Holm), hosted in public/samples/piano. */
const PIANO_NOTES = [
  "C2",
  "Ds2",
  "Fs2",
  "A2",
  "C3",
  "Ds3",
  "Fs3",
  "A3",
  "C4",
  "Ds4",
  "Fs4",
  "A4",
  "C5",
  "Ds5",
  "Fs5",
  "A5",
  "C6",
];
const SAMPLE_TIMEOUT_MS = 15000;
/** Cinematic bus sits well below the scientific bus so it can't mask it. */
const CINEMATIC_LEVEL_DB = -10;

export type LayerName = "scientific" | "cinematic";

export class InstrumentManager {
  readonly master = new Tone.Volume(0);
  private readonly limiter = new Tone.Limiter(-1);
  private readonly reverb = new Tone.Reverb({ decay: 6, preDelay: 0.03, wet: 1 });

  private readonly sciPanner = new Tone.Panner(0);
  private readonly sciFilter = new Tone.Filter({ type: "lowpass", frequency: 5000, rolloff: -12 });
  private readonly sciBus = new Tone.Gain(1);
  private readonly sciSend = new Tone.Gain(0.15);

  private readonly cinFilter = new Tone.Filter({ type: "lowpass", frequency: 1800, rolloff: -24 });
  private readonly cinBus = new Tone.Gain(Tone.dbToGain(CINEMATIC_LEVEL_DB));
  private readonly cinSend = new Tone.Gain(0.55);
  readonly stringsFilter = new Tone.Filter({ type: "lowpass", frequency: 700, rolloff: -24 });

  scientific!: Record<ScientificTimbre, Voice>;
  pad!: Tone.PolySynth;
  strings!: Tone.PolySynth;
  cinematicPiano!: Voice;

  /** Set when piano samples could not be loaded and a synth fallback is in use. */
  sampleWarning: string | null = null;
  private readonly owned: Tone.ToneAudioNode[] = [];
  private buffers: Tone.ToneAudioBuffers | null = null;

  constructor() {
    this.master.chain(this.limiter, Tone.getDestination());
    this.reverb.connect(this.master);

    this.sciPanner.chain(this.sciFilter, this.sciBus, this.master);
    this.sciBus.connect(this.sciSend);
    this.sciSend.connect(this.reverb);

    this.cinFilter.chain(this.cinBus, this.master);
    this.cinBus.connect(this.cinSend);
    this.cinSend.connect(this.reverb);
    this.stringsFilter.connect(this.cinFilter);

    this.owned.push(
      this.master,
      this.limiter,
      this.reverb,
      this.sciPanner,
      this.sciFilter,
      this.sciBus,
      this.sciSend,
      this.cinFilter,
      this.cinBus,
      this.cinSend,
      this.stringsFilter,
    );
  }

  /** Loads samples and builds the instruments. Never rejects: falls back to synthesis. */
  async load(): Promise<void> {
    await this.reverb.ready;

    let pianoFactory: () => Voice;
    try {
      const buffers = await this.loadPianoBuffers();
      this.buffers = buffers;
      // Raw AudioBuffers: each Sampler wraps its own copy-free reference, so
      // disposing one Sampler never invalidates the other's buffers.
      const urls = Object.fromEntries(
        PIANO_NOTES.map((note) => [note.replace("s", "#"), buffers.get(note).get()!]),
      );
      pianoFactory = () => this.own(new Tone.Sampler({ urls, release: 1.2 }));
    } catch (error) {
      this.sampleWarning = `Piano samples unavailable (${(error as Error).message}). Using a synthesised fallback piano.`;
      pianoFactory = () =>
        this.own(
          new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "triangle" },
            envelope: { attack: 0.005, decay: 1.2, sustain: 0.05, release: 0.8 },
          }),
        );
    }

    const bell = this.own(
      new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3,
        modulationIndex: 1.2,
        oscillator: { type: "sine" },
        envelope: { attack: 0.004, decay: 1.1, sustain: 0.04, release: 0.9 },
        modulation: { type: "sine" },
        modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.4 },
      }),
    );
    bell.volume.value = -6;
    const glass = this.own(
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sine" },
        envelope: { attack: 0.03, decay: 0.6, sustain: 0.25, release: 0.7 },
      }),
    );
    glass.volume.value = -4;
    const sciPiano = pianoFactory() as Voice & Tone.ToneAudioNode;
    this.scientific = { piano: sciPiano, bell, glass };
    for (const voice of [sciPiano, bell, glass]) voice.connect(this.sciPanner);

    this.pad = this.own(
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "fattriangle", count: 3, spread: 18 },
        envelope: { attack: 2.2, decay: 1, sustain: 0.8, release: 3.5 },
      }),
    );
    this.pad.volume.value = -14;
    this.pad.connect(this.cinFilter);

    this.strings = this.own(
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "fatsawtooth", count: 3, spread: 22 },
        envelope: { attack: 1.6, decay: 0.8, sustain: 0.85, release: 3 },
      }),
    );
    this.strings.volume.value = -22;
    this.strings.connect(this.stringsFilter);

    const cinPiano = pianoFactory() as Voice & Tone.ToneAudioNode;
    cinPiano.connect(this.cinFilter);
    this.cinematicPiano = cinPiano;
  }

  setScientificPan(pan: number, time: number) {
    this.sciPanner.pan.rampTo(pan, 0.08, time);
  }

  setLayerEnabled(layer: LayerName, enabled: boolean) {
    const bus = layer === "scientific" ? this.sciBus : this.cinBus;
    const target = layer === "scientific" ? 1 : Tone.dbToGain(CINEMATIC_LEVEL_DB);
    bus.gain.rampTo(enabled ? target : 0, 0.2);
  }

  /** volume 0..1 (linear amplitude). */
  setVolume(volume: number) {
    this.master.mute = volume <= 0;
    if (volume > 0) this.master.volume.rampTo(Tone.gainToDb(volume), 0.1);
  }

  releaseAll() {
    const now = Tone.now();
    for (const voice of [
      ...Object.values(this.scientific ?? {}),
      this.pad,
      this.strings,
      this.cinematicPiano,
    ]) {
      voice?.releaseAll(now);
    }
  }

  dispose() {
    for (const node of this.owned) node.dispose();
    this.owned.length = 0;
    this.buffers?.dispose();
  }

  private own<T extends Tone.ToneAudioNode>(node: T): T {
    // Bounded polyphony. 12 covers the worst case (2× speed: ~7 overlapping
    // scientific notes incl. release tails) so no data note is ever dropped.
    if (node instanceof Tone.PolySynth) node.maxPolyphony = 12;
    this.owned.unshift(node); // dispose sources before the effects they feed
    return node;
  }

  private loadPianoBuffers(): Promise<Tone.ToneAudioBuffers> {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("timed out")), SAMPLE_TIMEOUT_MS);
      const buffers: Tone.ToneAudioBuffers = new Tone.ToneAudioBuffers({
        urls: Object.fromEntries(PIANO_NOTES.map((note) => [note, `${note}.mp3`])),
        baseUrl: `${import.meta.env.BASE_URL}samples/piano/`,
        onload: () => {
          window.clearTimeout(timer);
          resolve(buffers);
        },
        onerror: (error) => {
          window.clearTimeout(timer);
          buffers.dispose();
          reject(error);
        },
      });
    });
  }
}
