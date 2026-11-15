import type { Region } from "../../types/data";

const CITY_CENTRE = "City centre, entered by the team (approximate)";

/**
 * Curated regions. Each one is a point; NASA POWER returns the value of the
 * MERRA-2 grid cell (0.5° × 0.625°) nearest to it, not of the city itself.
 * Sorocaba and São Paulo fall in neighbouring cells (FC-08).
 */
export const regions: Region[] = [
  {
    id: "sorocaba",
    name: "Sorocaba",
    country: "Brasil",
    latitude: -23.5015,
    longitude: -47.4526,
    coordinateSource: CITY_CENTRE,
  },
  {
    id: "manaus",
    name: "Manaus",
    country: "Brasil",
    latitude: -3.119,
    longitude: -60.0217,
    coordinateSource: CITY_CENTRE,
  },
  {
    id: "sao-paulo",
    name: "São Paulo",
    country: "Brasil",
    latitude: -23.5505,
    longitude: -46.6333,
    coordinateSource: CITY_CENTRE,
  },
  {
    id: "new-york",
    name: "New York",
    country: "United States",
    latitude: 40.7128,
    longitude: -74.006,
    coordinateSource: CITY_CENTRE,
  },
  {
    id: "london",
    name: "London",
    country: "United Kingdom",
    latitude: 51.5072,
    longitude: -0.1276,
    coordinateSource: CITY_CENTRE,
  },
  {
    id: "cape-town",
    name: "Cidade do Cabo",
    country: "África do Sul",
    latitude: -33.9249,
    longitude: 18.4241,
    coordinateSource: CITY_CENTRE,
  },
];

export function regionById(id: string): Region | undefined {
  return regions.find((region) => region.id === id);
}

export function formatCoordinates(region: Pick<Region, "latitude" | "longitude">) {
  const lat = `${Math.abs(region.latitude).toFixed(2)}° ${region.latitude >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(region.longitude).toFixed(2)}° ${region.longitude >= 0 ? "E" : "W"}`;
  return `${lat}, ${lon}`;
}

/** MERRA-2 grid used by NASA POWER for meteorological parameters. */
export const MERRA2_CELL = { latitudeDegrees: 0.5, longitudeDegrees: 0.625 } as const;
const KM_PER_DEGREE = 111.32;

/** Approximate size of the grid cell at a latitude, in km (north–south × east–west). */
export function cellSizeKm(latitude: number, cell = MERRA2_CELL) {
  return {
    northSouth: Math.round(cell.latitudeDegrees * KM_PER_DEGREE),
    eastWest: Math.round(
      cell.longitudeDegrees * KM_PER_DEGREE * Math.cos((latitude * Math.PI) / 180),
    ),
  };
}

export function describeCell(latitude: number) {
  const { northSouth, eastWest } = cellSizeKm(latitude);
  return `Values describe a grid cell of about ${northSouth} by ${eastWest} km around this point, not the city alone.`;
}
