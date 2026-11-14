import { indicators, type IndicatorId } from "../../data/demoData";
import { useComparisonStore } from "../../../stores/comparisonStore";
import { RegionSelector } from "./RegionSelector";

export function ComparisonControls() {
  const store = useComparisonStore();
  if (!store.regionA || !store.regionB) return null;

  const updateStart = (startYear: number) =>
    store.setPeriod(Math.min(startYear, store.endYear), store.endYear);
  const updateEnd = (endYear: number) =>
    store.setPeriod(store.startYear, Math.max(endYear, store.startYear));

  return (
    <section className="control-panel" aria-labelledby="comparison-setup">
      <div className="section-label-row">
        <div>
          <span className="eyebrow">01 / SETUP</span>
          <h2 id="comparison-setup">Choose two places to compare</h2>
        </div>
        <p>Monthly aggregates · 2005–2024</p>
      </div>
      <div className="region-grid">
        <RegionSelector
          label="REGION A"
          tone="blue"
          value={store.regionA}
          onChange={(r) => store.setRegion("regionA", r)}
        />
        <div className="versus" aria-hidden="true">
          <span>VS</span>
        </div>
        <RegionSelector
          label="REGION B"
          tone="orange"
          value={store.regionB}
          onChange={(r) => store.setRegion("regionB", r)}
        />
      </div>
      <div className="filter-row">
        <fieldset>
          <legend>Environmental indicator</legend>
          <div className="segmented">
            {Object.values(indicators).map((item) => (
              <button
                key={item.id}
                className={store.indicator === item.id ? "active" : ""}
                onClick={() => store.setIndicator(item.id as IndicatorId)}
                aria-pressed={store.indicator === item.id}
              >
                {item.shortLabel}
                <small>{item.unit}</small>
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
    </section>
  );
}
