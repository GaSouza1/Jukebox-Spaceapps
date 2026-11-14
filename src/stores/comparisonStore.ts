import { create } from "zustand";
import { regions, type IndicatorId } from "../features/data/demoData";
import type { ComparisonState, Region, SonificationState } from "../types/data";

interface AppState extends ComparisonState, SonificationState {
  setRegion: (slot: "regionA" | "regionB", region: Region) => void;
  setIndicator: (indicator: IndicatorId) => void;
  setPeriod: (startYear: number, endYear: number) => void;
  setPlaying: (isPlaying: boolean) => void;
  setCurrentIndex: (currentIndex: number) => void;
  setPlaybackSpeed: (playbackSpeed: number) => void;
  setVolume: (volume: number) => void;
  resetPlayback: () => void;
}

export const useComparisonStore = create<AppState>((set) => ({
  regionA: regions[1],
  regionB: regions[3],
  indicator: "T2M",
  startYear: 2005,
  endYear: 2024,
  isPlaying: false,
  currentIndex: 0,
  playbackSpeed: 1,
  volume: 0.65,
  setRegion: (slot, region) => set({ [slot]: region, isPlaying: false, currentIndex: 0 }),
  setIndicator: (indicator) => set({ indicator, isPlaying: false, currentIndex: 0 }),
  setPeriod: (startYear, endYear) => set({ startYear, endYear, isPlaying: false, currentIndex: 0 }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentIndex: (currentIndex) => set({ currentIndex }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setVolume: (volume) => set({ volume }),
  resetPlayback: () => set({ isPlaying: false, currentIndex: 0 }),
}));
