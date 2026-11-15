import { Link } from "react-router";

const sections = [
  {
    number: "01",
    title: "The project",
    body: "Earth Information Jukebox makes environmental time series approachable through visual comparison and sonification. It responds to a familiar barrier: scientific charts are often inaccessible to people who cannot rely on visual interpretation alone.",
  },
  {
    number: "02",
    title: "Data sources",
    body: "Every value in the comparison comes from the NASA POWER monthly point API: mean air temperature at 2 meters (T2M) from the MERRA-2 reanalysis, requested directly from NASA for each region. A value describes a grid cell of about 55 by 60–70 km, not a weather station. The map shows the matching NASA GIBS layer (MERRA-2 2-meter air temperature) as visual context only, and the methodology section links to related Earth Information Center pages, which offer no data API.",
  },
  {
    number: "03",
    title: "Sonification methodology",
    body: "Monthly values are placed on one pitch scale shared by both regions, from the lowest value of the active comparison (261.6 Hz, C4) to the highest (1046.5 Hz, C6). The scale is even in musical steps, so equal values sound at equal pitch and equal differences sound as equal intervals. Region A uses a soft sine tone in the left channel and Region B a brighter triangle tone in the right channel; one month lasts half a second at 1× speed, and a month without data is silent. Before playing, screen readers receive a description of what the sound represents.",
  },
  {
    number: "04",
    title: "Accessibility",
    body: "Semantic landmarks, keyboard-operable controls, visible focus, text summaries and data tables, high contrast, chart descriptions, spoken descriptions before each sonification and separate stop and volume controls support different access needs. Sound and color reinforce information but never carry it alone.",
  },
];

export function AboutPage() {
  return (
    <div className="about-page">
      <header className="about-hero">
        <span className="eyebrow">ABOUT / METHODOLOGY</span>
        <h1>
          Making Earth data
          <br />
          <em>resonate.</em>
        </h1>
        <p>
          A scientific and accessible approach to comparing environmental change—one month, one
          place and one sound at a time.
        </p>
      </header>
      <div className="about-layout">
        <nav aria-labelledby="on-this-page">
          <p id="on-this-page">ON THIS PAGE</p>
          {sections.map((section) => (
            <a key={section.number} href={`#section-${section.number}`}>
              {section.number} {section.title}
            </a>
          ))}
          <a href="#disclaimer">05 Scientific disclaimer</a>
        </nav>
        <div className="about-sections">
          {sections.map((section) => (
            <section id={`section-${section.number}`} key={section.number}>
              <span>{section.number}</span>
              <div>
                <h2>{section.title}</h2>
                <p>{section.body}</p>
                {section.number === "02" && (
                  <div className="source-list">
                    <a href="https://power.larc.nasa.gov/" target="_blank" rel="noreferrer">
                      <strong>NASA POWER</strong>
                      <span>Climate data for energy and agriculture</span>
                      <i aria-hidden="true">↗</i>
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                    <a
                      href="https://www.earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <strong>NASA GIBS</strong>
                      <span>Global imagery browsing services</span>
                      <i aria-hidden="true">↗</i>
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                    <a href="https://earth.gov/" target="_blank" rel="noreferrer">
                      <strong>Earth Information Center</strong>
                      <span>Trusted Earth science information</span>
                      <i aria-hidden="true">↗</i>
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  </div>
                )}
              </div>
            </section>
          ))}
          <section id="disclaimer" className="disclaimer">
            <span>05</span>
            <div>
              <h2>Scientific disclaimer</h2>
              <p>
                Sonification is a representation of numerical data—not a direct acoustic measurement
                of Earth. Differences in sound reflect the selected mapping rules and should be
                interpreted alongside the values, units, provenance and known limitations of the
                source dataset.
              </p>
            </div>
          </section>
        </div>
      </div>
      <div className="about-cta">
        <div>
          <span className="eyebrow">READY TO LISTEN?</span>
          <h2>Compare two places on one planet.</h2>
        </div>
        <Link className="primary-button" to="/explore">
          Open the experience <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
