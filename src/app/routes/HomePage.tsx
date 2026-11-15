import { Link } from "react-router";
import { DataSourceBadge } from "../../components/DataSourceBadge";
import earthLogo from "@/assets/earth-illustration.jpg";

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
              <span>NASA POWER data · GIBS imagery · EIC links</span>
            </div>
          </div>
        </div>
        <div className="planet-stage">
          <img src={earthLogo} alt="Abstract Earth with two compared locations, A and B" />
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
            <p>Read monthly temperature patterns from NASA POWER.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Listen differently</h3>
            <p>Hear each location through a distinct, synchronized timbre.</p>
          </article>
        </div>
      </section>
      <div className="home-demo-note">
        <DataSourceBadge /> Monthly air temperature from the NASA POWER API (MERRA-2 reanalysis),
        requested live for the regions you choose.
      </div>
    </div>
  );
}
