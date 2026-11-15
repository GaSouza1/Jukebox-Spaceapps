/**
 * SonificationScore — the neutral contract between "where the data comes
 * from" and "how it is played". The image (imageScore.ts) and the region
 * comparison (comparisonScore.ts) both produce one; PlaybackController plays
 * any score on the shared Transport, ScientificLayer and InstrumentManager.
 *
 * A score is fully computed before playback: the Transport callback only
 * reads `voices[v].notes[step]`, so nothing is processed while it plays.
 */

/** Pitch range of the scientific voices: C4 → C6. The cinematic layer stays outside it. */
export const PITCH_FLOOR_HZ = 261.63;
export const PITCH_OCTAVES = 2;

/** piano (sampled), bell (FM), glass (soft sine) and triangle; see InstrumentManager. */
export type VoiceTimbre = "piano" | "bell" | "glass" | "triangle";

export interface ScoreNote {
  /** Continuous frequency in Hz, never snapped to a scale. */
  frequency: number;
  /** 0..1 */
  velocity: number;
  /** Per-note pan (the image moves its voice); voices with a fixed place omit it. */
  pan?: number;
  /** Per-note timbre (the image follows the colour family); defaults to the voice's. */
  timbre?: VoiceTimbre;
}

export interface ScoreVoice {
  /** Also the InstrumentManager channel: each voice has its own panner. */
  id: string;
  timbre: VoiceTimbre;
  /** Initial (and, for fixed voices, permanent) stereo position, −1..1. */
  pan: number;
  /** One entry per step; null is a silence (missing value or voice not heard). */
  notes: (ScoreNote | null)[];
}

export interface SonificationScore {
  stepCount: number;
  /** Seconds per step at 1× speed. */
  stepSeconds: number;
  voices: ScoreVoice[];
  /** Mood of the cinematic background (0..1), or null to leave it out. */
  cinematic: { energy: number } | null;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * 0..1 → frequency, linear in octaves: equal steps in the data are equal
 * musical intervals (equal ratios of frequency), which is how pitch is heard.
 */
export function normToFrequency(norm: number, floorHz = PITCH_FLOOR_HZ, octaves = PITCH_OCTAVES) {
  return floorHz * 2 ** (octaves * clamp01(norm));
}

/** Transport tempo for a step length: one step is one eighth note. */
export function bpmFor(stepSeconds: number, speed = 1) {
  return (60 / (2 * stepSeconds)) * speed;
}

/** Index of the first step at or after `index`, inside the score. */
export function clampStep(score: Pick<SonificationScore, "stepCount">, index: number) {
  return Math.min(Math.max(0, Math.round(index)), Math.max(0, score.stepCount - 1));
}

/** Every timbre a voice can use, so its instruments are built before playback starts. */
export function timbresOf(voice: ScoreVoice): VoiceTimbre[] {
  const set = new Set<VoiceTimbre>([voice.timbre]);
  for (const note of voice.notes) if (note?.timbre) set.add(note.timbre);
  return [...set];
}
