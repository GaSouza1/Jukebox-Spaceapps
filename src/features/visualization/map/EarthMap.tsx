import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapType } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Region } from "../../../types/data";
import { StableText } from "../../../components/StableText";
import { formatCoordinates } from "../../comparison/components/RegionSelector";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

export function EarthMap({ regionA, regionB }: { regionA: Region; regionB: Region }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapType | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
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
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }));
    // Describe the interactive canvas instead of the generic "Map".
    map.getCanvas().setAttribute("aria-label", "Interactive map");
    // Long instructions live in real DOM text (translatable), not in an attribute.
    map.getCanvas().setAttribute("aria-describedby", "map-keyboard-hint");
    mapRef.current = map;
    return () => map.remove();
  }, []);

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

  return (
    <figure className="map-wrap" aria-labelledby="map-title" aria-describedby="map-regions">
      <div ref={containerRef} className="map" />
      <div className="map-overlay">
        <span>BASEMAP · OPENSTREETMAP</span>
        <small>NASA GIBS layer integration planned</small>
      </div>
      <p id="map-keyboard-hint" className="sr-only">
        Use the arrow keys to pan and plus or minus to zoom. The selected regions are listed below
        the map.
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
