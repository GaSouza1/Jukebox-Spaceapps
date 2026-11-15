import { useEffect, useId, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapType } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Region } from "../../../types/data";
import { StableText } from "../../../components/StableText";
import { formatLongMonth } from "../../data/format";
import { indicatorOf, type IndicatorId } from "../../data/indicators";
import { formatCoordinates } from "../../data/regions";
import { GIBS_ATTRIBUTION, gibsTileUrl, legendGradient, T2M_LEGEND_STOPS } from "./gibsLayer";

const GIBS_SOURCE = "gibs";
const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** MapLibre needs WebGL2; without it the map is replaced by text (NA-01). */
function webgl2Available() {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

/** Marker with a visible letter so regions are not told apart by color alone. */
function markerElement(letter: "A" | "B", region: Region) {
  const element = document.createElement("div");
  element.className = `map-marker map-marker-${letter.toLowerCase()}`;
  element.textContent = letter;
  // MapLibre makes markers with popups focusable and toggles the popup on Enter/Space.
  element.setAttribute("role", "button");
  element.setAttribute("aria-label", `Region ${letter}: ${region.name}, ${region.country}`);
  return element;
}

interface Props {
  regionA: Region;
  regionB: Region;
  indicator: IndicatorId;
  /** Month of the GIBS layer ("YYYY-MM"), or null before the data arrives. */
  month: string | null;
}

export function EarthMap({ regionA, regionB, indicator, month }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapType | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [showLayer, setShowLayer] = useState(true);
  /** Month for which GIBS publishes no image, if any. */
  const [missingMonth, setMissingMonth] = useState<string | null>(null);
  const showLayerRef = useRef(showLayer);
  showLayerRef.current = showLayer;
  const layer = indicatorOf(indicator).gibsLayer;
  const toggleId = useId();

  useEffect(() => {
    if (!containerRef.current) return;
    if (!webgl2Available()) {
      setMapError("The interactive map needs WebGL2, which this browser does not provide.");
      return;
    }
    let map: MapType;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [
            {
              id: "osm",
              type: "raster",
              source: "osm",
              paint: { "raster-saturation": -0.75, "raster-brightness-max": 0.58 },
            },
          ],
        },
        center: [
          (regionA.longitude + regionB.longitude) / 2,
          (regionA.latitude + regionB.latitude) / 2,
        ],
        zoom: 1.25,
        attributionControl: false,
      });
    } catch (error) {
      setMapError(`The interactive map could not start (${(error as Error).message}).`);
      return;
    }
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }));
    // Describe the interactive canvas instead of the generic "Map".
    map.getCanvas().setAttribute("aria-label", "Interactive map");
    // Long instructions live in real DOM text (translatable), not in an attribute.
    map.getCanvas().setAttribute("aria-describedby", "map-keyboard-hint");
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // GIBS layer: added once the style is ready, then only its month changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layer || !month) return;
    setMissingMonth(null);
    const tiles = [gibsTileUrl(layer.id, layer.matrixSet, month)];
    // The source is replaced for each month: the path that first loads the
    // tiles is the one that is known to work everywhere.
    const apply = () => {
      if (map.getLayer(GIBS_SOURCE)) map.removeLayer(GIBS_SOURCE);
      if (map.getSource(GIBS_SOURCE)) map.removeSource(GIBS_SOURCE);
      map.addSource(GIBS_SOURCE, {
        type: "raster",
        tiles,
        tileSize: 256,
        maxzoom: layer.maxZoom,
        attribution: GIBS_ATTRIBUTION,
      });
      map.addLayer({
        id: GIBS_SOURCE,
        type: "raster",
        source: GIBS_SOURCE,
        layout: { visibility: showLayerRef.current ? "visible" : "none" },
        paint: { "raster-opacity": 0.72 },
      });
    };
    // After the first month, the style is ready; isStyleLoaded() can stay
    // false while other tiles load, which must not freeze the month.
    if (map.getSource(GIBS_SOURCE) || map.isStyleLoaded()) apply();
    else map.once("load", apply);
    // MapLibre treats a 404 tile as an empty tile and reports nothing, so ask
    // GIBS once (the single world tile) whether it publishes this month.
    const probe = new AbortController();
    fetch(gibsTileUrl(layer.id, layer.matrixSet, month).replace("{z}/{y}/{x}", "0/0/0"), {
      signal: probe.signal,
    })
      .then((response) => {
        if (response.status === 404) setMissingMonth(month);
      })
      .catch(() => {}); // offline or aborted: the map simply shows no layer
    return () => probe.abort();
  }, [layer, month]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const toggle = () =>
      map.getLayer(GIBS_SOURCE) &&
      map.setLayoutProperty(GIBS_SOURCE, "visibility", showLayer ? "visible" : "none");
    if (map.getLayer(GIBS_SOURCE)) toggle();
    else map.once("load", toggle);
  }, [showLayer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = [
      new maplibregl.Marker({ element: markerElement("A", regionA) })
        .setLngLat([regionA.longitude, regionA.latitude])
        .setPopup(new maplibregl.Popup().setText(`Region A: ${regionA.name}`))
        .addTo(map),
      new maplibregl.Marker({ element: markerElement("B", regionB) })
        .setLngLat([regionB.longitude, regionB.latitude])
        .setPopup(new maplibregl.Popup().setText(`Region B: ${regionB.name}`))
        .addTo(map),
    ];
    const bounds = new maplibregl.LngLatBounds();
    bounds
      .extend([regionA.longitude, regionA.latitude])
      .extend([regionB.longitude, regionB.latitude]);
    map.fitBounds(bounds, {
      padding: 70,
      maxZoom: 4,
      duration: prefersReducedMotion() ? 0 : 700,
    });
    return () => markers.forEach((marker) => marker.remove());
  }, [regionA, regionB]);

  const monthLabel = month ? formatLongMonth(month) : null;
  const legendText = layer
    ? `Colour scale of the map layer “${layer.title}”: from about ${T2M_LEGEND_STOPS[0].celsius} °C or colder (blue) through 0 °C (pale yellow) to ${T2M_LEGEND_STOPS.at(-1)!.celsius} °C or warmer (red).`
    : null;

  return (
    <figure
      className="map-wrap"
      aria-labelledby="map-title"
      aria-describedby="map-regions map-layer-note"
    >
      {mapError ? (
        <p className="map-fallback">
          <StableText>{`${mapError} The regions are listed below the map area; the chart, table and sound are not affected.`}</StableText>
        </p>
      ) : (
        <div ref={containerRef} className="map" />
      )}
      <div className="map-overlay">
        <span>
          {layer && showLayer && !mapError
            ? "NASA GIBS · MERRA-2 · OPENSTREETMAP"
            : "BASEMAP · OPENSTREETMAP"}
        </span>
        {layer && monthLabel && !mapError && (
          <StableText as="small">{`${layer.title} · ${monthLabel}`}</StableText>
        )}
      </div>
      <p id="map-keyboard-hint" className="sr-only">
        Use the arrow keys to pan and plus or minus to zoom. The selected regions are listed below
        the map.
      </p>
      {layer && !mapError && (
        <div className="map-layer-panel">
          <label htmlFor={toggleId} className="map-layer-toggle">
            <input
              id={toggleId}
              type="checkbox"
              checked={showLayer}
              onChange={(e) => setShowLayer(e.target.checked)}
            />
            Show the NASA GIBS temperature layer
          </label>
          <div className="map-legend" aria-hidden="true">
            <span className="map-legend-bar" style={{ background: legendGradient() }} />
            <span className="map-legend-ticks">
              <span>{`≤ ${T2M_LEGEND_STOPS[0].celsius} °C`}</span>
              <span>0 °C</span>
              <span>{`≥ ${T2M_LEGEND_STOPS.at(-1)!.celsius} °C`}</span>
            </span>
          </div>
        </div>
      )}
      <p id="map-layer-note" className="map-layer-note">
        {layer && !mapError ? (
          <StableText>
            {`${legendText} ${monthLabel ? `Month shown: ${monthLabel}; it follows the playback position, changing at most once per year while playing.` : ""} ${missingMonth ? `NASA GIBS has no image for ${formatLongMonth(missingMonth)}; the chart, table and sound are not affected.` : ""} The layer is visual context: every value on this page comes from NASA POWER, not from the image. ${GIBS_ATTRIBUTION}.`}
          </StableText>
        ) : (
          <StableText>{"The map shows where the two regions are."}</StableText>
        )}
      </p>
      <figcaption id="map-regions" className="map-regions">
        <span className="sr-only">Regions shown on the map: </span>
        <span className="blue">
          <b aria-hidden="true">A</b>{" "}
          <StableText>{`Region A: ${regionA.name}, ${regionA.country} — ${formatCoordinates(regionA)}.`}</StableText>
        </span>{" "}
        <span className="orange">
          <b aria-hidden="true">B</b>{" "}
          <StableText>{`Region B: ${regionB.name}, ${regionB.country} — ${formatCoordinates(regionB)}.`}</StableText>
        </span>
      </figcaption>
    </figure>
  );
}
