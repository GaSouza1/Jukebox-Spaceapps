import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CINEMATIC_CEILING_MIDI,
  composeCinematic,
  continuationOf,
  GLINT_FLOOR_MIDI,
  intensityAt,
  phaseAt,
  profileParameters,
  type CinematicPlan,
} from "./cinematicComposer";

const STEPS = 96; // one image
const DARK = 0;
const BRIGHT = 1;
const plan = (identitySeed: number, energy: number, movement = 0, totalSteps = STEPS) =>
  composeCinematic({ totalSteps, identitySeed, movement, energy });
const progression = (p: CinematicPlan) => p.chords.map((c) => c.degree).join(" ");
const seeds = Array.from({ length: 40 }, (_, i) => (i + 1) * 7919);
const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

/** Comparable figures of a plan, averaged later over many seeds. */
function metrics(p: CinematicPlan) {
  const notes = p.events.flatMap((e) => e.notes.map((n) => ({ n, voice: e.voice })));
  const low = notes.filter((x) => x.voice !== "glint").map((x) => x.n);
  return {
    chordSteps: average(p.chords.map((c) => c.steps)),
    eventsPerStep: p.events.length / p.totalSteps,
    sixteenths: p.events.filter((e) => e.offset > 0).length,
    meanPitch: average(notes.map((x) => x.n)),
    padPitch: average(p.events.filter((e) => e.voice === "pad").flatMap((e) => e.notes)),
    lowPitch: average(low),
    glints: p.events.filter((e) => e.voice === "glint").length,
    drones: p.events.filter((e) => e.voice === "drone").length,
    meanLength: average(p.events.filter((e) => e.voice === "piano").map((e) => e.steps)),
    majorShare:
      p.chords.filter((c) => ["III", "VI", "VII"].includes(c.degree)).length / p.chords.length,
    cutoff: average(p.chords.map((c) => c.tone.cutoff)),
    padAttack: average(p.chords.map((c) => c.tone.padAttack)),
    reverb: average(p.chords.map((c) => c.tone.reverbSend)),
  };
}
const averaged = (energy: number, totalSteps = 480) => {
  const all = seeds.map((s) => metrics(plan(s, energy, 0, totalSteps)));
  return Object.fromEntries(
    Object.keys(all[0]).map((k) => [k, average(all.map((m) => m[k as keyof typeof m]))]),
  ) as ReturnType<typeof metrics>;
};

describe("composeCinematic: inputs and determinism", () => {
  it("takes only the duration, seeds and one energy number (never the analysis)", () => {
    assert.equal(composeCinematic.length, 1);
    const options = { totalSteps: STEPS, identitySeed: 5, movement: 0, energy: 0.4 };
    assert.deepEqual(Object.keys(options).sort(), [
      "energy",
      "identitySeed",
      "movement",
      "totalSteps",
    ]);
    assert.deepEqual(composeCinematic(options), composeCinematic({ ...options }));
  });

  it("is deterministic (pause / resume can never change it)", () => {
    assert.deepEqual(plan(123, 0.7, 2), plan(123, 0.7, 2));
  });

  it("varies between sessions and between images of one session, in both profiles", () => {
    for (const energy of [DARK, BRIGHT]) {
      // A contemplative image has only 3–4 slow chords, so compare progressions over a
      // longer span, and whole plans (voicings, textures, rhythm) per image.
      assert.ok(new Set(seeds.map((s) => progression(plan(s, energy, 0, 480)))).size >= 30);
      assert.ok(new Set(seeds.map((s) => JSON.stringify(plan(s, energy).events))).size >= 38);
      assert.equal(
        new Set([0, 1, 2, 3, 4].map((m) => JSON.stringify(plan(99, energy, m).events))).size,
        5,
      );
    }
  });

  it("keeps one key per session, across images and profiles", () => {
    for (const s of seeds.slice(0, 10)) {
      assert.equal(new Set([0, 1, 2].map((m) => plan(s, m / 2, m).key)).size, 1);
    }
  });
});

describe("composeCinematic: two contrasting profiles", () => {
  const dark = averaged(DARK);
  const bright = averaged(BRIGHT);
  const mid = averaged(0.5);

  it("energetic is faster: shorter chords, several times more events, sixteenth notes", () => {
    assert.ok(
      dark.chordSteps > bright.chordSteps * 2.5,
      `${dark.chordSteps} vs ${bright.chordSteps}`,
    );
    assert.ok(
      bright.eventsPerStep > dark.eventsPerStep * 3,
      `${bright.eventsPerStep} vs ${dark.eventsPerStep}`,
    );
    assert.ok(bright.sixteenths > 10 && dark.sixteenths === 0);
    assert.ok(dark.meanLength > bright.meanLength * 3, "contemplative notes are sustained");
  });

  it("energetic is higher, contemplative lower (by more than an octave on average)", () => {
    assert.ok(bright.meanPitch - dark.meanPitch > 12, `${bright.meanPitch} vs ${dark.meanPitch}`);
    assert.ok(bright.padPitch - dark.padPitch > 9, `pad ${bright.padPitch} vs ${dark.padPitch}`);
    assert.ok(bright.glints > 5 && dark.glints === 0);
    assert.ok(dark.drones > 0 && bright.drones === 0);
  });

  it("energetic leans on major chords, contemplative on minor ones", () => {
    assert.ok(
      bright.majorShare > dark.majorShare + 0.15,
      `${bright.majorShare} vs ${dark.majorShare}`,
    );
  });

  it("timbre: energetic brighter, quicker and drier", () => {
    assert.ok(bright.cutoff > dark.cutoff * 3);
    assert.ok(dark.padAttack > bright.padAttack * 3);
    assert.ok(dark.reverb > bright.reverb + 0.2);
  });

  it("an intermediate image lies between the two on every measure", () => {
    for (const key of [
      "chordSteps",
      "eventsPerStep",
      "meanPitch",
      "cutoff",
      "padAttack",
    ] as const) {
      const [lo, hi] = [Math.min(dark[key], bright[key]), Math.max(dark[key], bright[key])];
      assert.ok(mid[key] > lo && mid[key] < hi, `${key}: ${mid[key]} not between ${lo} and ${hi}`);
    }
  });

  it("profile parameters change continuously with energy (no jump between profiles)", () => {
    for (let e = 0; e < 1; e += 0.02) {
      const a = profileParameters(e);
      const b = profileParameters(e + 0.02);
      assert.ok(Math.abs(a.tone.cutoff - b.tone.cutoff) < 100);
      assert.ok(Math.abs(a.voicingLow - b.voicingLow) <= 1);
      assert.ok(Math.abs(a.pulse - b.pulse) < 0.02);
    }
  });
});

describe("composeCinematic: musical constraints in both profiles", () => {
  const energies = [0, 0.3, 0.6, 1];

  it("never plays inside the scientific band (C4–C6)", () => {
    for (const energy of energies) {
      for (const s of seeds) {
        for (const event of plan(s, energy, 0, 400).events) {
          for (const n of event.notes) {
            const ok =
              event.voice === "glint" ? n >= GLINT_FLOOR_MIDI : n <= CINEMATIC_CEILING_MIDI;
            assert.ok(ok && n >= 24, `${event.voice} ${n} at energy ${energy}`);
          }
          assert.ok(Math.abs(event.pan) <= 0.3 && event.velocity > 0 && event.velocity <= 0.7);
        }
      }
    }
  });

  it("covers the whole duration with contiguous chords", () => {
    for (const energy of energies) {
      for (const total of [96, 200, 960]) {
        const p = plan(7, energy, 0, total);
        let at = 0;
        for (const chord of p.chords) {
          assert.equal(chord.start, at);
          at += chord.steps;
        }
        assert.equal(at, total);
        assert.ok(p.events.every((e) => e.step >= 0 && e.step < total));
      }
    }
  });

  it("starts and closes on the tonic, never repeating a chord back to back", () => {
    for (const energy of energies) {
      for (const s of seeds) {
        const degrees = plan(s, energy, 1, 400).chords.map((c) => c.degree);
        assert.equal(degrees[0], "i");
        assert.equal(degrees.at(-1), "i");
        for (let i = 1; i < degrees.length; i++) assert.notEqual(degrees[i], degrees[i - 1]);
      }
    }
  });

  it("moves voices smoothly between chords", () => {
    for (const energy of energies) {
      for (const s of seeds) {
        const chords = plan(s, energy, 0, 400).chords;
        for (let i = 1; i < chords.length; i++) {
          for (const note of chords[i].voicing) {
            const nearest = Math.min(...chords[i - 1].voicing.map((n) => Math.abs(n - note)));
            assert.ok(nearest <= 5, `leap of ${nearest} at energy ${energy}`);
          }
        }
      }
    }
  });

  it("does not loop the same 4-chord pattern, even with the fast energetic harmony", () => {
    for (const energy of [0, 1]) {
      for (const s of seeds) {
        const degrees = plan(s, energy, 0, 960).chords.map((c) => c.degree);
        const counts = new Map<string, number>();
        for (let i = 0; i + 4 <= degrees.length; i++) {
          const key = degrees.slice(i, i + 4).join("-");
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        const worst = Math.max(...counts.values());
        // About 9 % of the 4-grams at most: the energetic profile has ~120 chords here.
        assert.ok(
          worst <= Math.max(3, degrees.length * 0.09),
          `${worst} repeats in ${degrees.length}`,
        );
      }
    }
  });

  it("keeps evolving inside each profile: phases, sparse introduction, strings in and out", () => {
    assert.equal(phaseAt(0.1), "introduction");
    assert.equal(phaseAt(0.5), "expansion");
    assert.equal(phaseAt(0.99), "continuity");
    for (let t = 0; t < 1; t += 0.01)
      assert.ok(Math.abs(intensityAt(t + 0.01) - intensityAt(t)) < 0.03);
    for (const energy of [0, 1]) {
      let intro = 0;
      let expansion = 0;
      let toggles = 0;
      for (const s of seeds) {
        const p = plan(s, energy, 0, 960);
        const perStep = (phase: string) => {
          const chords = p.chords.filter((c) => c.phase === phase);
          const span = chords.reduce((a, c) => a + c.steps, 0);
          return (
            p.events.filter((e) =>
              chords.some((c) => e.step >= c.start && e.step < c.start + c.steps),
            ).length / span
          );
        };
        intro += perStep("introduction");
        expansion += perStep("expansion");
        assert.equal(p.chords[0].strings, false);
        for (let i = 1; i < p.chords.length; i++) {
          if (p.chords[i].strings !== p.chords[i - 1].strings) toggles++;
        }
      }
      assert.ok(expansion > intro * 1.3, `energy ${energy}: ${expansion} vs ${intro}`);
      assert.ok(toggles / seeds.length >= 1.5, `energy ${energy}: ${toggles} string changes`);
    }
  });
});

describe("composeCinematic: consecutive images", () => {
  it("glides the energy from the previous image instead of jumping", () => {
    const first = plan(42, DARK, 0);
    const second = composeCinematic({
      totalSteps: STEPS,
      identitySeed: 42,
      movement: 1,
      energy: BRIGHT,
      previous: continuationOf(first),
    });
    const energies = second.chords.map((c) => c.energy);
    assert.ok(energies[0] < 0.1, `starts near the previous energy, got ${energies[0]}`);
    assert.ok(energies.at(-1)! > 0.99, "reaches the image's own profile");
    for (let i = 1; i < energies.length; i++) assert.ok(energies[i] >= energies[i - 1] - 1e-9);
  });

  it("continues the harmony: no restart on the tonic, first voicing close to the last one", () => {
    for (const s of seeds) {
      const first = plan(s, 0.5, 0);
      const end = continuationOf(first);
      const second = composeCinematic({
        totalSteps: STEPS,
        identitySeed: s,
        movement: 1,
        energy: 0.5,
        previous: end,
      });
      assert.notEqual(second.chords[0].degree, end.degree);
      for (const note of second.chords[0].voicing) {
        assert.ok(Math.min(...end.voicing.map((n) => Math.abs(n - note))) <= 5);
      }
    }
  });

  it("similar images keep a steady profile: no artificial change", () => {
    const first = plan(8, 0.8, 0);
    const second = composeCinematic({
      totalSteps: STEPS,
      identitySeed: 8,
      movement: 1,
      energy: 0.8,
      previous: continuationOf(first),
    });
    assert.ok(second.chords.every((c) => Math.abs(c.energy - 0.8) < 1e-9));
  });
});
