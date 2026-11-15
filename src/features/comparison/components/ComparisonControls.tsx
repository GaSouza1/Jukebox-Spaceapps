import { useState } from "react";
import { indicators, type IndicatorId } from "../../data/demoData";
import { useComparisonStore } from "../../../stores/comparisonStore";
import type { Region } from "../../../types/data";
import { REGION_SOUND } from "../../sonification/describeSonification";
import { guidedText } from "../../guided-experience/i18n/en";
import { StableText } from "../../../components/StableText";
import { RegionSelector } from "./RegionSelector";

export function ComparisonControls() {
  const store = useComparisonStore();
  const [announcement, setAnnouncement] = useState("");
  if (!store.regionA || !store.regionB) return null;

  // One short confirmation per user change (the chart summary below has the details).
  const announce = (a: Region, b: Region, indicator: IndicatorId, start: number, end: number) =>
    setAnnouncement(
      `Now comparing ${a.name} and ${b.name}, ${indicators[indicator].shortLabel.toLowerCase()}, ${start} to ${end}.`,
    );
  const indicator = store.indicator as IndicatorId;

  // Picking a start after the end (or vice versa) moves the other bound instead of
  // silently ignoring the choice.
  const updateStart = (startYear: number) => {
    const endYear = Math.max(store.endYear, startYear);
    store.setPeriod(startYear, endYear);
    announce(store.regionA!, store.regionB!, indicator, startYear, endYear);
  };
  const updateEnd = (endYear: number) => {
    const startYear = Math.min(store.startYear, endYear);
    store.setPeriod(startYear, endYear);
    announce(store.regionA!, store.regionB!, indicator, startYear, endYear);
  };

  return (
    <section className="control-panel" aria-labelledby="comparison-setup">
      <div className="section-label-row">
        <div>
          <span className="eyebrow">01 / SETUP</span>
          <h2 id="comparison-setup">Choose two places to compare</h2>
        </div>
        <p>Monthly aggregates · 2005–2024</p>
      </div>
      <span id="regions-group-label" className="sr-only">
        Regions to compare
      </span>
      <p id="regions-hint" className="sr-only">
        {guidedText.hints.regions}
      </p>
      {/* The group's description is read once when entering the Region A/B menus. */}
      <div
        className="region-grid"
        role="group"
        aria-labelledby="regions-group-label"
        aria-describedby="regions-hint"
      >
        <RegionSelector
          label="Region A"
          tone="blue"
          value={store.regionA}
          identity={`${REGION_SOUND.a.line} · ${REGION_SOUND.a.timbre}, ${REGION_SOUND.a.channel}`}
          onChange={(r) => {
            store.setRegion("regionA", r);
            announce(r, store.regionB!, indicator, store.startYear, store.endYear);
          }}
        />
        <div className="versus" aria-hidden="true">
          <span>VS</span>
        </div>
        <RegionSelector
          label="Region B"
          tone="orange"
          value={store.regionB}
          identity={`${REGION_SOUND.b.line} · ${REGION_SOUND.b.timbre}, ${REGION_SOUND.b.channel}`}
          onChange={(r) => {
            store.setRegion("regionB", r);
            announce(store.regionA!, r, indicator, store.startYear, store.endYear);
          }}
        />
      </div>
      <div className="filter-row">
        <fieldset>
          <legend>Environmental indicator</legend>
          <div className="segmented">
            {Object.values(indicators).map((item) => (
              <button
                key={item.id}
                type="button"
                className={store.indicator === item.id ? "active" : ""}
                onClick={() => {
                  store.setIndicator(item.id as IndicatorId);
                  announce(
                    store.regionA!,
                    store.regionB!,
                    item.id as IndicatorId,
                    store.startYear,
                    store.endYear,
                  );
                }}
                aria-pressed={store.indicator === item.id}
              >
                {item.shortLabel} <small>{item.unit}</small>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="period-control">
          <legend>Historical period</legend>
          <div>
            <label>
              From
              <select value={store.startYear} onChange={(e) => updateStart(Number(e.target.value))}>
                {Array.from({ length: 20 }, (_, i) => 2005 + i).map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </label>
            <span aria-hidden="true">—</span>
            <label>
              To
              <select value={store.endYear} onChange={(e) => updateEnd(Number(e.target.value))}>
                {Array.from({ length: 20 }, (_, i) => 2005 + i).map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>
      </div>
      <p className="sr-only" role="status">
        {announcement && <StableText>{announcement}</StableText>}
      </p>
    </section>
  );
}
