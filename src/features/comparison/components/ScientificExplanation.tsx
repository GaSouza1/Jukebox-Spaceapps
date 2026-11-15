import { StableText } from "../../../components/StableText";
import type { Provenance } from "../../../types/data";
import { formatDay } from "../../data/format";
import { indicatorOf, type IndicatorId } from "../../data/indicators";
import { COMPARISON_MAPPING } from "../../sonification/describeSonification";

interface Props {
  indicator: IndicatorId;
  /** Of the data on screen, or null while it loads. */
  provenance: Provenance | null;
}

export function ScientificExplanation({ indicator: id, provenance }: Props) {
  const item = indicatorOf(id);
  const sources = provenance?.sources.filter((s) => s !== "POWER").join(", ");
  return (
    <section className="science-section" aria-labelledby="understanding-title">
      <div className="science-title">
        <span className="eyebrow">05 / METHODOLOGY</span>
        <h2 id="understanding-title">Understanding the sound</h2>
        <p>Hear the pattern, then return to the evidence.</p>
      </div>
      <div className="science-grid">
        <article>
          <span>01</span>
          <h3>What you hear</h3>
          <p>
            {item.description} Values are expressed in <strong>{item.unit.display}</strong> (
            {item.unit.spoken}).
          </p>
        </article>
        <article>
          <span>02</span>
          <h3>Mapping values</h3>
          <p>
            Both regions share one pitch scale: the lowest value of the comparison plays at{" "}
            {Math.round(COMPARISON_MAPPING.floorHz)} Hz and the highest at{" "}
            {Math.round(COMPARISON_MAPPING.topHz)} Hz, two octaves higher. The scale is even in
            musical steps, so equal differences sound as equal intervals. A month without data is
            silent.
          </p>
        </article>
        <article>
          <span>03</span>
          <h3>Two sound identities</h3>
          <p>
            Region A is a soft sine tone in the left channel; Region B is a brighter triangle tone
            in the right channel. Pitch conveys value, not color. One month lasts{" "}
            {COMPARISON_MAPPING.stepMs / 1000} seconds at 1× speed.
          </p>
        </article>
        <article>
          <span>04</span>
          <h3>Scientific limits</h3>
          <p>
            NASA POWER values come from the MERRA-2 reanalysis, a model constrained by observations.
            Each value describes a grid cell of about 55 by 60–70 km, not a weather station or a
            city. Sonification reveals patterns but does not establish environmental causes.
          </p>
        </article>
      </div>
      <div className="source-note">
        <strong>Source</strong>
        {provenance ? (
          <StableText>
            {`NASA POWER monthly point API${provenance.apiVersion ? ` ${provenance.apiVersion}` : ""} · ${sources || "MERRA-2"} · ${item.source.parameter} · retrieved ${formatDay(provenance.retrievedAt)}`}
          </StableText>
        ) : (
          <span>NASA POWER monthly point API · loading</span>
        )}
      </div>
      {item.eicLinks.length > 0 && (
        <div className="eic-links">
          <h3 id="eic-links-title">Explore further in the Earth Information Center</h3>
          <p>
            Curated pages related to this variable. The Earth Information Center has no data API, so
            the values above do not come from it.
          </p>
          <ul className="source-list" aria-labelledby="eic-links-title">
            {item.eicLinks.map((link) => (
              <li key={link.url}>
                <a href={link.url} target="_blank" rel="noreferrer">
                  <strong>{link.title}</strong>
                  <span>{link.why}</span>
                  <i aria-hidden="true">↗</i>
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
