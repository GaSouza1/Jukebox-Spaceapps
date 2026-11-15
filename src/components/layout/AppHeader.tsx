import { useState } from "react";
import { NavLink } from "react-router";

export function AppHeader() {
  const [highContrast, setHighContrast] = useState(() =>
    document.documentElement.classList.contains("high-contrast"),
  );
  const toggleContrast = () => {
    const next = !highContrast;
    document.documentElement.classList.toggle("high-contrast", next);
    setHighContrast(next);
  };

  return (
    <header className="site-header">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="header-inner">
        <NavLink to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <span>
            {/* Product name: not translated. */}
            <strong translate="no">EARTH INFORMATION</strong> <small translate="no">JUKEBOX</small>
            <span className="sr-only">, home</span>
          </span>
        </NavLink>
        <nav aria-label="Main">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/explore">Explore</NavLink>
          <NavLink to="/about">About</NavLink>
        </nav>
        <div className="header-meta">
          <span className="source-pill">NASA OPEN DATA</span>
          <button
            type="button"
            className="icon-button"
            aria-pressed={highContrast}
            title="High contrast"
            onClick={toggleContrast}
          >
            <span aria-hidden="true">◐</span>
            <span className="sr-only">High contrast</span>
          </button>
        </div>
      </div>
    </header>
  );
}
