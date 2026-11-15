import { useEffect, useState, useEffect } from "react";
import { DataSourceBadge } from "../../components/DataSourceBadge";
import { StableText } from "../../components/StableText";
import { ComparisonControls } from "../../features/comparison/components/ComparisonControls";
import { DataStatus } from "../../features/comparison/components/DataStatus";
import { ScientificExplanation } from "../../features/comparison/components/ScientificExplanation";
import { errorText, loadingText, unavailableReason } from "../../features/comparison/dataStatus";
import { indicatorOf } from "../../features/data/indicators";
import { useComparisonData } from "../../features/data/useComparisonData";
import { SonificationPlayer } from "../../features/sonification/components/SonificationPlayer";
import { ComparisonChart } from "../../features/visualization/charts/ComparisonChart";
import { EarthMap } from "../../features/visualization/map/EarthMap";
import { useComparisonStore } from "../../stores/comparisonStore";
import { ImageSonification } from "@/features/sonification/components/ImageAnalyzer";
import { guidedText } from "@/features/guided-experience/i18n/en";
import api from "@/features/data/apiData";
import {createEicEntries, createEicIndex} from "@/features/data/data";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Month shown by the map layer. It follows the position when stopped, paused
 * or moved; while playing it changes only when a new year starts, so map
 * tiles are not requested at every note (and never with reduced motion).
 */
function useMapMonth(dates: string[], currentIndex: number, isPlaying: boolean) {
  const current = dates[currentIndex] ?? dates[0] ?? null;
  const [month, setMonth] = useState<string | null>(current);
  useEffect(() => {
    if (!current) return setMonth(null);
    if (!isPlaying) setMonth(current);
    else if (!prefersReducedMotion() && current.endsWith("-01")) setMonth(current);
  }, [current, isPlaying]);
  return month;
}

export function ExplorePage() {
  const regionA = useComparisonStore((s) => s.regionA);
  const regionB = useComparisonStore((s) => s.regionB);
  const indicator = useComparisonStore((s) => s.indicator);
  const startYear = useComparisonStore((s) => s.startYear);
  const endYear = useComparisonStore((s) => s.endYear);
  const currentIndex = useComparisonStore((s) => s.currentIndex);
  const isPlaying = useComparisonStore((s) => s.isPlaying);
  const state = useComparisonData();
  const data = state?.status === "ready" ? state.data : null;
  const dates = data?.rows.map((row) => row.date) ?? [];
  const mapMonth = useMapMonth(dates, currentIndex, isPlaying);

  // const data = async () => {
  //   const result = await api.get('/');
  //   const entries = createEicEntries(result.data);
  //   const index = createEicIndex(entries);
  //   console.log(index);
  // };

  // useEffect(() => {
  //   data();
  // }, []);

  if (!regionA || !regionB || !state) {
    return (
      <div className="empty-state">
        <h1>Select two regions</h1>
        <p>Two locations are needed to begin a comparison.</p>
      </div>
    );
  }

  const pendingText =
    state.status === "loading"
      ? loadingText(state.loading)
      : state.status === "error"
        ? errorText(state)
        : "";

  return (
    <div className="explore-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">EARTH DATA · COMPARE & LISTEN</span>
          <h1>
            Environmental signals,
            <br />
            <em>side by side.</em>
          </h1>
        </div>
        <div className="heading-note">
          <DataSourceBadge provenance={data?.provenance.a} />
          <p>
            Monthly values from NASA POWER, requested live from NASA for each region. Each value
            describes a grid cell of about 55 km, not a single station.
          </p>
        </div>
      </header>

      {/* Read in order during normal navigation; no visual change. */}
      <p className="sr-only">{guidedText.hints.explorePage}</p>

      <ImageSonification />
      <ComparisonControls years={state.years} />
      <DataStatus state={state} />

      <section className="map-section" aria-labelledby="map-title">
        <div className="section-label-row">
          <div>
            <span className="eyebrow">02 / GEOGRAPHY</span>
            <h2 id="map-title">A planetary view</h2>
          </div>
          <p>Selected points · Not to scale</p>
        </div>
        <EarthMap regionA={regionA} regionB={regionB} indicator={indicator} month={mapMonth} />
      </section>

      <ComparisonChart data={data} currentIndex={currentIndex} pendingText={pendingText} />
      <SonificationPlayer data={data} unavailableReason={unavailableReason(state)} />
      <ScientificExplanation indicator={indicator} provenance={data?.provenance.a ?? null} />

      <section className="data-summary" aria-labelledby="data-summary-title">
        <strong id="data-summary-title">Current comparison</strong>
        <StableText as="p">
          {`${regionA.name} and ${regionB.name}, ${indicatorOf(indicator).label.toLowerCase()} from ${startYear} through ${endYear}, NASA POWER.`}
        </StableText>
      </section>
    </div>
  );
}
