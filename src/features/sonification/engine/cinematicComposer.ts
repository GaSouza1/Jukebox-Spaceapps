/**
 * CinematicComposer — plans the background music of one image, step by step,
 * before it plays. It is a pure function of the duration in steps, two seeds
 * and one number, `energy` (0 = contemplative, 1 = energetic), chosen by
 * cinematicProfile.ts as an artistic mood. It never sees the analysis, so it
 * cannot carry, echo or distort data; that is the Scientific layer's job.
 *
 * Two contrasting profiles, blended continuously by `energy`:
 *
 *                      contemplative (0)            energetic (1)
 *   harmonic rhythm    24–32 steps per chord        6–10 steps per chord
 *   motion             sustained notes, rare piano  arpeggio pulse, 16th pairs
 *   register           pad A1–E3, drone, low bass   pad C3–B3, glints D6–A6
 *   harmony            i, iv, v, minor 7ths         III, VI, VII, add9 colours
 *   timbre             dark filter, slow envelopes  open filter, quick envelopes
 *   space              more reverb                  drier
 *
 * The Transport clock is shared with the data notes (one slice per step), so
 * "tempo" here is the density of events on that clock, never a BPM change:
 * the scientific timing is untouched.
 *
 * No cinematic note falls in the scientific band (C4–C6, MIDI 60–84): low
 * voices stay ≤ B3 and the energetic glints sit at D6 or above.
 *
 * Inside a profile, the music still evolves: five phases proportional to the
 * duration, an intensity curve, a progression that avoids repeating patterns,
 * smooth voice leading and textures that enter and leave.
 *
 * Same inputs → same plan, so pause / resume never changes it.
 */

/** Highest note of the low cinematic voices: B3, just under C4 (the scientific floor). */
export const CINEMATIC_CEILING_MIDI = 59;
/** Lowest note of the energetic glints: D6, above C6 (the scientific top). */
export const GLINT_FLOOR_MIDI = 86;
const GLINT_CEILING_MIDI = 93; // A6
/** One bar of 4/4 in eighth-note steps. */
const BAR = 8;

export type CinematicPhase =
  | "introduction"
  | "development"
  | "expansion"
  | "transition"
  | "continuity";

/** Phase ends as a fraction of the duration. */
export const PHASES: { name: CinematicPhase; end: number }[] = [
  { name: "introduction", end: 0.15 },
  { name: "development", end: 0.42 },
  { name: "expansion", end: 0.68 },
  { name: "transition", end: 0.84 },
  { name: "continuity", end: 1 },
];

/**
 * Intensity (0..1) at fractions of the duration; linear in between. The peak
 * sits early in the expansion because pads and strings attack slowly and ring
 * for seconds: what is heard lags the plan by a few seconds.
 */
const INTENSITY: [number, number][] = [
  [0, 0.2],
  [0.15, 0.35],
  [0.4, 0.62],
  [0.52, 0.85],
  [0.66, 0.6],
  [0.8, 0.4],
  [1, 0.3],
];

/** Event density per phase, on top of the profile. */
const PHASE_DENSITY: Record<CinematicPhase, number> = {
  introduction: 0.4,
  development: 0.8,
  expansion: 1.2,
  transition: 0.6,
  continuity: 0.5,
};

/** Share of the duration over which the energy glides from the previous image. */
const ENERGY_GLIDE = 0.25;

/** Natural minor (Aeolian) steps, from the tonic. */
const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];
/** Usable chord degrees (the diminished ii° is left out). */
type Degree = "i" | "III" | "iv" | "v" | "VI" | "VII";
const DEGREE_INDEX: Record<Degree, number> = { i: 0, III: 2, iv: 3, v: 4, VI: 5, VII: 6 };
/** Contemplative moves: stay close to the minor chords, plagal and modal motion. */
const DARK_MOVES: Record<Degree, Partial<Record<Degree, number>>> = {
  i: { iv: 4, VI: 3, v: 2, VII: 1, III: 1 },
  III: { iv: 2, VI: 2, i: 2, VII: 1 },
  iv: { i: 4, v: 2, VI: 1, VII: 1 },
  v: { i: 4, iv: 2, VI: 1 },
  VI: { iv: 3, i: 2, v: 1, VII: 1, III: 1 },
  VII: { i: 3, iv: 2, VI: 1, III: 1 },
};
/** Energetic moves: lean on the major chords (III, VI, VII), more root movement. */
const BRIGHT_MOVES: Record<Degree, Partial<Record<Degree, number>>> = {
  i: { VI: 3, VII: 3, III: 3, iv: 1, v: 1 },
  III: { VII: 3, VI: 3, iv: 2, i: 1 },
  iv: { VII: 4, v: 2, i: 1, III: 1 },
  v: { VI: 3, i: 2, III: 1 },
  VI: { VII: 4, III: 3, iv: 1, i: 1 },
  VII: { III: 4, i: 3, VI: 2 },
};
/** Tonal centres (pitch class, name). One is picked per session. */
const KEYS: { pc: number; name: string }[] = [
  { pc: 9, name: "A minor" },
  { pc: 2, name: "D minor" },
  { pc: 4, name: "E minor" },
  { pc: 7, name: "G minor" },
  { pc: 0, name: "C minor" },
];

export type CinematicVoice = "drone" | "pad" | "strings" | "bass" | "piano" | "glint";

export interface CinematicEvent {
  step: number;
  /** Fraction of a step after `step` (0 or 0.5): sixteenth notes in the energetic profile. */
  offset: number;
  voice: CinematicVoice;
  /** MIDI notes, never inside the scientific band (60–84). */
  notes: number[];
  /** Length in steps; converted to seconds at the current tempo when played. */
  steps: number;
  velocity: number;
  /** Stereo position, −1..1 (moderate values only). */
  pan: number;
}

/** Timbre settings of one chord, glided to over the chord. */
export interface CinematicTone {
  /** Cinematic bus low-pass, Hz. */
  cutoff: number;
  /** Strings low-pass, Hz. */
  stringsCutoff: number;
  /** Send from the cinematic bus to the shared reverb. */
  reverbSend: number;
  padAttack: number;
  padRelease: number;
  stringsAttack: number;
}

export interface ChordSpan {
  start: number;
  steps: number;
  degree: Degree;
  voicing: number[];
  phase: CinematicPhase;
  intensity: number;
  /** Energy of this chord (glides from the previous image at the start). */
  energy: number;
  strings: boolean;
  tone: CinematicTone;
}

export interface CinematicPlan {
  key: string;
  totalSteps: number;
  /** Target energy of this image. */
  energy: number;
  chords: ChordSpan[];
  /** Sorted by step and offset. */
  events: CinematicEvent[];
}

/** What the next image of the session continues from. */
export interface CinematicContinuation {
  energy: number;
  voicing: number[];
  degree: Degree;
}

export interface ComposeOptions {
  totalSteps: number;
  /** Fixed for a playback session: the tonal identity. */
  identitySeed: number;
  /** Index of this image within the session: varies the material. */
  movement: number;
  /** 0 = contemplative, 1 = energetic (from cinematicProfile). */
  energy: number;
  /** End of the previous image in the session, if any. */
  previous?: CinematicContinuation | null;
}

/** Small, fast, deterministic PRNG (mulberry32). */
export function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function phaseAt(fraction: number): CinematicPhase {
  return (PHASES.find((phase) => fraction < phase.end) ?? PHASES[PHASES.length - 1]).name;
}

export function intensityAt(fraction: number): number {
  const t = clamp01(fraction);
  for (let i = 1; i < INTENSITY.length; i++) {
    const [x1, y1] = INTENSITY[i];
    const [x0, y0] = INTENSITY[i - 1];
    if (t <= x1) return y0 + ((y1 - y0) * (t - x0)) / (x1 - x0);
  }
  return INTENSITY[INTENSITY.length - 1][1];
}

/** Every musical parameter of the two profiles, interpolated by energy. */
export function profileParameters(energy: number) {
  const e = clamp01(energy);
  return {
    chordSteps: [Math.round(lerp(24, 6, e)), Math.round(lerp(32, 10, e))] as const,
    /** Lowest note of the pad voicing. */
    voicingLow: Math.round(lerp(33, 48, e)),
    /** Highest note of the pad voicing. */
    voicingHigh: Math.round(lerp(52, CINEMATIC_CEILING_MIDI, e)),
    /** Chance per step of an arpeggio note. */
    pulse: lerp(0, 0.55, e),
    /** Chance that a pulse note gets a sixteenth-note partner. */
    sixteenths: Math.max(0, lerp(-0.3, 0.35, e)),
    /** Occasional low piano notes per chord. */
    lowFigures: lerp(1.2, 0, e),
    /** Length of piano notes, steps. */
    figureSteps: lerp(8, 1, e),
    /** Chance per step of a high glint. */
    glint: e > 0.35 ? lerp(0, 0.3, (e - 0.35) / 0.65) : 0,
    /** Chance that an arpeggio note is doubled in the glint register. */
    sparkle: e > 0.5 ? lerp(0, 0.35, (e - 0.5) / 0.5) : 0,
    /** Bass: lower and fuller when contemplative, lighter and higher when energetic. */
    bassLow: Math.round(lerp(28, 40, e)),
    bassLevel: lerp(1, 0.55, e),
    /** Drone level scale (0 = none). */
    drone: Math.max(0, lerp(1, -0.4, e)),
    padVelocity: lerp(0.55, 0.22, e),
    /** Strings re-articulate every this many steps (Infinity = sustained). */
    stringsPulse: e > 0.5 ? Math.round(lerp(8, 4, (e - 0.5) / 0.5)) : Infinity,
    /** Weight of the major-leaning moves (energetic table). */
    brightness: e,
    tone: {
      cutoff: Math.round(lerp(800, 4200, e)),
      stringsCutoff: Math.round(lerp(350, 1500, e)),
      reverbSend: round(lerp(0.75, 0.35, e)),
      padAttack: round(lerp(3.2, 0.5, e)),
      padRelease: round(lerp(5, 1.6, e)),
      stringsAttack: round(lerp(2.5, 0.3, e)),
    } satisfies CinematicTone,
  };
}

function pickWeighted<T>(rng: () => number, options: [T, number][]): T {
  const total = options.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng() * total;
  for (const [value, weight] of options) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return options[options.length - 1][0];
}

/** Pitch classes of the triad on `degree`, plus an optional colour tone. */
function chordPitchClasses(tonic: number, degree: Degree, colour: "none" | "add9" | "seventh") {
  const at = (offset: number) => (tonic + AEOLIAN[(DEGREE_INDEX[degree] + offset) % 7]) % 12;
  const tones = [at(0), at(2), at(4)];
  if (colour === "add9") tones.push(at(1));
  if (colour === "seventh") tones.push(at(6));
  return tones;
}

/** Lowest MIDI note ≥ low with pitch class pc. */
const placeAbove = (pc: number, low: number) => low + ((((pc - low) % 12) + 12) % 12);

/** Every close-position voicing (one per bass note) inside [low, high]. */
function voicings(pcs: number[], low: number, high: number): number[][] {
  const result: number[][] = [];
  for (const bassPc of pcs) {
    const base = placeAbove(bassPc, low);
    const notes = pcs.map((pc) => placeAbove(pc, base)).sort((x, y) => x - y);
    if (notes[notes.length - 1] <= high) result.push(notes);
  }
  return result;
}

/** Total voice movement between two voicings (each note to its nearest counterpart). */
function motion(from: number[], to: number[]) {
  return (
    to.reduce((sum, note) => sum + Math.min(...from.map((f) => Math.abs(f - note))), 0) +
    from.reduce((sum, note) => sum + Math.min(...to.map((t) => Math.abs(t - note))), 0)
  );
}

function chooseVoicing(
  rng: () => number,
  pcs: number[],
  previous: number[] | null,
  low: number,
  high: number,
) {
  // A colour tone that cannot fit is dropped; a triad always fits a 7+ semitone window.
  let candidates = voicings(pcs, low, high);
  if (!candidates.length) candidates = voicings(pcs.slice(0, 3), low, high);
  if (!candidates.length) candidates = voicings(pcs.slice(0, 3), low, CINEMATIC_CEILING_MIDI);
  const centre = (low + high) / 2;
  // Smallest motion from the previous chord, gently pulled towards the profile's register.
  return candidates
    .map((notes) => ({
      notes,
      cost:
        (previous ? motion(previous, notes) : 0) +
        Math.abs(notes.reduce((a, n) => a + n, 0) / notes.length - centre) * 0.8 +
        rng() * 0.5,
    }))
    .sort((a, b) => a.cost - b.cost)[0].notes;
}

/** Plans the cinematic music of one image. Pure: depends only on the options. */
export function composeCinematic(options: ComposeOptions): CinematicPlan {
  const { totalSteps, identitySeed, movement, previous } = options;
  const target = clamp01(options.energy);
  const start = previous ? clamp01(previous.energy) : target;
  const key = KEYS[Math.floor(createRng(identitySeed)() * KEYS.length)];
  const rng = createRng((identitySeed ^ Math.imul(movement + 1, 0x9e3779b1)) >>> 0);
  /** Energy at a point of the image: glides from the previous image at the start. */
  const energyAt = (fraction: number) => {
    const t = clamp01(fraction / ENERGY_GLIDE);
    return lerp(start, target, t * t * (3 - 2 * t));
  };

  const chords: ChordSpan[] = [];
  const history: Degree[] = [];
  const usedPatterns = new Set<string>();
  let previousVoicing: number[] | null = previous?.voicing ?? null;
  let strings = false;
  let at = 0;

  while (at < totalSteps) {
    const fraction = at / totalSteps;
    const phase = phaseAt(fraction);
    const intensity = intensityAt(fraction);
    const energy = energyAt(fraction);
    const p = profileParameters(energy);
    // Even lengths, a little shorter in the expansion, never a fragment under a bar at the end.
    const [min, max] = p.chordSteps;
    const squeeze = phase === "expansion" ? 0.8 : 1;
    let steps = Math.max(4, 2 * Math.round((lerp(min, max, rng()) * squeeze) / 2));
    if (totalSteps - (at + steps) < BAR) steps = totalSteps - at;

    const last = history[history.length - 1] ?? previous?.degree;
    const isFinal = at + steps >= totalSteps;
    if (isFinal && last === "i" && chords.length) {
      // Already on the tonic: let it ring to the end rather than leave it.
      chords[chords.length - 1].steps += steps;
      break;
    }
    let degree: Degree;
    if (!last) degree = "i";
    else if (isFinal) degree = "i"; // close on the tonic
    else {
      const moves = (Object.keys(DEGREE_INDEX) as Degree[])
        .filter((next) => next !== last)
        .map((next) => {
          const weight = lerp(
            DARK_MOVES[last][next] ?? 0,
            BRIGHT_MOVES[last][next] ?? 0,
            p.brightness,
          );
          const pattern = [...history.slice(-3), next].join("-");
          return [next, usedPatterns.has(pattern) ? weight * 0.15 : weight] as [Degree, number];
        })
        .filter(([, weight]) => weight > 0);
      degree = pickWeighted(rng, moves);
    }
    if (history.length >= 3) usedPatterns.add([...history.slice(-3), degree].join("-"));
    history.push(degree);

    const colour =
      rng() < energy * intensity * 0.9
        ? "add9"
        : rng() < (1 - energy) * 0.45 || (phase === "transition" && rng() < 0.4)
          ? "seventh"
          : "none";
    const voicing = chooseVoicing(
      rng,
      chordPitchClasses(key.pc, degree, colour),
      previousVoicing,
      p.voicingLow,
      p.voicingHigh,
    );
    previousVoicing = voicing;

    // Hysteresis: strings change state only at chord changes, past a margin;
    // the transition always thins them out.
    if (!strings && intensity > 0.42 && phase !== "transition") strings = true;
    else if (strings && (intensity < 0.38 || phase === "transition")) strings = false;

    chords.push({
      start: at,
      steps,
      degree,
      voicing,
      phase,
      intensity,
      energy,
      strings,
      tone: p.tone,
    });
    at += steps;
  }

  const events: CinematicEvent[] = [];
  const push = (event: Omit<CinematicEvent, "offset"> & { offset?: number }) =>
    events.push({ offset: 0, ...event, velocity: round(event.velocity), pan: round(event.pan) });

  for (const chord of chords) {
    const { start: from, steps, voicing, intensity, phase, energy } = chord;
    const p = profileParameters(energy);
    const density = PHASE_DENSITY[phase];
    const rootPc = chordPitchClasses(key.pc, chord.degree, "none")[0];
    const level = 0.6 + 0.4 * intensity;

    push({
      step: from,
      voice: "pad",
      notes: voicing,
      steps,
      velocity: p.padVelocity * level,
      pan: 0,
    });

    if (p.drone > 0.05) {
      const tonic = placeAbove(key.pc, 28); // E1..D#2
      push({
        step: from,
        voice: "drone",
        notes: [tonic, tonic + 7],
        steps,
        velocity: 0.22 * p.drone,
        pan: 0,
      });
    }

    if (chord.strings) {
      const every = Math.min(steps, p.stringsPulse);
      for (let s = 0; s < steps; s += every) {
        push({
          step: from + s,
          voice: "strings",
          notes: voicing,
          steps: Math.min(every, steps - s),
          velocity: (0.08 + 0.42 * Math.max(0, intensity - 0.3)) * (s === 0 ? 1 : 0.75),
          pan: -0.25,
        });
      }
    }

    // Bass: a long low pedal when contemplative, a moving root/octave/fifth line when energetic.
    if (phase !== "introduction" || energy > 0.6) {
      const bass = placeAbove(rootPc, p.bassLow);
      const hits = energy > 0.5 ? Math.max(1, Math.floor(steps / 4)) : 1;
      for (let h = 0; h < hits; h++) {
        const note = h === 0 ? bass : [bass + 12, bass + 7, bass][h % 3];
        push({
          step: from + h * Math.floor(steps / hits),
          voice: "bass",
          notes: [Math.min(note, CINEMATIC_CEILING_MIDI)],
          steps: Math.floor(steps / hits),
          velocity: (0.16 + 0.14 * intensity) * (h === 0 ? 1 : 0.7) * p.bassLevel,
          pan: 0,
        });
      }
    }

    // Energetic motion: an arpeggio pulse through the voicing (and its octave
    // when it still fits under C4), with occasional sixteenth-note partners.
    const arpeggio = [
      ...voicing,
      ...voicing.map((n) => n + 12).filter((n) => n <= CINEMATIC_CEILING_MIDI),
    ];
    let arp = Math.floor(rng() * arpeggio.length);
    for (let s = 1; s < steps; s++) {
      if (rng() >= p.pulse * density) continue;
      arp = (arp + 1 + (rng() < 0.25 ? 1 : 0)) % arpeggio.length;
      push({
        step: from + s,
        voice: "piano",
        notes: [arpeggio[arp]],
        steps: Math.max(1, Math.round(p.figureSteps)),
        velocity: (0.12 + 0.16 * intensity) * (0.8 + 0.2 * rng()),
        pan: (rng() - 0.5) * 0.6,
      });
      if (rng() < p.sparkle) {
        const high = placeAbove(arpeggio[arp] % 12, GLINT_FLOOR_MIDI);
        if (high <= GLINT_CEILING_MIDI) {
          push({
            step: from + s,
            voice: "glint",
            notes: [high],
            steps: 1,
            velocity: 0.1 + 0.1 * intensity,
            pan: (rng() - 0.5) * 0.6,
          });
        }
      }
      if (rng() < p.sixteenths * density) {
        push({
          step: from + s,
          offset: 0.5,
          voice: "piano",
          notes: [arpeggio[(arp + 1) % arpeggio.length]],
          steps: 1,
          velocity: (0.1 + 0.12 * intensity) * (0.8 + 0.2 * rng()),
          pan: (rng() - 0.5) * 0.6,
        });
      }
    }

    // Contemplative figures: an occasional low, long piano note.
    const lowCount = Math.floor(p.lowFigures * density + rng());
    for (let f = 0; f < lowCount; f++) {
      const slot = 2 + Math.floor(rng() * Math.max(1, steps - 4));
      push({
        step: from + Math.min(slot, steps - 1),
        voice: "piano",
        notes: [voicing[Math.floor(rng() * voicing.length)]],
        steps: Math.max(2, Math.round(p.figureSteps)),
        velocity: 0.12 + 0.12 * intensity,
        pan: (rng() - 0.5) * 0.4,
      });
    }

    // Energetic glints: short high notes from the chord, above the scientific band.
    for (let s = 1; s < steps; s++) {
      if (rng() >= p.glint * density) continue;
      const note = placeAbove(voicing[Math.floor(rng() * voicing.length)] % 12, GLINT_FLOOR_MIDI);
      if (note > GLINT_CEILING_MIDI) continue;
      push({
        step: from + s,
        voice: "glint",
        notes: [note],
        steps: 2,
        velocity: 0.1 + 0.12 * intensity,
        pan: (rng() - 0.5) * 0.6,
      });
    }
  }

  events.sort((a, b) => a.step + a.offset - (b.step + b.offset));
  return { key: key.name, totalSteps, energy: target, chords, events };
}

/** Where the next image of the session continues from. */
export function continuationOf(plan: CinematicPlan): CinematicContinuation {
  const last = plan.chords[plan.chords.length - 1];
  return { energy: plan.energy, voicing: last.voicing, degree: last.degree };
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
