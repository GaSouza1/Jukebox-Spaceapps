/**
 * ScientificLayer — plays a SonificationScore: at each step, one note per
 *                   voice (null = silence), exact values, no quantisation.
 *                   Each voice sounds on its own InstrumentManager channel.
 * CinematicLayer  — plays the evolving background planned by cinematicComposer;
 *                   it gets no data and never touches the scientific voices,
 *                   their pitch, timing or level.
 */
import * as Tone from "tone";
import {
  intensityAt,
  type ChordSpan,
  type CinematicEvent,
  type CinematicPlan,
} from "./cinematicComposer";
import type { InstrumentManager } from "./instrumentManager";
import type { SonificationScore } from "./score";

/** Notes last 90 % of a step so consecutive events never smear into each other. */
const NOTE_LENGTH = 0.9;

export class ScientificLayer {
  constructor(
    private readonly instruments: InstrumentManager,
    private readonly score: SonificationScore,
  ) {}

  play(stepIndex: number, time: number, stepSeconds: number) {
    for (const voice of this.score.voices) {
      const note = voice.notes[stepIndex];
      if (!note) continue;
      if (note.pan !== undefined) this.instruments.setChannelPan(voice.id, note.pan, time);
      this.instruments
        .channelVoice(voice.id, note.timbre ?? voice.timbre)
        .triggerAttackRelease(note.frequency, stepSeconds * NOTE_LENGTH, time, note.velocity);
    }
  }
}

/** One bar of 4/4 in eighth-note steps. */
const BAR_STEPS = 8;
const toHz = (notes: number[]) => notes.map((midi) => Tone.mtof(midi as Tone.Unit.MidiNote));

/**
 * Plays a CinematicPlan on the shared Transport clock: each step triggers the
 * events planned for it (sub-step events are offset inside the step), with
 * durations converted at the current tempo, so speed changes, pause and
 * resume follow the same clock as the data notes. Nothing is scheduled beyond
 * the current step.
 */
export class CinematicLayer {
  /** When true, the next step re-voices the chord in progress (after a resume). */
  private needsResync = true;
  private readonly byStep = new Map<number, CinematicEvent[]>();
  private readonly chordStarts = new Map<number, ChordSpan>();
  private readonly instruments: InstrumentManager;
  private readonly plan: CinematicPlan;

  constructor(instruments: InstrumentManager, plan: CinematicPlan) {
    this.instruments = instruments;
    this.plan = plan;
    for (const chord of plan.chords) this.chordStarts.set(chord.start, chord);
    for (const event of plan.events) {
      const list = this.byStep.get(event.step) ?? [];
      list.push(event);
      this.byStep.set(event.step, list);
    }
  }

  resync() {
    this.needsResync = true;
  }

  play(stepIndex: number, time: number, stepSeconds: number) {
    if (this.needsResync) {
      this.needsResync = false;
      this.revoice(stepIndex, time, stepSeconds);
    }
    // Level follows the intensity curve bar by bar, whatever the chord lengths
    // (a contemplative image has only 3–4 long chords).
    if (stepIndex % BAR_STEPS === 0) {
      const ahead = (stepIndex + BAR_STEPS) / this.plan.totalSteps;
      this.instruments.setCinematicIntensity(intensityAt(ahead), BAR_STEPS * stepSeconds, time);
    }
    const chord = this.chordStarts.get(stepIndex);
    // Timbre glides over each chord, so profile changes are never sudden.
    if (chord) this.instruments.setCinematicTone(chord.tone, chord.steps * stepSeconds, time);
    for (const event of this.byStep.get(stepIndex) ?? []) {
      this.trigger(event, event.steps, time + event.offset * stepSeconds, stepSeconds);
    }
  }

  /** After a pause: level, timbre and the sustained textures of the current chord. */
  private revoice(stepIndex: number, time: number, stepSeconds: number) {
    const chord = this.plan.chords.find(
      (c) => stepIndex > c.start && stepIndex < c.start + c.steps,
    );
    if (!chord) return; // on a chord change the planned events voice it anyway
    const remaining = chord.start + chord.steps - stepIndex;
    this.instruments.setCinematicIntensity(
      intensityAt(stepIndex / this.plan.totalSteps),
      0.5,
      time,
    );
    // Come back promptly: a contemplative pad would otherwise take 3 s to fade in.
    this.instruments.setCinematicTone(
      { ...chord.tone, padAttack: 0.3, stringsAttack: 0.3 },
      0.5,
      time,
    );
    for (const event of this.byStep.get(chord.start) ?? []) {
      if (event.voice === "pad" || event.voice === "strings" || event.voice === "drone") {
        this.trigger(event, Math.min(event.steps, remaining), time, stepSeconds);
      }
    }
    // Envelopes are read when a note starts, so the profile's can be restored now.
    this.instruments.setCinematicTone(chord.tone, remaining * stepSeconds, time);
  }

  private trigger(event: CinematicEvent, steps: number, time: number, stepSeconds: number) {
    const seconds = steps * stepSeconds;
    const { pad, strings, stringsFilter, drone, glint, cinematicPiano, cinematicFigures } =
      this.instruments;
    switch (event.voice) {
      case "pad":
        pad.triggerAttackRelease(toHz(event.notes), seconds, time, event.velocity);
        break;
      case "strings":
        this.instruments.setStringsPan(event.pan, time);
        // Each phrase opens the strings a little more with the level of the moment.
        stringsFilter.frequency.rampTo(
          this.instruments.stringsBase * (0.7 + event.velocity),
          Math.max(0.1, seconds * 0.5),
          time,
        );
        strings.triggerAttackRelease(toHz(event.notes), seconds, time, event.velocity);
        break;
      case "drone":
        drone.triggerAttackRelease(toHz(event.notes), seconds, time, event.velocity);
        break;
      case "bass":
        cinematicPiano.triggerAttackRelease(toHz(event.notes)[0], seconds, time, event.velocity);
        break;
      case "piano":
        this.instruments.setFiguresPan(event.pan, time);
        cinematicFigures.triggerAttackRelease(toHz(event.notes)[0], seconds, time, event.velocity);
        break;
      case "glint":
        this.instruments.setFiguresPan(event.pan, time);
        glint.triggerAttackRelease(toHz(event.notes)[0], seconds, time, event.velocity);
        break;
    }
  }
}
