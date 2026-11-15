import { indicators, type IndicatorId } from "../../data/demoData";

export function ScientificExplanation({ indicator }: { indicator: IndicatorId }) {
  const item = indicators[indicator];
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
            {item.description} Values are expressed in <strong>{item.unit}</strong>.
          </p>
        </article>
        <article>
          <span>02</span>
          <h3>Mapping values</h3>
          <p>
            Each monthly value is normalized within the displayed range of both regions together.
            Higher values produce higher pitches, and equal values sound at equal pitch.
          </p>
        </article>
        <article>
          <span>03</span>
          <h3>Two sound identities</h3>
          <p>
            Region A is a soft sine tone in the left channel; Region B is a brighter triangle tone
            in the right channel. Pitch conveys value, not color.
          </p>
        </article>
        <article>
          <span>04</span>
          <h3>Scientific limits</h3>
          <p>
            This demonstration uses synthetic monthly data. Sonification reveals patterns but does
            not establish environmental causes.
          </p>
        </article>
      </div>
      <div className="source-note">
        <strong>Intended source</strong>
        <span>NASA POWER · Monthly aggregates</span>
        <span className="demo-badge">
          <span aria-hidden="true" /> NOT YET CONNECTED
        </span>
      </div>
    </section>
  );
}
