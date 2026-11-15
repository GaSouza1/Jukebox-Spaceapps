import { create } from "zustand";
import { DEFAULT_INDICATOR, type IndicatorId } from "../features/data/indicators";
import { regions } from "../features/data/regions";
import type { PlaybackMode } from "../features/sonification/engine/comparisonScore";
import type { ComparisonSelection, Region, SonificationState } from "../types/data";

/** Which regions the comparison sonification plays. */
export type { PlaybackMode };

/**
 * Last user-visible playback transition. `id` increases on every action so the
 * player can announce each one exactly once, whichever control triggered it.
 * The playback hook also reads it to drive the audio engine.
 * "interrupt": another sonification (the image) took over the audio.
 */
export interface PlaybackAction {
  type: "play" | "resume" | "pause" | "stop" | "finish" | "interrupt";
  id: number;
}

interface AppState extends ComparisonSelection, SonificationState {
  playbackMode: PlaybackMode;
  lastAction: PlaybackAction | null;
  setRegion: (slot: "regionA" | "regionB", region: Region) => void;
  setIndicator: (indicator: IndicatorId) => void;
  setPeriod: (startYear: number, endYear: number) => void;
  setPlaying: (isPlaying: boolean) => void;
  setCurrentIndex: (currentIndex: number) => void;
  setPlaybackSpeed: (playbackSpeed: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackMode: (mode: PlaybackMode) => void;
  /** Starts from the first month, optionally switching mode first. */
  play: (mode?: PlaybackMode) => void;
  pause: () => void;
  /** Continues from the current month (after a pause, or after moving the position slider). */
  resume: () => void;
  stop: () => void;
  /** Called by the player when the last month has played. */
  finish: () => void;
  /** Called when the image sonification takes over the audio. */
  interrupt: () => void;
  resetPlayback: () => void;
}

let actionId = 0;
const action = (type: PlaybackAction["type"]): PlaybackAction => ({ type, id: ++actionId });

/** Any change to the comparison stops playback; announce it only if something was playing. */
const stopForChange = (state: AppState) => ({
  isPlaying: false,
  currentIndex: 0,
  lastAction: state.isPlaying ? action("stop") : state.lastAction,
});

/**
 * Default period: the last 20 complete years. The year before the current one
 * is assumed complete; useComparisonData moves the period inside the years
 * the data really covers once it arrives.
 */
const lastCompleteYear = new Date().getFullYear() - 1;

export const useComparisonStore = create<AppState>((set) => ({
  regionA: regions[1],
  regionB: regions[3],
  indicator: DEFAULT_INDICATOR,
  startYear: lastCompleteYear - 19,
  endYear: lastCompleteYear,
  isPlaying: false,
  currentIndex: 0,
  playbackSpeed: 1,
  volume: 0.65,
  playbackMode: "both",
  lastAction: null,
  setRegion: (slot, region) => set((s) => ({ [slot]: region, ...stopForChange(s) })),
  setIndicator: (indicator) => set((s) => ({ indicator, ...stopForChange(s) })),
  setPeriod: (startYear, endYear) => set((s) => ({ startYear, endYear, ...stopForChange(s) })),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentIndex: (currentIndex) => set({ currentIndex }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setVolume: (volume) => set({ volume }),
  setPlaybackMode: (playbackMode) => set((s) => ({ playbackMode, ...stopForChange(s) })),
  play: (mode) =>
    set((s) => ({
      playbackMode: mode ?? s.playbackMode,
      currentIndex: 0,
      isPlaying: true,
      lastAction: action("play"),
    })),
  pause: () => set((s) => (s.isPlaying ? { isPlaying: false, lastAction: action("pause") } : {})),
  resume: () => set((s) => (s.isPlaying ? {} : { isPlaying: true, lastAction: action("resume") })),
  stop: () => set({ isPlaying: false, currentIndex: 0, lastAction: action("stop") }),
  finish: () => set({ isPlaying: false, currentIndex: 0, lastAction: action("finish") }),
  interrupt: () =>
    set((s) =>
      s.isPlaying || s.currentIndex > 0
        ? { isPlaying: false, currentIndex: 0, lastAction: action("interrupt") }
        : {},
    ),
  resetPlayback: () => set({ isPlaying: false, currentIndex: 0 }),
}));
