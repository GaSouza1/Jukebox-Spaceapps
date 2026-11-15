import { useMemo, useEffect } from "react";
import { DataSourceBadge } from "../../components/DataSourceBadge";
import { StableText } from "../../components/StableText";
import { ComparisonControls } from "../../features/comparison/components/ComparisonControls";
import { ScientificExplanation } from "../../features/comparison/components/ScientificExplanation";
import { createDemoSeries, indicators, type IndicatorId } from "../../features/data/demoData";
import { SonificationPlayer } from "../../features/sonification/components/SonificationPlayer";
import { ComparisonChart } from "../../features/visualization/charts/ComparisonChart";
import { EarthMap } from "../../features/visualization/map/EarthMap";
import { useComparisonStore } from "../../stores/comparisonStore";
import { ImageSonification } from "@/features/sonification/components/ImageAnalyzer";
import { guidedText } from "@/features/guided-experience/i18n/en";
import api from "@/features/data/apiData";
import {createEicEntries, createEicIndex} from "@/features/data/data";
export function ExplorePage() {
  const { regionA, regionB, indicator, startYear, endYear, currentIndex } = useComparisonStore();
  const seriesA = useMemo(
    () =>
      regionA ? createDemoSeries(regionA, indicator as IndicatorId, startYear, endYear) : null,
    [regionA, indicator, startYear, endYear],
  );
  const seriesB = useMemo(
    () =>
      regionB ? createDemoSeries(regionB, indicator as IndicatorId, startYear, endYear) : null,
    [regionB, indicator, startYear, endYear],
  );

  const data = async () => {
    const result = await api.get('/');
    const entries = createEicEntries(result.data);
    const index = createEicIndex(entries);
    console.log(index);
  };

  useEffect(() => {
    data();
  }, []);

  if (!regionA || !regionB || !seriesA || !seriesB) {
    return (
      <div className="empty-state">
        <h1>Select two regions</h1>
        <p>Two locations are needed to begin a comparison.</p>
      </div>
    );
  }

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
          <DataSourceBadge />
          <p>Values are synthetic and provided only to demonstrate the interaction.</p>
        </div>
      </header>

      {/* Read in order during normal navigation; no visual change. */}
      <p className="sr-only">{guidedText.hints.explorePage}</p>

      <ImageSonification />
      <ComparisonControls />

      <section className="map-section" aria-labelledby="map-title">
        <div className="section-label-row">
          <div>
            <span className="eyebrow">02 / GEOGRAPHY</span>
            <h2 id="map-title">A planetary view</h2>
          </div>
          <p>Selected points · Not to scale</p>
        </div>
        <EarthMap regionA={regionA} regionB={regionB} />
      </section>

      <ComparisonChart seriesA={seriesA} seriesB={seriesB} currentIndex={currentIndex} />
      <SonificationPlayer seriesA={seriesA} seriesB={seriesB} />
      <ScientificExplanation indicator={indicator as IndicatorId} />

      <section className="data-summary" aria-labelledby="data-summary-title">
        <strong id="data-summary-title">Current comparison</strong>
        <StableText as="p">
          {`${regionA.name} and ${regionB.name}, ${indicators[indicator as IndicatorId].label.toLowerCase()} from ${startYear} through ${endYear}.`}
        </StableText>
      </section>
    </div>
  );
}
