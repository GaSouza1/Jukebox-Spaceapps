import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapType } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Region } from "../../../types/data";

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
    mapRef.current = map;
    return () => map.remove();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = [
      new maplibregl.Marker({ color: "#47a9ff" })
        .setLngLat([regionA.longitude, regionA.latitude])
        .setPopup(new maplibregl.Popup().setText(`Region A: ${regionA.name}`))
        .addTo(map),
      new maplibregl.Marker({ color: "#ff9b55" })
        .setLngLat([regionB.longitude, regionB.latitude])
        .setPopup(new maplibregl.Popup().setText(`Region B: ${regionB.name}`))
        .addTo(map),
    ];
    const bounds = new maplibregl.LngLatBounds();
    bounds
      .extend([regionA.longitude, regionA.latitude])
      .extend([regionB.longitude, regionB.latitude]);
    map.fitBounds(bounds, { padding: 70, maxZoom: 4, duration: 700 });
    return () => markers.forEach((marker) => marker.remove());
  }, [regionA, regionB]);

  return (
    <div className="map-wrap">
      <div
        ref={containerRef}
        className="map"
        role="img"
        aria-label={`Map showing ${regionA.name} and ${regionB.name}`}
      />
      <div className="map-overlay">
        <span>BASEMAP · OPENSTREETMAP</span>
        <small>NASA GIBS layer integration planned</small>
      </div>
    </div>
  );
}
