export interface Region {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface EnvironmentalDataPoint {
  date: string;
  value: number;
}

export interface RegionSeries {
  region: Region;
  indicator: string;
  unit: string;
  data: EnvironmentalDataPoint[];
}

export interface ComparisonState {
  regionA: Region | null;
  regionB: Region | null;
  indicator: string;
  startYear: number;
  endYear: number;
}

export interface SonificationState {
  isPlaying: boolean;
  currentIndex: number;
  playbackSpeed: number;
  volume: number;
}
