/**
 * NASA GIBS imagery for the indicator on the map. The layer shows the SAME
 * quantity from the SAME source as the series (MERRA-2 2 m air temperature
 * for T2M), as visual context only: no value on the page is read from it.
 *
 * Verified 15/11/2026: WMTS EPSG:3857 tiles answer with CORS "*"; the layer's
 * time dimension has gaps (e.g. 2023-12 and 2024-05 return 404); its colour
 * map is in kelvin.
 */
const GIBS_WMTS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";

/** Tile URL template for MapLibre, for one month ("YYYY-MM"). */
export function gibsTileUrl(layerId: string, matrixSet: string, month: string) {
  return `${GIBS_WMTS}/${layerId}/default/${month}-01/${matrixSet}/{z}/{y}/{x}.png`;
}

export const GIBS_ATTRIBUTION = "Imagery: NASA GIBS · MERRA-2 (NASA GMAO)";

/**
 * Colour stops of MERRA2_2m_Air_Temperature_Monthly, read from
 * https://gibs.earthdata.nasa.gov/colormaps/v1.3/MERRA2_2m_Air_Temperature_Monthly.xml
 * (181 classes from below 220 K to 310 K and above), converted from kelvin to °C.
 */
export const T2M_LEGEND_STOPS: { celsius: number; rgb: string }[] = [
  { celsius: -53, rgb: "50,136,189" },
  { celsius: -40, rgb: "114,198,164" },
  { celsius: -30, rgb: "176,223,162" },
  { celsius: -20, rgb: "230,245,152" },
  { celsius: -10, rgb: "252,254,187" },
  { celsius: 0, rgb: "254,229,148" },
  { celsius: 10, rgb: "253,187,108" },
  { celsius: 20, rgb: "247,132,77" },
  { celsius: 30, rgb: "227,83,73" },
  { celsius: 37, rgb: "205,53,77" },
];

export function legendGradient(stops = T2M_LEGEND_STOPS) {
  const min = stops[0].celsius;
  const span = stops[stops.length - 1].celsius - min;
  return `linear-gradient(to right, ${stops
    .map((s) => `rgb(${s.rgb}) ${(((s.celsius - min) / span) * 100).toFixed(1)}%`)
    .join(", ")})`;
}
