import { useState } from "react";
import { indicatorList, indicatorOf, type IndicatorId } from "../../data/indicators";
import { POWER_FIRST_YEAR } from "../../data/power/powerClient";
import { useComparisonStore } from "../../../stores/comparisonStore";
import type { Region } from "../../../types/data";
import { REGION_SOUND } from "../../sonification/describeSonification";
import { guidedText } from "../../guided-experience/i18n/en";
import { StableText } from "../../../components/StableText";
import { RegionSelector } from "./RegionSelector";

interface Props {
  /** Complete years both regions cover, once the data has arrived. */
  years: { first: number; last: number } | null;
}

export function ComparisonControls({ years }: Props) {
  const store = useComparisonStore();
  const [announcement, setAnnouncement] = useState("");
  if (!store.regionA || !store.regionB) return null;

  // Until the data says otherwise, offer POWER's documented range up to the last year asked for.
  const range = years ?? { first: POWER_FIRST_YEAR, last: store.endYear };
  const yearOptions = Array.from(
    { length: range.last - range.first + 1 },
    (_, i) => range.first + i,
  );

  // One short confirmation per user change (the data status and chart summary have the details).
  const announce = (a: Region, b: Region, indicator: IndicatorId, start: number, end: number) =>
    setAnnouncement(
      `Now comparing ${a.name} and ${b.name}, ${indicatorOf(indicator).shortLabel.toLowerCase()}, ${start} to ${end}.`,
    );
  const indicator = store.indicator;

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
        <StableText as="p">
          {years
            ? `NASA POWER monthly means · complete years ${years.first}–${years.last}`
            : "NASA POWER monthly means"}
        </StableText>
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
          other={store.regionB}
          otherLabel="Region B"
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
          other={store.regionA}
          otherLabel="Region A"
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
            {indicatorList.map((item) => (
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
                {item.shortLabel} <small>{item.unit.display}</small>
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
                {yearOptions.map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </label>
            <span aria-hidden="true">—</span>
            <label>
              To
              <select value={store.endYear} onChange={(e) => updateEnd(Number(e.target.value))}>
                {yearOptions.map((y) => (
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
