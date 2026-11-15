/**
 * ScientificLayer — one note per data step, exact mapped values, no quantisation.
 * CinematicLayer  — slow consonant harmony underneath; never touches the
 *                   scientific voices, their pitch, timing or level.
 */
import * as Tone from "tone";
import { SECTION_LENGTH, type CinematicSection, type ScientificEvent } from "./dataMapper";
import type { InstrumentManager } from "./instrumentManager";

/** Notes last 90 % of a step so consecutive events never smear into each other. */
const NOTE_LENGTH = 0.9;

export class ScientificLayer {
  constructor(private readonly instruments: InstrumentManager) {}

  play(event: ScientificEvent, time: number, stepSeconds: number) {
    this.instruments.setScientificPan(event.pan, time);
    this.instruments.scientific[event.timbre].triggerAttackRelease(
      event.frequency,
      stepSeconds * NOTE_LENGTH,
      time,
      event.velocity,
    );
  }
}

interface Chord {
  name: string;
  /** MIDI note for the low piano bass. */
  bass: number;
  /** MIDI notes for pad/strings, all kept below C4 (the scientific floor). */
  tones: number[];
}

/**
 * Diatonic chords of C major / A minor ordered from darker (minor) to brighter
 * (major). Close voicings with shared tones give smooth voice-leading.
 */
const CHORD_LADDER: Chord[] = [
  { name: "Am", bass: 45, tones: [48, 52, 57] },
  { name: "Em", bass: 40, tones: [47, 52, 55] },
  { name: "Dm", bass: 38, tones: [50, 53, 57] },
  { name: "F", bass: 41, tones: [48, 53, 57] },
  { name: "C", bass: 36, tones: [48, 52, 55] },
  { name: "G", bass: 43, tones: [47, 50, 55] },
];

export function chordForSection(section: CinematicSection): Chord {
  return CHORD_LADDER[Math.round(section.brightnessRank * (CHORD_LADDER.length - 1))];
}

export class CinematicLayer {
  /** When true, the next step re-voices the current chord (after a resume). */
  private needsResync = true;

  constructor(
    private readonly instruments: InstrumentManager,
    private readonly sections: CinematicSection[],
  ) {}

  resync() {
    this.needsResync = true;
  }

  play(stepIndex: number, time: number, stepSeconds: number) {
    const section = this.sections[Math.floor(stepIndex / SECTION_LENGTH)];
    if (!section) return;
    const offset = stepIndex - section.startStep;
    const chord = chordForSection(section);

    if (offset === 0 || this.needsResync) {
      this.needsResync = false;
      const seconds = (SECTION_LENGTH - offset) * stepSeconds;
      const tones = chord.tones.map((midi) => Tone.mtof(midi as Tone.Unit.MidiNote));
      const { pad, strings, stringsFilter, cinematicPiano } = this.instruments;

      pad.triggerAttackRelease(tones, seconds, time, 0.55);
      // Local data variability opens the strings: calm data → just the pad.
      stringsFilter.frequency.rampTo(450 + 1100 * section.activity, seconds * 0.5, time);
      strings.triggerAttackRelease(tones, seconds, time, 0.12 + 0.45 * section.activity);
      if (offset === 0) {
        cinematicPiano.triggerAttackRelease(
          Tone.mtof(chord.bass as Tone.Unit.MidiNote),
          seconds,
          time,
          0.28,
        );
      }
    } else if (offset === SECTION_LENGTH / 2) {
      this.instruments.cinematicPiano.triggerAttackRelease(
        Tone.mtof((chord.bass + 7) as Tone.Unit.MidiNote),
        (SECTION_LENGTH / 2) * stepSeconds,
        time,
        0.18,
      );
    }
  }
}
