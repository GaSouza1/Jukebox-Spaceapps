/**
 * Image → SonificationScore. A thin adapter over the existing mapping
 * (dataMapper.mapAnalysis), so the image sounds exactly as before: one voice,
 * "main", whose pan and timbre change note by note.
 */
import { mapAnalysis } from "./dataMapper";
import type { ImageAnalysis } from "./imageAnalyzer";
import type { SonificationScore } from "./score";

/** One slice per eighth note at 100 BPM (PlaybackController.BASE_BPM): 0.3 s. */
export const IMAGE_STEP_SECONDS = 0.3;
export const IMAGE_VOICE = "main";

export function imageToScore(analysis: ImageAnalysis, cinematicEnergy: number): SonificationScore {
  const events = mapAnalysis(analysis);
  return {
    stepCount: events.length,
    stepSeconds: IMAGE_STEP_SECONDS,
    voices: [
      {
        id: IMAGE_VOICE,
        timbre: events[0]?.timbre ?? "piano",
        pan: 0,
        notes: events.map((event) => ({
          frequency: event.frequency,
          velocity: event.velocity,
          pan: event.pan,
          timbre: event.timbre,
        })),
      },
    ],
    cinematic: { energy: cinematicEnergy },
  };
}
