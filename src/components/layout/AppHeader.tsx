import { NavLink } from "react-router";

export function AppHeader() {
  return (
    <header className="site-header">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="header-inner">
        <NavLink to="/" className="brand" aria-label="Earth Information Jukebox, home">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <span>
            <strong>EARTH INFORMATION</strong>
            <small>JUKEBOX</small>
          </span>
        </NavLink>
        <nav aria-label="Main navigation">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/explore">Explore</NavLink>
          <NavLink to="/about">About</NavLink>
        </nav>
        <div className="header-meta">
          <span className="source-pill">NASA OPEN DATA</span>
          <button
            className="icon-button"
            aria-label="Toggle high contrast"
            title="Toggle high contrast"
            onClick={() => document.documentElement.classList.toggle("high-contrast")}
          >
            <span aria-hidden="true">◐</span>
          </button>
        </div>
      </div>
    </header>
  );
}
