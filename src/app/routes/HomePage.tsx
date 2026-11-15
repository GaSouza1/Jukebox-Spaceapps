import { Link } from "react-router";
import { DataSourceBadge } from "../../components/DataSourceBadge";

export function HomePage() {
  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-copy">
          <div className="challenge-tag">
            <span aria-hidden="true" /> NASA SPACE APPS CHALLENGE · 2026
          </div>
          <h1>
            Two regions.
            <br />
            One planet.
            <br />
            <em>Two sound stories.</em>
          </h1>
          <p className="hero-lede">
            Compare Earth’s changing environments through NASA data—translated into synchronized
            visuals and sound.
          </p>
          <div className="hero-actions">
            <Link className="primary-button" to="/explore">
              Start exploring <span aria-hidden="true">→</span>
            </Link>
            <Link className="text-link" to="/about">
              Read our methodology
            </Link>
          </div>
          <div className="hero-trust">
            <div>
              <strong>ACCESSIBLE BY DESIGN</strong>
              <span>Visual, auditory and text alternatives</span>
            </div>
            <div>
              <strong>SCIENTIFIC SOURCES</strong>
              <span>NASA POWER · GIBS · EIC</span>
            </div>
          </div>
        </div>
        <div className="planet-stage" role="img" aria-labelledby="planet-stage-label">
          <span id="planet-stage-label" className="sr-only">
            Decorative illustration: an abstract Earth with two compared locations, A and B
          </span>
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="planet">
            <div className="land land-one" />
            <div className="land land-two" />
            <span className="point point-a">
              <i /> A
            </span>
            <span className="point point-b">
              <i /> B
            </span>
          </div>
          <div className="frequency-lines" aria-hidden="true">
            {Array.from({ length: 34 }, (_, i) => (
              <i key={i} style={{ height: `${4 + ((i * 13) % 34)}px` }} />
            ))}
          </div>
          <div className="planet-caption">
            <span>COMPARISON MODE</span>
            <strong>EARTH · MONTHLY SIGNAL</strong>
          </div>
        </div>
      </section>

      <section className="home-intro">
        <div>
          <span className="eyebrow">THE EXPERIENCE</span>
          <h2>
            Data you can see.
            <br />
            Patterns you can hear.
          </h2>
        </div>
        <div className="experience-steps">
          <article>
            <span>01</span>
            <h3>Choose two regions</h3>
            <p>Place local and global environments side by side.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Explore the evidence</h3>
            <p>Read monthly temperature or precipitation patterns.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Listen differently</h3>
            <p>Hear each location through a distinct, synchronized timbre.</p>
          </article>
        </div>
      </section>
      <div className="home-demo-note">
        <DataSourceBadge /> Current experience uses clearly labeled synthetic data until NASA APIs
        are connected.
      </div>
    </div>
  );
}
