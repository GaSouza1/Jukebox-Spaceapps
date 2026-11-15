/**
 * InstrumentManager — owns every Tone.js node used by the sonification:
 * instruments, the two layer buses, shared reverb and the master chain.
 *
 *   scientific voices → Panner → Filter(5 kHz) → sciBus ─┬─────────────→ master
 *                                                       └→ send 0.15 → Reverb ┘
 *   cinematic voices  → Filter(1.8 kHz) → cinBus ───────┬─────────────→ master
 *     (strings → Filter → Panner; piano figures → Panner; drone, pad, bass direct)
 *                                                       └→ send 0.55 → Reverb ┘
 *   master = Volume → Limiter(−1 dB) → Destination
 */
import * as Tone from "tone";
import type { CinematicTone } from "./cinematicComposer";
import type { ScientificTimbre } from "./dataMapper";
import type { VoiceTimbre } from "./score";

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
/** Level difference between the quietest and the fullest moment of the composition. */
const CINEMATIC_DYNAMIC_RANGE_DB = 9;

export type LayerName = "scientific" | "cinematic";

export interface InstrumentOptions {
  /**
   * Load the sampled piano (1.2 MB). The region comparison only uses synthesised
   * voices, so it skips the download; the piano is then synthesised, with no warning.
   */
  loadSamples?: boolean;
}

type Factory = () => Voice & Tone.ToneAudioNode;
interface Channel {
  panner: Tone.Panner;
  voices: Partial<Record<VoiceTimbre, Voice>>;
}

/** Channel of the image's scientific voice (the original sciPanner). */
export const MAIN_CHANNEL = "main";

export class InstrumentManager {
  readonly master = new Tone.Volume(0);
  private readonly limiter = new Tone.Limiter(-1);
  private readonly reverb = new Tone.Reverb({ decay: 6, preDelay: 0.03, wet: 1 });

  private readonly sciPanner = new Tone.Panner(0);
  private readonly sciFilter = new Tone.Filter({ type: "lowpass", frequency: 5000, rolloff: -12 });
  private readonly sciBus = new Tone.Gain(1);
  private readonly sciSend = new Tone.Gain(0.15);

  private readonly cinFilter = new Tone.Filter({ type: "lowpass", frequency: 1800, rolloff: -24 });
  /** Follows the composition's intensity curve; separate from cinBus (the layer toggle). */
  private readonly cinDynamics = new Tone.Gain(Tone.dbToGain(CINEMATIC_DYNAMIC_RANGE_DB * -0.8));
  private readonly cinBus = new Tone.Gain(Tone.dbToGain(CINEMATIC_LEVEL_DB));
  private readonly cinSend = new Tone.Gain(0.55);
  readonly stringsFilter = new Tone.Filter({ type: "lowpass", frequency: 700, rolloff: -24 });
  private readonly stringsPanner = new Tone.Panner(-0.25);
  private readonly figuresPanner = new Tone.Panner(0);

  scientific!: Record<ScientificTimbre, Voice>;
  pad!: Tone.PolySynth;
  strings!: Tone.PolySynth;
  cinematicPiano!: Voice;
  /** Second piano voice for the sparse figures, panned on its own so the bass stays centred. */
  cinematicFigures!: Voice;
  drone!: Tone.PolySynth;
  /** Short bright plucks above the scientific band (energetic profile). */
  glint!: Tone.PolySynth;

  /** Set when piano samples could not be loaded and a synth fallback is in use. */
  sampleWarning: string | null = null;
  private readonly owned: Tone.ToneAudioNode[] = [];
  private buffers: Tone.ToneAudioBuffers | null = null;
  private readonly loadSamples: boolean;
  /** Builds one instrument of each scientific timbre; set by load(). */
  private factories: Record<VoiceTimbre, Factory> | null = null;
  /**
   * One panner per score voice, each with its own instruments, all feeding the
   * scientific filter and bus: two regions keep fixed, independent places.
   */
  private readonly channels = new Map<string, Channel>();

  constructor({ loadSamples = true }: InstrumentOptions = {}) {
    this.loadSamples = loadSamples;
    this.master.chain(this.limiter, Tone.getDestination());
    this.reverb.connect(this.master);

    this.sciPanner.chain(this.sciFilter, this.sciBus, this.master);
    this.sciBus.connect(this.sciSend);
    this.sciSend.connect(this.reverb);

    this.cinFilter.chain(this.cinDynamics, this.cinBus, this.master);
    this.cinBus.connect(this.cinSend);
    this.cinSend.connect(this.reverb);
    this.stringsFilter.chain(this.stringsPanner, this.cinFilter);
    this.figuresPanner.connect(this.cinFilter);

    this.owned.push(
      this.master,
      this.limiter,
      this.reverb,
      this.sciPanner,
      this.sciFilter,
      this.sciBus,
      this.sciSend,
      this.cinFilter,
      this.cinDynamics,
      this.cinBus,
      this.cinSend,
      this.stringsFilter,
      this.stringsPanner,
      this.figuresPanner,
    );
  }

  /** Loads samples and builds the instruments. Never rejects: falls back to synthesis. */
  async load(): Promise<void> {
    await this.reverb.ready;

    const synthPiano: Factory = () =>
      this.own(
        new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "triangle" },
          envelope: { attack: 0.005, decay: 1.2, sustain: 0.05, release: 0.8 },
        }),
      );
    let pianoFactory: Factory = synthPiano;
    if (this.loadSamples) {
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
      }
    }

    const bellFactory: Factory = () => {
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
      return bell;
    };
    // Soft sine: the image's "neutral" voice and Region A of the comparison.
    const glassFactory: Factory = () => {
      const glass = this.own(
        new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "sine" },
          envelope: { attack: 0.03, decay: 0.6, sustain: 0.25, release: 0.7 },
        }),
      );
      glass.volume.value = -4;
      return glass;
    };
    // Brighter triangle: Region B of the comparison. A few dB lower than the
    // sine because its harmonics make it sound louder at the same level.
    const triangleFactory: Factory = () => {
      const triangle = this.own(
        new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "triangle" },
          envelope: { attack: 0.01, decay: 0.25, sustain: 0.45, release: 0.5 },
        }),
      );
      triangle.volume.value = -7;
      return triangle;
    };
    this.factories = {
      piano: pianoFactory,
      bell: bellFactory,
      glass: glassFactory,
      triangle: triangleFactory,
    };

    const bell = bellFactory();
    const glass = glassFactory();
    const sciPiano = pianoFactory();
    this.scientific = { piano: sciPiano, bell, glass };
    for (const voice of [sciPiano, bell, glass]) voice.connect(this.sciPanner);
    this.channels.set(MAIN_CHANNEL, { panner: this.sciPanner, voices: { ...this.scientific } });

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

    const figures = pianoFactory() as Voice & Tone.ToneAudioNode;
    figures.connect(this.figuresPanner);
    this.cinematicFigures = figures;

    // Low, slow sine drone: depth under the introduction and the close.
    this.drone = this.own(
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sine" },
        envelope: { attack: 3, decay: 1, sustain: 0.9, release: 4 },
      }),
    );
    this.drone.volume.value = -24;
    this.drone.connect(this.cinFilter);

    // Triangle pluck: unlike the scientific piano, FM bell and sustained sine.
    this.glint = this.own(
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.004, decay: 0.35, sustain: 0, release: 0.5 },
      }),
    );
    this.glint.volume.value = -16;
    this.glint.connect(this.figuresPanner);
  }

  setScientificPan(pan: number, time: number) {
    this.sciPanner.pan.rampTo(pan, 0.08, time);
  }

  /**
   * Creates the channel of a score voice if needed, with the instruments it
   * will use, before playback starts (never inside the Transport callback).
   * `pan` places a new channel; `fixedPan` also moves an existing one.
   */
  prepareChannel(id: string, pan: number, timbres: VoiceTimbre[], fixedPan: boolean) {
    let channel = this.channels.get(id);
    if (!channel) {
      const panner = new Tone.Panner(pan);
      panner.connect(this.sciFilter);
      this.owned.push(panner);
      channel = { panner, voices: {} };
      this.channels.set(id, channel);
    } else if (fixedPan) {
      channel.panner.pan.cancelScheduledValues(0);
      channel.panner.pan.value = pan;
    }
    for (const timbre of timbres) this.voiceIn(channel, timbre);
  }

  /** The instrument of a timbre on a channel (created by prepareChannel). */
  channelVoice(id: string, timbre: VoiceTimbre): Voice {
    const channel = this.channels.get(id);
    if (!channel) throw new Error(`Unknown sound channel "${id}".`);
    return this.voiceIn(channel, timbre);
  }

  setChannelPan(id: string, pan: number, time: number) {
    this.channels.get(id)?.panner.pan.rampTo(pan, 0.08, time);
  }

  private voiceIn(channel: Channel, timbre: VoiceTimbre): Voice {
    const existing = channel.voices[timbre];
    if (existing) return existing;
    if (!this.factories) throw new Error("Instruments are not loaded yet.");
    const voice = this.factories[timbre]();
    voice.connect(channel.panner);
    channel.voices[timbre] = voice;
    return voice;
  }

  /**
   * Glides the cinematic level to the given intensity (0..1) over `seconds`,
   * so the arc of the composition is heard whatever the chord lengths.
   */
  setCinematicIntensity(intensity: number, seconds: number, time: number) {
    const target = Tone.dbToGain(-CINEMATIC_DYNAMIC_RANGE_DB * (1 - intensity));
    this.cinDynamics.gain.cancelScheduledValues(time);
    this.cinDynamics.gain.linearRampTo(target, Math.max(0.1, seconds), time);
  }

  /**
   * Glides the cinematic timbre (bus and strings filters, reverb send) over
   * `seconds`, and sets the pad and strings envelopes for the notes to come.
   * Used at each chord, so a profile change between images is gradual.
   */
  setCinematicTone(tone: CinematicTone, seconds: number, time: number) {
    const glide = Math.max(0.1, seconds);
    this.cinFilter.frequency.cancelScheduledValues(time);
    this.cinFilter.frequency.exponentialRampTo(tone.cutoff, glide, time);
    this.cinSend.gain.cancelScheduledValues(time);
    this.cinSend.gain.linearRampTo(tone.reverbSend, glide, time);
    this.stringsBase = tone.stringsCutoff;
    this.pad.set({ envelope: { attack: tone.padAttack, release: tone.padRelease } });
    this.strings.set({ envelope: { attack: tone.stringsAttack } });
  }

  /** Strings low-pass of the current profile, Hz. */
  stringsBase = 700;

  setStringsPan(pan: number, time: number) {
    this.stringsPanner.pan.rampTo(pan, 1.5, time);
  }

  setFiguresPan(pan: number, time: number) {
    this.figuresPanner.pan.rampTo(pan, 0.05, time);
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
      ...[...this.channels.values()].flatMap((channel) => Object.values(channel.voices)),
      this.pad,
      this.strings,
      this.cinematicPiano,
      this.cinematicFigures,
      this.drone,
      this.glint,
    ]) {
      voice?.releaseAll(now);
    }
  }

  dispose() {
    for (const node of this.owned) node.dispose();
    this.owned.length = 0;
    this.channels.clear();
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
